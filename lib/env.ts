/**
 * 環境変数の集中読み出し。
 * LLM は汎用 OpenAI 互換エンドポイント（/v1/chat/completions, stream対応）を前提とし、
 * base URL / モデル / API キーを env で差し替える。
 */
export const env = {
  /** "mock" なら実LLM無しでモック生成。"openai" で OpenAI互換エンドポイントを叩く。 */
  llmDriver: process.env.LLM_DRIVER ?? "mock",
  /** 例: http://localhost:8080/v1 (llama.cpp) / http://localhost:11434/v1 (Ollama) */
  llmBaseUrl: process.env.LLM_BASE_URL ?? "http://localhost:8080/v1",
  llmModel: process.env.LLM_MODEL ?? "local-model",
  /** 多くのローカルサーバはキー不要。ダミーでよい。 */
  llmApiKey: process.env.LLM_API_KEY ?? "not-needed",
  /**
   * 推論(thinking)モデルの思考フェーズを無効化するか。
   * 有効だと llama.cpp/Gemma 等へ chat_template_kwargs.enable_thinking=false を送り、
   * 「考え中…」の長い間を無くして即レスにする。
   * 厳格な OpenAI 互換サーバ（未知パラメータを 400 にする）では "0" にして無効化。
   */
  llmNoThink: (process.env.LLM_NO_THINK ?? "1") !== "0",
  /** v1 は "memory" のみ。後で "sqlite" / "json" を足せる。 */
  storeDriver: process.env.STORE_DRIVER ?? "memory",
} as const;
