import { env } from "@/lib/env";
import { newId } from "@/lib/ids";
import { completeChat } from "@/lib/llm/complete";
import { embedText } from "@/lib/llm/embed";
import { memoryEnabled, memoryStore } from "@/lib/memory/index";
import type { MemoryItem } from "@/lib/memory/types";
import { singleton } from "@/lib/singleton";
import { store } from "@/lib/store";

const SUMMARY_SYSTEM =
  "あなたはチームチャットの書記です。与えられた会話（既存の要約があればそれも）を統合し、" +
  "これまでの流れの要点を日本語の箇条書きで簡潔にまとめてください。" +
  "決定事項・未解決の論点・重要な事実を優先し、雑談は省きます。" +
  "全体で10行以内。要約本文のみを出力し、前置きや見出しは付けないこと。";

// 多重起動防止。HMR 耐性のため singleton。
const running = singleton("memory-summary-running", () => new Set<string>());

/**
 * アシスタントターン後に呼ぶ。履歴が閾値を超えていれば背景で要約を更新する
 * （fire-and-forget、応答配信はブロックしない）。
 */
export function scheduleSummarize(channelId: string): void {
  if (!memoryEnabled) return;
  if (running.has(channelId)) return;
  running.add(channelId);
  void maybeSummarizeChannel(channelId)
    .catch((err) => console.warn("[memory] summarize failed:", err instanceof Error ? err.message : err))
    .finally(() => running.delete(channelId));
}

/**
 * coveredUntil 以降〜直近 recentWindow を除いた古いメッセージを要約し、
 * チャンネルの summary 記憶を更新（無ければ作成）する。コンテキスト圧縮用。
 */
export async function maybeSummarizeChannel(channelId: string): Promise<void> {
  const history = await store.getMessages(channelId);
  if (history.length <= env.summaryThreshold) return;

  const channelItems = await memoryStore.list({ scope: "channel", channelId });
  const existing = channelItems.find((m) => m.kind === "summary") ?? null;
  const coveredUntil = existing?.coveredUntil ?? 0;

  // 直近 recentWindow 件は system に生注入されるので、要約対象から外す（二重防止）。
  const head = history.slice(0, Math.max(0, history.length - env.recentWindow));
  // まだ要約していない差分だけを対象に。
  const target = head.filter((m) => m.createdAt > coveredUntil);
  if (target.length === 0) return;

  const newCoveredUntil = target[target.length - 1].createdAt;
  const transcript = target
    .map((m) => `${m.role === "user" ? m.author : "assistant"}: ${m.content}`)
    .join("\n");
  const userContent = existing
    ? `これまでの要約:\n${existing.text}\n\n追加の会話:\n${transcript}`
    : `会話:\n${transcript}`;

  const summaryText = (
    await completeChat([
      { role: "system", content: SUMMARY_SYSTEM },
      { role: "user", content: userContent },
    ])
  ).trim();
  if (!summaryText) return;

  const embedding = await embedText(summaryText);
  if (existing) {
    await memoryStore.update(existing.id, {
      text: summaryText,
      embedding,
      embeddingModel: embedding ? env.embedModel : null,
      coveredUntil: newCoveredUntil,
    });
  } else {
    const now = Date.now();
    const item: MemoryItem = {
      id: newId("mem"),
      scope: "channel",
      channelId,
      kind: "summary",
      text: summaryText,
      subject: null,
      source: "summary",
      author: null,
      embedding,
      embeddingModel: embedding ? env.embedModel : null,
      createdAt: now,
      updatedAt: now,
      coveredUntil: newCoveredUntil,
    };
    await memoryStore.add(item);
  }
}
