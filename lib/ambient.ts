import { lock } from "@/lib/lock";
import { runAmbientTurn } from "@/lib/llm/runner";
import { singleton } from "@/lib/singleton";

/** 会話が止まってから自発判定するまでの待ち時間。 */
const IDLE_MS = 8000;
/** 自発発言した後、次に発言できるまでのクールダウン。 */
const COOLDOWN_MS = 25000;

/**
 * アンビエントモード管理。
 * チャンネルごとに ON/OFF を持ち、人間の発言（@なし）が止まって
 * 一定のアイドルになったら、ロック経由で自発判定（runAmbientTurn）を回す。
 * 常駐 Node プロセスのバックグラウンドタイマーで成立する。
 */
class AmbientManager {
  private enabled = new Set<string>();
  private timers = new Map<string, ReturnType<typeof setTimeout>>();
  private lastSpokeAt = new Map<string, number>();

  isEnabled(channelId: string): boolean {
    return this.enabled.has(channelId);
  }

  setEnabled(channelId: string, on: boolean): void {
    if (on) {
      this.enabled.add(channelId);
    } else {
      this.enabled.delete(channelId);
      this.clearTimer(channelId);
    }
  }

  /** @assistant で明示的に呼ばれたときなど、保留中の自発判定を取り消す。 */
  cancel(channelId: string): void {
    this.clearTimer(channelId);
  }

  /** 人間の発言（@なし）でアイドルタイマーを張り直す（連投はデバウンス）。 */
  scheduleAfterHumanMessage(channelId: string): void {
    if (!this.isEnabled(channelId)) return;
    this.clearTimer(channelId);
    const timer = setTimeout(() => {
      this.timers.delete(channelId);
      if (!this.isEnabled(channelId)) return;
      if (Date.now() - (this.lastSpokeAt.get(channelId) ?? 0) < COOLDOWN_MS) return;
      // ロック経由で直列化（通常の応答と競合しない）。役立てば発言、無ければ黙る。
      void lock
        .run(channelId, () => runAmbientTurn(channelId))
        .then((spoke) => {
          if (spoke) this.lastSpokeAt.set(channelId, Date.now());
        })
        .catch(() => {});
    }, IDLE_MS);
    this.timers.set(channelId, timer);
  }

  private clearTimer(channelId: string): void {
    const t = this.timers.get(channelId);
    if (t) {
      clearTimeout(t);
      this.timers.delete(channelId);
    }
  }
}

export const ambient: AmbientManager = singleton("ambient", () => new AmbientManager());
