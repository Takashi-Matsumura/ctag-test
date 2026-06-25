"use client";

import { useEffect, useReducer } from "react";
import type { AssistantStatus, ChannelEvent } from "@/lib/events";
import type { Message } from "@/lib/store/types";

export interface StreamState {
  messages: Message[];
  streaming: { runId: string; text: string } | null;
  status: AssistantStatus;
  participants: string[];
  ambient: boolean;
  /** 直近の記憶追加/削除（トースト用）。 */
  memoryNotice: { action: "added" | "removed"; text: string } | null;
  /** 記憶イベントの連番。トースト要素の key にしてアニメーションを再生する。 */
  memorySeq: number;
  error: string | null;
  connected: boolean;
}

type Action =
  | { kind: "event"; event: ChannelEvent }
  | { kind: "open" }
  | { kind: "disconnected" };

function upsert(messages: Message[], msg: Message): Message[] {
  if (messages.some((m) => m.id === msg.id)) return messages;
  return [...messages, msg];
}

function reducer(state: StreamState, action: Action): StreamState {
  if (action.kind === "open") return { ...state, connected: true };
  if (action.kind === "disconnected") return { ...state, connected: false };

  const event = action.event;
  switch (event.type) {
    case "snapshot":
      // 再接続時も含め、サーバの全状態で置き換える（取りこぼし無く整合）。
      return {
        ...state,
        messages: event.messages,
        streaming: event.streaming,
        status: event.status,
        participants: event.participants,
        ambient: event.ambient,
        error: null,
      };
    case "message": {
      const messages = upsert(state.messages, event.message);
      // アシスタントの確定メッセージが来たら進行中バッファを畳む。
      const streaming = event.message.role === "assistant" ? null : state.streaming;
      return { ...state, messages, streaming };
    }
    case "token": {
      const cur = state.streaming;
      const streaming =
        cur && cur.runId === event.runId
          ? { runId: cur.runId, text: cur.text + event.text }
          : { runId: event.runId, text: event.text };
      return { ...state, streaming };
    }
    case "state": {
      // idle に戻ったら進行中バッファをクリア（エラー時の取り残し対策）。
      const streaming = event.status === "idle" ? null : state.streaming;
      return { ...state, status: event.status, streaming };
    }
    case "presence":
      return { ...state, participants: event.participants };
    case "ambient":
      return { ...state, ambient: event.enabled };
    case "memory":
      return {
        ...state,
        memoryNotice: { action: event.action, text: event.item.text },
        memorySeq: state.memorySeq + 1,
      };
    case "error":
      return { ...state, error: event.message };
    default:
      return state;
  }
}

const EVENT_TYPES = ["snapshot", "message", "token", "state", "presence", "ambient", "memory", "error"] as const;

/**
 * チャンネルの SSE を購読し、単方向イベントから単一 state を構築する。
 * 「サーバが唯一の真実、クライアントはその投影」を徹底することで
 * マルチプレイヤーの整合性を最も単純に保証する。
 */
export function useChannelStream(
  channelId: string,
  identity: string,
  initialMessages: Message[],
): StreamState {
  const [state, dispatch] = useReducer(reducer, {
    messages: initialMessages,
    streaming: null,
    status: "idle",
    participants: [],
    ambient: false,
    memoryNotice: null,
    memorySeq: 0,
    error: null,
    connected: false,
  });

  useEffect(() => {
    const es = new EventSource(
      `/api/channels/${channelId}/events?author=${encodeURIComponent(identity)}`,
    );
    es.onopen = () => dispatch({ kind: "open" });
    es.onerror = () => dispatch({ kind: "disconnected" }); // EventSource は自動再接続する

    const handlers = EVENT_TYPES.map((type) => {
      const handler = (e: MessageEvent) => {
        try {
          dispatch({ kind: "event", event: JSON.parse(e.data) as ChannelEvent });
        } catch {
          // 壊れたフレームは無視
        }
      };
      es.addEventListener(type, handler);
      return [type, handler] as const;
    });

    return () => {
      for (const [type, handler] of handlers) es.removeEventListener(type, handler);
      es.close();
    };
  }, [channelId, identity]);

  return state;
}
