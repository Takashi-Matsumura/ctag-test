export type Role = "user" | "assistant";

export interface Message {
  id: string;
  channelId: string;
  role: Role;
  /** 表示名(identity)。assistant の場合は "assistant" 固定。 */
  author: string;
  content: string;
  createdAt: number;
  /** assistant メッセージの生成状態。確定済みは "complete"。 */
  status?: "streaming" | "complete";
}

export interface Channel {
  id: string;
  name: string;
  createdAt: number;
}

export interface ChannelSummary extends Channel {
  messageCount: number;
  lastMessageAt: number | null;
}

/**
 * 会話状態ストアの抽象。v1 は in-memory 実装のみ。
 * 永続化(SQLite/JSON)はこの interface を実装し直すだけで差し替え可能。
 */
export interface ChannelStore {
  createChannel(name: string): Promise<Channel>;
  getChannel(id: string): Promise<Channel | null>;
  listChannels(): Promise<ChannelSummary[]>;
  /** 削除。存在して削除できたら true、無ければ false。 */
  deleteChannel(id: string): Promise<boolean>;
  appendMessage(msg: Message): Promise<void>;
  getMessages(channelId: string): Promise<Message[]>;
}
