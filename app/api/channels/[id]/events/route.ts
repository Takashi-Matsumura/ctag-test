import { hub } from "@/lib/hub";
import { newId } from "@/lib/ids";
import type { ChannelEvent } from "@/lib/events";
import { SSE_HEADERS, SSE_KEEPALIVE, formatSSE } from "@/lib/sse";
import { store } from "@/lib/store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const channel = await store.getChannel(id);
  if (!channel) {
    return Response.json({ error: "channel not found" }, { status: 404 });
  }

  const url = new URL(request.url);
  const author = url.searchParams.get("author")?.trim() || "anonymous";
  const connId = newId("conn");
  const encoder = new TextEncoder();

  let closed = false;
  let unsubscribe: (() => void) | null = null;
  let keepAlive: ReturnType<typeof setInterval> | null = null;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (chunk: string) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          // 既にクローズ済み。
        }
      };

      // await 中に発生したイベントを取りこぼさないよう、先に購読してバッファ。
      let buffered: ChannelEvent[] | null = [];
      const listener = (event: ChannelEvent) => {
        if (buffered) buffered.push(event);
        else send(formatSSE(event));
      };
      unsubscribe = hub.subscribe(id, listener);

      // スナップショット（全履歴 + 進行中バッファ + 状態 + 参加者）を最初に送る。
      const messages = await store.getMessages(id);
      const live = hub.liveState(id);
      send(
        formatSSE({
          type: "snapshot",
          messages,
          streaming: live.streaming,
          status: live.status,
          participants: hub.participants(id),
        }),
      );

      // バッファに溜まった分を吐き出してからライブ配信へ切替。
      const pending = buffered;
      buffered = null;
      for (const event of pending) send(formatSSE(event));

      // 参加者として登録（presence を全員へ配信。自分にも届く）。
      hub.join(id, connId, author);

      keepAlive = setInterval(() => send(SSE_KEEPALIVE), 15_000);
    },

    cancel() {
      cleanup();
    },
  });

  function cleanup() {
    if (closed) return;
    closed = true;
    if (keepAlive) clearInterval(keepAlive);
    unsubscribe?.();
    hub.leave(id, connId);
  }

  // タブ閉じ/再読込/ネット切断（abort）でも確実に後始末。
  request.signal.addEventListener("abort", cleanup, { once: true });

  return new Response(stream, { headers: SSE_HEADERS });
}
