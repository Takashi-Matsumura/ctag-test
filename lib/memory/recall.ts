import { env } from "@/lib/env";
import { embedText } from "@/lib/llm/embed";
import { memoryEnabled, memoryStore } from "@/lib/memory/index";
import type { MemoryHit, MemoryItem, MemoryKind, MemoryScope } from "@/lib/memory/types";
import type { Message } from "@/lib/store/types";

export interface RecallResult {
  /** system prompt 末尾に差し込む整形済みブロック（空なら ""）。 */
  block: string;
  /** 注入された事実系 hit（デバッグ/ログ用）。 */
  hits: MemoryHit[];
}

const SCOPE_LABEL: Record<MemoryScope, string> = { global: "全体", channel: "このch" };
const KIND_LABEL: Record<MemoryKind, string> = {
  fact: "事実",
  preference: "好み",
  decision: "決定",
  summary: "要約",
};

/**
 * 直近メッセージを query に関連記憶を検索し、system へ注入するブロックを組む。
 * embedding 無効/失敗時は degrade（明示記憶を最近順に注入）。会話要約は常に注入。
 */
export async function recallForTurn(
  channelId: string,
  history: Message[],
  opts?: { topK?: number },
): Promise<RecallResult> {
  if (!memoryEnabled) return { block: "", hits: [] };

  const topK = opts?.topK ?? env.recallTopK;

  // 直近の human 発話 最大3件を query に束ねる（"うん" 等の単発で精度が落ちないように）。
  const query = history
    .filter((m) => m.role === "user")
    .slice(-3)
    .map((m) => m.content)
    .join("\n")
    .trim();

  const queryEmbedding = query ? await embedText(query) : null;

  const factHits = await memoryStore.search({
    queryEmbedding,
    channelId,
    topK,
    minScore: queryEmbedding ? env.recallMinScore : undefined,
    kinds: ["fact", "preference", "decision"],
  });

  // 会話要約は類似度に関係なく常に注入（チャンネルに最大1件想定）。
  const channelItems = await memoryStore.list({ scope: "channel", channelId });
  const summary = channelItems.find((m) => m.kind === "summary") ?? null;

  return { block: buildBlock(factHits, summary), hits: factHits };
}

function buildBlock(facts: MemoryHit[], summary: MemoryItem | null): string {
  if (facts.length === 0 && !summary) return "";

  const lines: string[] = [];
  if (facts.length > 0) {
    lines.push("# 記憶（このチームについて把握していること）");
    for (const { item } of facts) {
      lines.push(`- [${SCOPE_LABEL[item.scope]}/${KIND_LABEL[item.kind]}] ${item.text}`);
    }
  }
  if (summary) {
    if (lines.length > 0) lines.push("");
    lines.push("# これまでの会話の要約");
    lines.push(summary.text);
  }
  lines.push("");
  lines.push("上記はあなたの記憶です。関連する場合のみ自然に活かし、毎回そのまま列挙しないこと。");
  return lines.join("\n");
}
