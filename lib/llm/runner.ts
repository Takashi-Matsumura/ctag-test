import { env } from "@/lib/env";
import { hub } from "@/lib/hub";
import { newId } from "@/lib/ids";
import { streamChat, type ChatMessage } from "@/lib/llm/client";
import { mockStream } from "@/lib/llm/mock";
import { store } from "@/lib/store";

const SYSTEM_PROMPT =
  "あなたはチームの共有チャットルームにいる、フレンドリーなアシスタントです。" +
  "複数のメンバーが同じ会話を見ており、各発言の冒頭にある「名前:」がその発言者を表します。" +
  "次のように振る舞ってください: " +
  "日本語で、親しみやすく自然な話し言葉で返す。" +
  "返答は簡潔に、基本は1〜3文程度。" +
  "文脈に応じて必要なときだけ相手の名前を呼ぶ。" +
  "箇条書きや見出しなどの装飾は特に求められない限り使わず、会話として自然に返す。";

/**
 * アシスタントの1ターンを実行する。
 * - チャンネルの履歴から会話を組み立て
 * - LLM(または mock)をストリーミングし、token を Hub 経由で全員に配信
 * - 完了で確定メッセージを Store に追記し message/state を配信
 * 必ず ChannelLock 経由で呼ぶこと（1チャンネル1体・直列を保証）。
 */
export async function runAssistantTurn(channelId: string): Promise<void> {
  const runId = newId("run");
  const history = await store.getMessages(channelId);
  const chat: ChatMessage[] = [
    { role: "system", content: SYSTEM_PROMPT },
    ...history.map((m) => ({
      role: m.role,
      content: m.role === "user" ? `${m.author}: ${m.content}` : m.content,
    })),
  ];

  hub.setStatus(channelId, "thinking", runId);

  const generate = env.llmDriver === "mock" ? mockStream : streamChat;
  let text = "";
  let started = false;

  try {
    for await (const delta of generate(chat)) {
      if (!started) {
        hub.startStream(channelId, runId);
        started = true;
      }
      text += delta;
      hub.appendStream(channelId, runId, delta);
    }
    if (!started) hub.startStream(channelId, runId); // 空応答でも確定処理へ
  } catch (err) {
    hub.endStream(channelId);
    hub.publish(channelId, {
      type: "error",
      message: err instanceof Error ? err.message : "アシスタントの生成に失敗しました",
    });
    hub.setStatus(channelId, "idle", runId);
    return;
  }

  const message = {
    id: newId("msg"),
    channelId,
    role: "assistant" as const,
    author: "assistant",
    content: text,
    createdAt: Date.now(),
    status: "complete" as const,
  };
  await store.appendMessage(message);
  hub.endStream(channelId);
  hub.publish(channelId, { type: "message", message });
  hub.setStatus(channelId, "idle", runId);
}
