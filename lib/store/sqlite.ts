import fs from "fs";
import path from "path";
import Database from "better-sqlite3";
import { newId } from "@/lib/ids";
import { singleton } from "@/lib/singleton";
import { env } from "@/lib/env";
import type {
  Channel,
  ChannelStore,
  ChannelSummary,
  Message,
} from "@/lib/store/types";

function openDb(): Database.Database {
  const file = path.resolve(process.cwd(), env.storeFile);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new Database(file);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.exec(`
    CREATE TABLE IF NOT EXISTS channels (
      id         TEXT PRIMARY KEY,
      name       TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS messages (
      id         TEXT PRIMARY KEY,
      channel_id TEXT NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
      role       TEXT NOT NULL,
      author     TEXT NOT NULL,
      content    TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      status     TEXT,
      ambient    INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS idx_messages_channel_id ON messages(channel_id);
  `);
  return db;
}

export class SqliteChannelStore implements ChannelStore {
  private db = singleton("sqlite-db", openDb);

  async createChannel(name: string): Promise<Channel> {
    const meta: Channel = {
      id: newId("ch"),
      name: name.trim() || "untitled",
      createdAt: Date.now(),
    };
    this.db
      .prepare("INSERT INTO channels (id, name, created_at) VALUES (?, ?, ?)")
      .run(meta.id, meta.name, meta.createdAt);
    return meta;
  }

  async getChannel(id: string): Promise<Channel | null> {
    const row = this.db
      .prepare("SELECT id, name, created_at FROM channels WHERE id = ?")
      .get(id) as { id: string; name: string; created_at: number } | undefined;
    if (!row) return null;
    return { id: row.id, name: row.name, createdAt: row.created_at };
  }

  async listChannels(): Promise<ChannelSummary[]> {
    const rows = this.db
      .prepare(
        `SELECT c.id, c.name, c.created_at,
                COUNT(m.id) AS message_count,
                MAX(m.created_at) AS last_message_at
         FROM channels c
         LEFT JOIN messages m ON m.channel_id = c.id
         GROUP BY c.id
         ORDER BY COALESCE(MAX(m.created_at), c.created_at) DESC`,
      )
      .all() as {
      id: string;
      name: string;
      created_at: number;
      message_count: number;
      last_message_at: number | null;
    }[];
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      createdAt: r.created_at,
      messageCount: r.message_count,
      lastMessageAt: r.last_message_at,
    }));
  }

  async deleteChannel(id: string): Promise<boolean> {
    const result = this.db
      .prepare("DELETE FROM channels WHERE id = ?")
      .run(id);
    return result.changes > 0;
  }

  async appendMessage(msg: Message): Promise<void> {
    this.db
      .prepare(
        `INSERT INTO messages (id, channel_id, role, author, content, created_at, status, ambient)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        msg.id,
        msg.channelId,
        msg.role,
        msg.author,
        msg.content,
        msg.createdAt,
        msg.status ?? null,
        msg.ambient ? 1 : 0,
      );
  }

  async getMessages(channelId: string): Promise<Message[]> {
    const rows = this.db
      .prepare(
        `SELECT id, channel_id, role, author, content, created_at, status, ambient
         FROM messages WHERE channel_id = ? ORDER BY created_at ASC`,
      )
      .all(channelId) as {
      id: string;
      channel_id: string;
      role: "user" | "assistant";
      author: string;
      content: string;
      created_at: number;
      status: string | null;
      ambient: number;
    }[];
    return rows.map((r) => ({
      id: r.id,
      channelId: r.channel_id,
      role: r.role,
      author: r.author,
      content: r.content,
      createdAt: r.created_at,
      ...(r.status ? { status: r.status as Message["status"] } : {}),
      ...(r.ambient ? { ambient: true } : {}),
    }));
  }
}
