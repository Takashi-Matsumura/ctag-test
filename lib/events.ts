import type { Message } from "@/lib/store/types";

export type AssistantStatus = "idle" | "queued" | "thinking" | "streaming";

/**
 * SSE で全購読者に配信されるチャンネルイベント。
 * `type` を SSE の event 名に、本体を data(JSON) に載せる。
 */
export type ChannelEvent =
  /** 接続直後のスナップショット。reducer はこれで state を全置換する。 */
  | {
      type: "snapshot";
      messages: Message[];
      streaming: { runId: string; text: string } | null;
      status: AssistantStatus;
      participants: string[];
    }
  /** 確定したメッセージ1件（user 発話 / assistant 完了）。 */
  | { type: "message"; message: Message }
  /** 進行中アシスタントの追加トークン。 */
  | { type: "token"; runId: string; text: string }
  /** アシスタントの状態遷移。 */
  | { type: "state"; status: AssistantStatus; runId?: string }
  /** 参加者一覧の変化。 */
  | { type: "presence"; participants: string[] }
  /** 生成エラー等。 */
  | { type: "error"; message: string };
