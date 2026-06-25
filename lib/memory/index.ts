import { env } from "@/lib/env";
import { JsonMemoryStore } from "@/lib/memory/json-store";
import type { MemoryStore } from "@/lib/memory/types";

/**
 * 記憶機能を完全無効化するための no-op ストア（MEMORY_DRIVER=off）。
 * 既存挙動への後方互換を1スイッチで保証する。
 */
class NullMemoryStore implements MemoryStore {
  async add(item: Parameters<MemoryStore["add"]>[0]) {
    return item;
  }
  async list() {
    return [];
  }
  async get() {
    return null;
  }
  async delete() {
    return false;
  }
  async update() {
    return null;
  }
  async search() {
    return [];
  }
}

function createMemoryStore(): MemoryStore {
  switch (env.memoryDriver) {
    case "json":
      return new JsonMemoryStore({ persist: true, file: env.memoryFile });
    case "memory":
      return new JsonMemoryStore({ persist: false, file: env.memoryFile });
    case "off":
      return new NullMemoryStore();
    default:
      throw new Error(`unknown MEMORY_DRIVER: ${env.memoryDriver}`);
  }
}

/** 記憶機能が有効か（off 以外）。呼び出し側の早期 return に使える。 */
export const memoryEnabled = env.memoryDriver !== "off";

/**
 * 呼び出し側は interface だけを参照する。
 * インスタンスは固定しない（状態は JsonMemoryStore が globalThis に固定）。
 */
export const memoryStore: MemoryStore = createMemoryStore();
