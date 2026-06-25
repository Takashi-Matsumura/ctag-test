import type { ChannelEvent } from "@/lib/events";

/** ChannelEvent を SSE のワイヤ形式（event: 行 + data: 行）に整形。 */
export function formatSSE(event: ChannelEvent): string {
  return `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;
}

/** プロキシ/ブラウザのアイドル切断を防ぐ keep-alive コメント行。 */
export const SSE_KEEPALIVE = ":\n\n";

export const SSE_HEADERS = {
  "Content-Type": "text/event-stream; charset=utf-8",
  "Cache-Control": "no-cache, no-transform",
  Connection: "keep-alive",
  // nginx 等のバッファリングでストリームが止まらないように。
  "X-Accel-Buffering": "no",
} as const;
