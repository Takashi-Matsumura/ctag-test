import { EventEmitter } from "node:events";
import type { AssistantStatus, ChannelEvent } from "@/lib/events";
import { singleton } from "@/lib/singleton";

interface LiveState {
  status: AssistantStatus;
  /** 進行中アシスタントの途中バッファ（途中参加者へ snapshot で渡す）。 */
  streaming: { runId: string; text: string } | null;
}

type Listener = (event: ChannelEvent) => void;

/**
 * チャンネル単位の pub/sub ハブ。
 * - channelId をトピック名にした EventEmitter で全購読者へファンアウト
 * - presence（接続単位で参加者を追跡）
 * - liveState（進行中の生成バッファ/状態。snapshot 用）
 * 単一プロセス前提なので Redis 等の分散基盤は不要。
 */
export class Hub {
  private emitter = new EventEmitter();
  /** channelId -> (connId -> author)。同一人物の複数タブも個別接続として持つ。 */
  private connections = new Map<string, Map<string, string>>();
  private live = new Map<string, LiveState>();

  constructor() {
    // 多数の SSE 購読で MaxListenersExceededWarning を出さない。
    this.emitter.setMaxListeners(0);
  }

  /** 購読開始。返り値の関数で解除する（events route のクリーンアップで必ず呼ぶ）。 */
  subscribe(channelId: string, listener: Listener): () => void {
    this.emitter.on(channelId, listener);
    return () => this.emitter.off(channelId, listener);
  }

  /** 全購読者へイベント配信。 */
  publish(channelId: string, event: ChannelEvent): void {
    this.emitter.emit(channelId, event);
  }

  // --- presence ---

  join(channelId: string, connId: string, author: string): void {
    let conns = this.connections.get(channelId);
    if (!conns) this.connections.set(channelId, (conns = new Map()));
    conns.set(connId, author);
    this.publish(channelId, { type: "presence", participants: this.participants(channelId) });
  }

  leave(channelId: string, connId: string): void {
    const conns = this.connections.get(channelId);
    if (!conns) return;
    conns.delete(connId);
    if (conns.size === 0) this.connections.delete(channelId);
    this.publish(channelId, { type: "presence", participants: this.participants(channelId) });
  }

  /** 現在接続中の参加者（表示名の重複は排除）。 */
  participants(channelId: string): string[] {
    const conns = this.connections.get(channelId);
    if (!conns) return [];
    return [...new Set(conns.values())].sort();
  }

  // --- live state（Runner が更新、events route が snapshot 構築に参照）---

  liveState(channelId: string): LiveState {
    return this.live.get(channelId) ?? { status: "idle", streaming: null };
  }

  setStatus(channelId: string, status: AssistantStatus, runId?: string): void {
    const cur = this.liveState(channelId);
    this.live.set(channelId, { ...cur, status });
    this.publish(channelId, { type: "state", status, runId });
  }

  startStream(channelId: string, runId: string): void {
    this.live.set(channelId, { status: "streaming", streaming: { runId, text: "" } });
    this.publish(channelId, { type: "state", status: "streaming", runId });
  }

  appendStream(channelId: string, runId: string, text: string): void {
    const cur = this.liveState(channelId);
    if (cur.streaming?.runId === runId) cur.streaming.text += text;
    this.publish(channelId, { type: "token", runId, text });
  }

  endStream(channelId: string): void {
    this.live.set(channelId, { status: "idle", streaming: null });
  }
}

export const hub: Hub = singleton("hub", () => new Hub());
