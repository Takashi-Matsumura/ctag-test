import { hub } from "@/lib/hub";
import { memoryStore } from "@/lib/memory/index";
import { store } from "@/lib/store";

export const dynamic = "force-dynamic";

/** このチャンネルから見える記憶（global + 当該ch）を新しい順で返す。 */
export async function GET(
  _request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const channel = await store.getChannel(id);
  if (!channel) {
    return Response.json({ error: "channel not found" }, { status: 404 });
  }

  const all = await memoryStore.list(); // 新しい順
  // ベクトル(embedding)は重く UI に不要なので返さない。
  const memories = all
    .filter((m) => m.scope === "global" || m.channelId === id)
    .map((m) => ({
      id: m.id,
      scope: m.scope,
      channelId: m.channelId,
      kind: m.kind,
      text: m.text,
      source: m.source,
      author: m.author,
      createdAt: m.createdAt,
    }));

  return Response.json({ memories });
}

/** 記憶を1件削除する（?memoryId=...）。削除を全員のUIへ配信する。 */
export async function DELETE(
  request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const channel = await store.getChannel(id);
  if (!channel) {
    return Response.json({ error: "channel not found" }, { status: 404 });
  }

  const memoryId = new URL(request.url).searchParams.get("memoryId");
  if (!memoryId) {
    return Response.json({ error: "memoryId is required" }, { status: 400 });
  }

  const target = await memoryStore.get(memoryId);
  const deleted = target ? await memoryStore.delete(memoryId) : false;
  if (!target || !deleted) {
    return Response.json({ error: "memory not found" }, { status: 404 });
  }

  // 反映は SSE の memory イベント経由（サーバが唯一の真実）。
  hub.publish(id, {
    type: "memory",
    action: "removed",
    item: { id: target.id, text: target.text, scope: target.scope, kind: target.kind },
  });
  return Response.json({ deleted: true });
}
