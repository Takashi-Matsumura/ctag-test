import { hub } from "@/lib/hub";
import { store } from "@/lib/store";

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
  const messages = await store.getMessages(id);
  return Response.json({ channel, messages });
}

export async function DELETE(
  _request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const existed = await store.deleteChannel(id);
  if (!existed) {
    return Response.json({ error: "channel not found" }, { status: 404 });
  }
  // 開いている購読者へ削除を通知（バナー表示の手がかり）。
  hub.publish(id, { type: "error", message: "このチャンネルは削除されました。" });
  return Response.json({ deleted: true });
}
