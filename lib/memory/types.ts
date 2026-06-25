/**
 * 記憶（長期記憶／会話要約）の型定義とストア抽象。
 * 会話状態（ChannelStore）とは別ライフサイクル（再起動でも残す）なので別立てにする。
 */

/** "global" = チャンネル横断。"channel" = 当該チャンネル限定。 */
export type MemoryScope = "global" | "channel";

/** fact=事実 / preference=好み / decision=決定 / summary=会話要約。 */
export type MemoryKind = "fact" | "preference" | "decision" | "summary";

/** explicit=「覚えて」明示指示 / auto=会話からの自動抽出 / summary=会話圧縮。 */
export type MemorySource = "explicit" | "auto" | "summary";

export interface MemoryItem {
  id: string; // newId("mem")
  scope: MemoryScope;
  /** scope==="channel" のときのみ。横断記憶は null。 */
  channelId: string | null;
  kind: MemoryKind;
  /** 記憶本文（system prompt に注入されるテキスト）。 */
  text: string;
  /** 記憶の主語（"@takashi の好み" 等の人物軸）。無ければ null。 */
  subject: string | null;
  source: MemorySource;
  /** 抽出/保存のきっかけになった発言者。 */
  author: string | null;
  /** embedding ベクトル。未取得（フォールバック時）は null。 */
  embedding: number[] | null;
  /** embedding を取ったモデル名。次元/モデル不一致の検出に使う。 */
  embeddingModel: string | null;
  createdAt: number;
  updatedAt: number;
  /** summary 記憶が「どのメッセージ時刻まで圧縮済みか」を指す（再要約の起点）。 */
  coveredUntil?: number;
}

/** 検索結果。score はコサイン類似度（degrade 時は 0）。 */
export interface MemoryHit {
  item: MemoryItem;
  score: number;
}

export interface MemoryQuery {
  /** 検索クエリ embedding。null なら degrade（最近の明示記憶優先で返す）。 */
  queryEmbedding: number[] | null;
  /** この channelId の channel 記憶 + 全 global 記憶を対象にする。 */
  channelId: string;
  topK: number;
  /** 類似度の足切り（これ未満は捨てる）。queryEmbedding が null なら無視。 */
  minScore?: number;
  /** 対象 kind を絞る（未指定なら全 kind）。 */
  kinds?: MemoryKind[];
}

/**
 * 記憶ストアの抽象。JSON ファイル実装（json-store）と揮発実装を同一クラスの
 * persist フラグで切り替える。
 */
export interface MemoryStore {
  add(item: MemoryItem): Promise<MemoryItem>;
  /** 一覧（新しい順）。scope / channelId で絞り込み可。未指定なら全件。 */
  list(opts?: { scope?: MemoryScope; channelId?: string | null }): Promise<MemoryItem[]>;
  get(id: string): Promise<MemoryItem | null>;
  delete(id: string): Promise<boolean>;
  /** 部分更新（summary の再要約などで使う）。無ければ null。 */
  update(id: string, patch: Partial<MemoryItem>): Promise<MemoryItem | null>;
  /** 関連記憶を検索（コサイン類似度上位 K 件。degrade 対応）。 */
  search(q: MemoryQuery): Promise<MemoryHit[]>;
}
