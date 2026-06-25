import { env } from "@/lib/env";
import { MemoryChannelStore } from "@/lib/store/memory";
import { SqliteChannelStore } from "@/lib/store/sqlite";
import type { ChannelStore } from "@/lib/store/types";

function createStore(): ChannelStore {
  switch (env.storeDriver) {
    case "memory":
      return new MemoryChannelStore();
    case "sqlite":
      return new SqliteChannelStore();
    default:
      throw new Error(`unknown STORE_DRIVER: ${env.storeDriver}`);
  }
}

/**
 * 呼び出し側は interface だけを参照する（具象は知らない）。
 * インスタンスは固定しない（メソッド追加が dev に反映されるように）。
 * 状態は MemoryChannelStore が globalThis に固定したデータ側で保持する。
 */
export const store: ChannelStore = createStore();
