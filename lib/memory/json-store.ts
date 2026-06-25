import { existsSync, readFileSync } from "node:fs";
import { mkdir, rename, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { env } from "@/lib/env";
import { singleton } from "@/lib/singleton";
import { cosineSim } from "@/lib/memory/cosine";
import type {
  MemoryHit,
  MemoryItem,
  MemoryQuery,
  MemoryScope,
  MemoryStore,
} from "@/lib/memory/types";

/**
 * JSON ファイル永続の記憶ストア（揮発モードは persist:false で兼用）。
 *
 * - データ配列だけを globalThis に固定（store/memory.ts と同じ HMR 対策）。
 *   インスタンスは固定しないので、dev でメソッドを足しても状態は保たれる。
 * - 書き込みは temp→rename のアトミック書き込み + デバウンス + 直列チェーン。
 *   flush は常に「固定された最新の data 配列」を読むので、HMR で古い
 *   インスタンスのタイマーが発火しても壊れない。
 */
export class JsonMemoryStore implements MemoryStore {
  private readonly persist: boolean;
  private readonly file: string;
  private readonly data: MemoryItem[];
  /** flush 調整状態も固定し、HMR をまたいで直列性を保つ。 */
  private readonly writeState: { chain: Promise<void>; timer: NodeJS.Timeout | null };

  constructor(opts: { persist: boolean; file: string }) {
    this.persist = opts.persist;
    this.file = resolve(process.cwd(), opts.file);
    this.data = singleton("memory-data", () =>
      opts.persist ? loadFromDisk(resolve(process.cwd(), opts.file)) : [],
    );
    this.writeState = singleton("memory-write", () => ({
      chain: Promise.resolve(),
      timer: null,
    }));
  }

  async add(item: MemoryItem): Promise<MemoryItem> {
    this.data.push(item);
    this.scheduleFlush();
    return item;
  }

  async list(opts: { scope?: MemoryScope; channelId?: string | null } = {}): Promise<MemoryItem[]> {
    return this.data
      .filter((m) => (opts.scope ? m.scope === opts.scope : true))
      .filter((m) => (opts.channelId !== undefined ? m.channelId === opts.channelId : true))
      .sort((a, b) => b.createdAt - a.createdAt);
  }

  async get(id: string): Promise<MemoryItem | null> {
    return this.data.find((m) => m.id === id) ?? null;
  }

  async delete(id: string): Promise<boolean> {
    const idx = this.data.findIndex((m) => m.id === id);
    if (idx === -1) return false;
    this.data.splice(idx, 1);
    this.scheduleFlush();
    return true;
  }

  async update(id: string, patch: Partial<MemoryItem>): Promise<MemoryItem | null> {
    const item = this.data.find((m) => m.id === id);
    if (!item) return null;
    Object.assign(item, patch, { updatedAt: Date.now() });
    this.scheduleFlush();
    return item;
  }

  async search(q: MemoryQuery): Promise<MemoryHit[]> {
    // 対象 = 全 global 記憶 + 当該 channel の記憶。kinds 指定があれば絞る。
    const pool = this.data.filter(
      (m) =>
        (m.scope === "global" || (m.scope === "channel" && m.channelId === q.channelId)) &&
        (!q.kinds || q.kinds.includes(m.kind)),
    );

    // embedding 無し（フォールバック）: 明示記憶を優先しつつ最近順で返す。
    if (!q.queryEmbedding) {
      return [...pool]
        .sort((a, b) => {
          const ea = a.source === "explicit" ? 1 : 0;
          const eb = b.source === "explicit" ? 1 : 0;
          if (ea !== eb) return eb - ea;
          return b.createdAt - a.createdAt;
        })
        .slice(0, q.topK)
        .map((item) => ({ item, score: 0 }));
    }

    const dim = q.queryEmbedding.length;
    const hits: MemoryHit[] = [];
    for (const item of pool) {
      // 次元/モデル不一致は検索対象外（クラッシュ・無意味比較を防ぐ）。
      if (!item.embedding || item.embedding.length !== dim) continue;
      if (item.embeddingModel && item.embeddingModel !== env.embedModel) continue;
      const score = cosineSim(q.queryEmbedding, item.embedding);
      if (q.minScore != null && score < q.minScore) continue;
      hits.push({ item, score });
    }
    hits.sort((a, b) => b.score - a.score);
    return hits.slice(0, q.topK);
  }

  // --- 永続化（temp→rename のアトミック書き込み・デバウンス・直列） ---

  private scheduleFlush(): void {
    if (!this.persist) return;
    if (this.writeState.timer) return; // 既に予約済み
    this.writeState.timer = setTimeout(() => {
      this.writeState.timer = null;
      // 固定された data 配列のスナップショットをチェーンで直列に書き出す。
      const snapshot = JSON.stringify(this.data, null, 2);
      const file = this.file;
      this.writeState.chain = this.writeState.chain
        .then(() => flushToDisk(file, snapshot))
        .catch((err) => {
          console.warn("[memory] flush failed:", err instanceof Error ? err.message : err);
        });
    }, 120);
  }
}

function loadFromDisk(file: string): MemoryItem[] {
  try {
    if (!existsSync(file)) return [];
    const raw = readFileSync(file, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as MemoryItem[]) : [];
  } catch (err) {
    console.warn("[memory] load failed, starting empty:", err instanceof Error ? err.message : err);
    return [];
  }
}

async function flushToDisk(file: string, contents: string): Promise<void> {
  await mkdir(dirname(file), { recursive: true });
  const tmp = `${file}.tmp`;
  await writeFile(tmp, contents, "utf8");
  await rename(tmp, file);
}
