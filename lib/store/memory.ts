import { newId } from "@/lib/ids";
import { singleton } from "@/lib/singleton";
import type {
  Channel,
  ChannelStore,
  ChannelSummary,
  Message,
} from "@/lib/store/types";

interface ChannelRecord {
  meta: Channel;
  messages: Message[];
}

/**
 * プロセス内 in-memory ストア。
 * 単一プロセス前提なので配列 push の順序保証で十分（ロックは Runner 側で管理）。
 * プロセス再起動で状態は消える（v1 の既知制約）。
 *
 * データ(Map)だけを globalThis に固定し、インスタンス自体は固定しない。
 * こうすると dev の HMR でストアにメソッドを足しても、
 * データは保持されたまま新しいメソッドが反映される
 * （インスタンスを固定すると古い定義のまま生き残り「method is not a function」になる）。
 */
export class MemoryChannelStore implements ChannelStore {
  private channels = singleton(
    "store-data",
    () => new Map<string, ChannelRecord>(),
  );

  async createChannel(name: string): Promise<Channel> {
    const trimmed = name.trim() || "untitled";
    const meta: Channel = {
      id: newId("ch"),
      name: trimmed,
      createdAt: Date.now(),
    };
    this.channels.set(meta.id, { meta, messages: [] });
    return meta;
  }

  async getChannel(id: string): Promise<Channel | null> {
    return this.channels.get(id)?.meta ?? null;
  }

  async listChannels(): Promise<ChannelSummary[]> {
    return [...this.channels.values()]
      .map(({ meta, messages }) => ({
        ...meta,
        messageCount: messages.length,
        lastMessageAt: messages.at(-1)?.createdAt ?? null,
      }))
      .sort((a, b) => (b.lastMessageAt ?? b.createdAt) - (a.lastMessageAt ?? a.createdAt));
  }

  async deleteChannel(id: string): Promise<boolean> {
    return this.channels.delete(id);
  }

  async appendMessage(msg: Message): Promise<void> {
    const record = this.channels.get(msg.channelId);
    if (!record) throw new Error(`channel not found: ${msg.channelId}`);
    record.messages.push(msg);
  }

  async getMessages(channelId: string): Promise<Message[]> {
    return this.channels.get(channelId)?.messages ?? [];
  }
}
