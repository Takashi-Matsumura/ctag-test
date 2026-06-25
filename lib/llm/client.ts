import { env } from "@/lib/env";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface StreamOpts {
  signal?: AbortSignal;
}

/**
 * OpenAI 互換 /v1/chat/completions に stream:true で接続し、
 * delta.content を逐次 yield する async generator。
 * 依存ゼロ・寛容パーサ（空行 / `data: [DONE]` / 非JSON行は無視）。
 */
export async function* streamChat(
  messages: ChatMessage[],
  opts: StreamOpts = {},
): AsyncGenerator<string> {
  const body: Record<string, unknown> = {
    model: env.llmModel,
    messages,
    stream: true,
  };
  // 推論モデルの思考を切って即レスにする（llama.cpp/Gemma 等）。
  if (env.llmNoThink) {
    body.chat_template_kwargs = { enable_thinking: false };
  }

  const res = await fetch(`${env.llmBaseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.llmApiKey}`,
    },
    body: JSON.stringify(body),
    signal: opts.signal,
  });

  if (!res.ok || !res.body) {
    const detail = await res.text().catch(() => "");
    throw new Error(`LLM request failed: ${res.status} ${detail.slice(0, 200)}`);
  }

  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += value;

    // SSE フレームは空行（\n\n）区切り。最後の不完全フレームは次ループへ持ち越す。
    const frames = buffer.split("\n\n");
    buffer = frames.pop() ?? "";

    for (const frame of frames) {
      for (const line of frame.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) continue;
        const data = trimmed.slice(5).trim();
        if (data === "[DONE]") return;
        try {
          const json = JSON.parse(data);
          const delta: unknown = json?.choices?.[0]?.delta?.content;
          if (typeof delta === "string" && delta) yield delta;
        } catch {
          // 非JSON行は無視
        }
      }
    }
  }
}
