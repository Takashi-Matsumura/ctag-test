import { ambient } from "@/lib/ambient";
import { hub } from "@/lib/hub";
import { newId } from "@/lib/ids";
import { lock } from "@/lib/lock";
import { runAssistantTurn } from "@/lib/llm/runner";
import { mentionsAssistant } from "@/lib/mention";
import { store } from "@/lib/store";
import type { Message } from "@/lib/store/types";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const channel = await store.getChannel(id);
  if (!channel) {
    return Response.json({ error: "channel not found" }, { status: 404 });
  }
  return Response.json({ messages: await store.getMessages(id) });
}

export async function POST(
  request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const channel = await store.getChannel(id);
  if (!channel) {
    return Response.json({ error: "channel not found" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid JSON" }, { status: 400 });
  }
  const author = (body as { author?: unknown })?.author;
  const content = (body as { content?: unknown })?.content;
  if (typeof author !== "string" || !author.trim()) {
    return Response.json({ error: "author is required" }, { status: 400 });
  }
  if (typeof content !== "string" || !content.trim()) {
    return Response.json({ error: "content is required" }, { status: 400 });
  }

  // 1. ユーザー発話を確定し、全員へ即配信（ロック外＝待たせない）。
  const message: Message = {
    id: newId("msg"),
    channelId: id,
    role: "user",
    author: author.trim(),
    content: content.trim(),
    createdAt: Date.now(),
    status: "complete",
  };
  await store.appendMessage(message);
  hub.publish(id, { type: "message", message });

  // 2. @assistant 等で呼ばれたときだけアシスタントのターンを起動する。
  //    呼ばれなければ人間同士の会話として配信のみ（アシスタントは黙っている）。
  const triggered = mentionsAssistant(message.content);
  if (triggered) {
    // 既に生成中なら「順番待ち」を全員に通知。
    if (lock.isBusy(id)) hub.setStatus(id, "queued");
    // リクエストの寿命から切り離して背景実行（投稿者がタブを閉じても継続）。
    void lock.run(id, () => runAssistantTurn(id));
    // 明示的に呼ばれたので、保留中の自発判定は取り消す。
    ambient.cancel(id);
  } else {
    // @なしの発言。アンビエントON なら一定の無発言後に自発判定を回す。
    ambient.scheduleAfterHumanMessage(id);
  }

  return Response.json(
    { accepted: true, messageId: message.id, triggeredAssistant: triggered },
    { status: 202 },
  );
}
