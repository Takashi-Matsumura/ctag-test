import { ambient } from "@/lib/ambient";
import { hub } from "@/lib/hub";
import { store } from "@/lib/store";

export const dynamic = "force-dynamic";

/** アンビエント（自発発言）モードの ON/OFF を切り替える。 */
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
  const enabled = Boolean((body as { enabled?: unknown })?.enabled);

  ambient.setEnabled(id, enabled);
  // 全員のUIへ反映。
  hub.publish(id, { type: "ambient", enabled });
  return Response.json({ enabled });
}
