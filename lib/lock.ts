import { singleton } from "@/lib/singleton";

/**
 * チャンネルごとに直列実行を保証するロック。
 * 「1チャンネル = 1体の共有アシスタント」を守るため、生成ターンを FIFO で並べる。
 * 複数ユーザーが同時に投稿しても、アシスタント応答は1つずつ進む。
 */
export class ChannelLock {
  private chains = new Map<string, Promise<unknown>>();

  /** task をそのチャンネルの順番待ち列の末尾に積み、前のタスク完了後に実行する。 */
  run<T>(channelId: string, task: () => Promise<T>): Promise<T> {
    const prev = this.chains.get(channelId) ?? Promise.resolve();
    const next = prev.catch(() => {}).then(task);
    this.chains.set(
      channelId,
      next.finally(() => {
        // 自分が最後尾のままなら掃除（後続が積まれていれば触らない）。
        if (this.chains.get(channelId) === next) this.chains.delete(channelId);
      }),
    );
    return next;
  }

  /** 現在そのチャンネルで実行中/待機中のタスクがあるか。 */
  isBusy(channelId: string): boolean {
    return this.chains.has(channelId);
  }
}

export const lock: ChannelLock = singleton("lock", () => new ChannelLock());
