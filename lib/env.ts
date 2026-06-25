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

  // --- 記憶ストア ---
  /** "json"(既定・永続) / "memory"(揮発) / "off"(記憶機能を完全無効化)。 */
  memoryDriver: process.env.MEMORY_DRIVER ?? "json",
  /** JSON ドライバの保存先（cwd 相対）。 */
  memoryFile: process.env.MEMORY_FILE ?? ".data/memories.json",

  // --- Embedding（生成モデルとは独立。別ポート/別モデルになりうる） ---
  /** 例: http://localhost:8081/v1（llama.cpp --embeddings 別ポート）。未設定なら想起は degrade。 */
  embedBaseUrl: process.env.LLM_EMBED_BASE_URL ?? "",
  embedModel: process.env.LLM_EMBED_MODEL ?? "",
  embedApiKey: process.env.LLM_EMBED_API_KEY ?? process.env.LLM_API_KEY ?? "not-needed",
  /** base/model が両方設定され、かつ実LLM(mock以外)のときだけ embedding を使う。 */
  embedEnabled:
    Boolean(process.env.LLM_EMBED_BASE_URL && process.env.LLM_EMBED_MODEL) &&
    (process.env.LLM_DRIVER ?? "mock") !== "mock",

  // --- 想起/抽出/要約のチューニング ---
  recallTopK: Number(process.env.MEMORY_RECALL_TOPK ?? 6),
  recallMinScore: Number(process.env.MEMORY_RECALL_MIN_SCORE ?? 0.3),
  /** これを超えたら背景で要約を始める履歴件数。 */
  summaryThreshold: Number(process.env.MEMORY_SUMMARY_THRESHOLD ?? 40),
  /** 要約対象から除外する直近件数（生注入する窓）。 */
  recentWindow: Number(process.env.MEMORY_RECENT_WINDOW ?? 20),
  /** 何ユーザーターンごとに自動抽出するか。 */
  extractEveryNTurns: Number(process.env.MEMORY_EXTRACT_EVERY ?? 5),
} as const;
