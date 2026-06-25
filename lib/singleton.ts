/**
 * dev のホットリロードや Route モジュールの再評価で
 * インスタンスが作り直されると、Hub の購読者が孤児化したり
 * in-memory の状態が消えたりする。
 * globalThis にピン留めして「プロセス内で唯一」を保証する。
 */
export function singleton<T>(key: string, create: () => T): T {
  const g = globalThis as unknown as Record<string, T | undefined>;
  const pinned = `__ctag_${key}__`;
  return (g[pinned] ??= create()) as T;
}
