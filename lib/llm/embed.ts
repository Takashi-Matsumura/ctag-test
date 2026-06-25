import { env } from "@/lib/env";

/**
 * OpenAI 互換 /v1/embeddings クライアント（依存ゼロ・fetch ベース）。
 * embedding 用エンドポイントは生成モデルと別ポート/別モデルになりうるので
 * env.embedBaseUrl / env.embedModel を生成系と独立に持つ。
 * 記憶機能はベストエフォート: 未設定や失敗時は null を返し、呼び出し側が degrade する
 * （本流の応答は止めない）。
 */

export interface EmbedOpts {
  signal?: AbortSignal;
}

/** embedding が使えるか（env が揃い、かつ mock でない）。 */
export function embeddingEnabled(): boolean {
  return env.embedEnabled;
}

/** 1件 embed。未設定/失敗なら null。 */
export async function embedText(text: string, opts: EmbedOpts = {}): Promise<number[] | null> {
  const [vec] = await embedTexts([text], opts);
  return vec ?? null;
}

/** 複数まとめて embed（自動抽出のバッチ用）。未設定/失敗なら全 null。 */
export async function embedTexts(
  texts: string[],
  opts: EmbedOpts = {},
): Promise<(number[] | null)[]> {
  if (!env.embedEnabled || texts.length === 0) return texts.map(() => null);

  try {
    const res = await fetch(`${env.embedBaseUrl}/embeddings`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.embedApiKey}`,
      },
      body: JSON.stringify({ model: env.embedModel, input: texts }),
      signal: opts.signal,
    });

    if (!res.ok) {
      console.warn(`[memory] embeddings request failed: ${res.status}`);
      return texts.map(() => null);
    }

    const json = await res.json();
    const data: unknown = json?.data;
    if (!Array.isArray(data)) return texts.map(() => null);

    // OpenAI 互換: data[i].embedding が input[i] に対応（index 順）。
    return texts.map((_, i) => {
      const emb = (data[i] as { embedding?: unknown } | undefined)?.embedding;
      return Array.isArray(emb) ? (emb as number[]) : null;
    });
  } catch (err) {
    console.warn("[memory] embeddings error:", err instanceof Error ? err.message : err);
    return texts.map(() => null);
  }
}
