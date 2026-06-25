import { env } from "@/lib/env";
import { hub } from "@/lib/hub";
import { newId } from "@/lib/ids";
import { streamChat, type ChatMessage } from "@/lib/llm/client";
import { embedText } from "@/lib/llm/embed";
import { mockStream } from "@/lib/llm/mock";
import { parseMemoryCommand } from "@/lib/memory/commands";
import { scheduleExtraction } from "@/lib/memory/extract";
import { memoryEnabled, memoryStore } from "@/lib/memory/index";
import { recallForTurn } from "@/lib/memory/recall";
import { scheduleSummarize } from "@/lib/memory/summarize";
import type { MemoryItem } from "@/lib/memory/types";
import { store } from "@/lib/store";
import type { Message } from "@/lib/store/types";

const SYSTEM_PROMPT =
  "あなたはチームの共有チャットルームにいる、フレンドリーなアシスタントです。" +
  "複数のメンバーが同じ会話を見ており、各発言の冒頭にある「名前:」がその発言者を表します。" +
  "次のように振る舞ってください: " +
  "日本語で、親しみやすく自然な話し言葉で返す。" +
  "返答は簡潔に、基本は1〜3文程度。" +
  "文脈に応じて必要なときだけ相手の名前を呼ぶ。" +
  "手順やコードなど整理した方が分かりやすい場合は Markdown（箇条書き・コードブロック等）を使ってよいが、" +
  "普段の会話は装飾せず自然な文で返す。";

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

  // 直近のユーザー発話が「覚えて/忘れて」コマンドなら、生成せず記憶操作で完結。
  const lastUser = [...history].reverse().find((m) => m.role === "user");
  if (lastUser && (await handleMemoryCommand(channelId, lastUser))) return;

  // 関連記憶を想起して system prompt 末尾に注入（embedding 無効時は degrade）。
  const recall = await recallForTurn(channelId, history);
  const systemContent = recall.block ? `${SYSTEM_PROMPT}\n\n${recall.block}` : SYSTEM_PROMPT;
  const chat: ChatMessage[] = [
    { role: "system", content: systemContent },
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

  // 背景の学習ジョブ（応答配信はブロックしない）。
  // - 自動抽出: extractEveryNTurns ごとに事実/好み/決定を抽出
  // - 会話要約: 履歴が summaryThreshold を超えたらコンテキストを圧縮
  if (memoryEnabled) {
    scheduleExtraction(channelId);
    scheduleSummarize(channelId);
  }
}

const AMBIENT_SYSTEM_PROMPT =
  "あなたはチームの共有チャットを見守っているアシスタントです。" +
  "直近の会話を読み、あなたが今“自発的に”一言加えることで本当に役立つ場合だけ発言します" +
  "（例: 未解決の質問に答える、論点を一言で整理する、忘れられたタスクを思い出させる）。" +
  "特に役立つことが無い・ただの雑談・すでに解決済みなら、必ず「[silent]」とだけ返してください。" +
  "発言する場合は日本語で1〜2文、押し付けがましくならないよう簡潔に。";

/**
 * アンビエント（自発）ターン。
 * トークンは配信せずに一旦全文を生成し、「役立つ」と判断したときだけ
 * 確定メッセージとして配信する（[silent] や空なら何もしない＝静かに見送る）。
 * @returns 実際に発言したら true。
 */
export async function runAmbientTurn(channelId: string): Promise<boolean> {
  const history = await store.getMessages(channelId);
  if (history.length === 0) return false;

  const recall = await recallForTurn(channelId, history);
  const systemContent = recall.block
    ? `${AMBIENT_SYSTEM_PROMPT}\n\n${recall.block}`
    : AMBIENT_SYSTEM_PROMPT;
  const chat: ChatMessage[] = [
    { role: "system", content: systemContent },
    ...history.map((m) => ({
      role: m.role,
      content: m.role === "user" ? `${m.author}: ${m.content}` : m.content,
    })),
  ];

  const generate = env.llmDriver === "mock" ? mockStream : streamChat;
  let text = "";
  try {
    for await (const delta of generate(chat)) text += delta;
  } catch {
    return false; // アンビエントはエラー時は黙る
  }

  const trimmed = text.trim();
  if (trimmed === "" || /\[silent\]/i.test(trimmed)) return false; // 見送り

  const message = {
    id: newId("msg"),
    channelId,
    role: "assistant" as const,
    author: "assistant",
    content: trimmed,
    createdAt: Date.now(),
    status: "complete" as const,
    ambient: true,
  };
  await store.appendMessage(message);
  hub.publish(channelId, { type: "message", message });
  return true;
}

/** assistant 名義の確定メッセージを作って配信する（記憶操作の確認用）。 */
async function postAssistantMessage(channelId: string, content: string): Promise<void> {
  const message = {
    id: newId("msg"),
    channelId,
    role: "assistant" as const,
    author: "assistant",
    content,
    createdAt: Date.now(),
    status: "complete" as const,
  };
  await store.appendMessage(message);
  hub.publish(channelId, { type: "message", message });
}

/**
 * 直近のユーザー発話が「覚えて/忘れて」コマンドなら記憶を操作し、確認を配信する。
 * 操作したら true（呼び出し側は通常生成をスキップ）。コマンドでなければ false。
 */
async function handleMemoryCommand(channelId: string, trigger: Message): Promise<boolean> {
  if (!memoryEnabled) return false;
  const cmd = parseMemoryCommand(trigger.content);
  if (!cmd) return false;

  if (cmd.kind === "forget") {
    // 当該チャンネルから見える記憶（global + このch）を新しい順に。
    const pool = (await memoryStore.list())
      .filter((m) => m.scope === "global" || m.channelId === channelId)
      .sort((a, b) => b.createdAt - a.createdAt);
    const target = cmd.text
      ? pool.find((m) => m.text.includes(cmd.text as string))
      : pool.find((m) => m.source === "explicit");
    if (!target) {
      await postAssistantMessage(channelId, "🧠 該当する記憶が見つかりませんでした。");
      return true;
    }
    await memoryStore.delete(target.id);
    await postAssistantMessage(channelId, `🧠 記憶を忘れました: ${target.text}`);
    hub.publish(channelId, {
      type: "memory",
      action: "removed",
      item: { id: target.id, text: target.text, scope: target.scope, kind: target.kind },
    });
    return true;
  }

  // remember
  const text = cmd.text as string;
  const embedding = await embedText(text);
  const now = Date.now();
  const item: MemoryItem = {
    id: newId("mem"),
    scope: cmd.scope,
    channelId: cmd.scope === "channel" ? channelId : null,
    kind: "fact",
    text,
    subject: null,
    source: "explicit",
    author: trigger.author,
    embedding,
    embeddingModel: embedding ? env.embedModel : null,
    createdAt: now,
    updatedAt: now,
  };
  await memoryStore.add(item);

  const scopeLabel = cmd.scope === "global" ? "全体" : "このch";
  await postAssistantMessage(channelId, `🧠 覚えました（${scopeLabel}）: ${text}`);
  hub.publish(channelId, {
    type: "memory",
    action: "added",
    item: { id: item.id, text: item.text, scope: item.scope, kind: item.kind },
  });
  return true;
}
