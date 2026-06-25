import type { ChatMessage, StreamOpts } from "@/lib/llm/client";

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const t = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(t);
        resolve();
      },
      { once: true },
    );
  });
}

/**
 * 実LLM未接続でも全フロー（ストリーミング配信・複数タブ共有）を検証するためのモック。
 * LLM_DRIVER=mock で使う。数文字ずつ時間差で yield する。
 */
export async function* mockStream(
  messages: ChatMessage[],
  opts: StreamOpts = {},
): AsyncGenerator<string> {
  const last = messages.at(-1)?.content ?? "";
  const reply =
    `（モック応答）受け取りました: 「${last}」。` +
    `これはローカルLLM未接続のデモ応答です。` +
    `複数のタブで同じトークンが同時に流れていれば、マルチプレイヤー配信は機能しています。`;

  const tokens = reply.match(/.{1,2}/gu) ?? [reply];
  for (const t of tokens) {
    if (opts.signal?.aborted) return;
    await sleep(55, opts.signal);
    yield t;
  }
}
