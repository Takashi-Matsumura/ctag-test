import { env } from "@/lib/env";
import { streamChat, type ChatMessage, type StreamOpts } from "@/lib/llm/client";
import { mockStream } from "@/lib/llm/mock";

/**
 * ストリームを最後まで読み切って全文を返す（抽出/要約など内部処理用）。
 * トークン配信は不要で、生成結果だけが欲しいケースに使う。
 */
export async function completeChat(messages: ChatMessage[], opts: StreamOpts = {}): Promise<string> {
  const generate = env.llmDriver === "mock" ? mockStream : streamChat;
  let text = "";
  for await (const delta of generate(messages, opts)) text += delta;
  return text;
}
