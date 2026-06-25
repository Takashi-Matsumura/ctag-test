"use client";

import { useCallback, useSyncExternalStore } from "react";
import Link from "next/link";
import type { Message } from "@/lib/store/types";
import { useChannelStream } from "@/lib/client/use-channel-stream";
import { Composer } from "@/components/composer";
import { IdentityGate } from "@/components/identity-gate";
import { MessageList } from "@/components/message-list";
import { PresenceBar } from "@/components/presence-bar";

const IDENTITY_KEY = "ctag.identity";

// 表示名(identity)を localStorage に保持する外部ストア。
// useSyncExternalStore で読むことで SSR ↔ クライアントのハイドレーション不整合を
// React が吸収し、effect 内 setState（lint 違反）も避けられる。
const identityListeners = new Set<() => void>();

function useIdentity(): readonly [string | null, (value: string | null) => void] {
  const subscribe = useCallback((cb: () => void) => {
    identityListeners.add(cb);
    window.addEventListener("storage", cb);
    return () => {
      identityListeners.delete(cb);
      window.removeEventListener("storage", cb);
    };
  }, []);

  const identity = useSyncExternalStore(
    subscribe,
    () => localStorage.getItem(IDENTITY_KEY),
    () => null, // サーバスナップショット（常に未設定）
  );

  const setIdentity = useCallback((value: string | null) => {
    if (value === null) localStorage.removeItem(IDENTITY_KEY);
    else localStorage.setItem(IDENTITY_KEY, value);
    identityListeners.forEach((l) => l()); // 同一タブにも変更を通知
  }, []);

  return [identity, setIdentity] as const;
}

function Room({
  channelId,
  channelName,
  identity,
  initialMessages,
  onChangeName,
}: {
  channelId: string;
  channelName: string;
  identity: string;
  initialMessages: Message[];
  onChangeName: () => void;
}) {
  const state = useChannelStream(channelId, identity, initialMessages);

  // 記憶の追加/削除トースト。表示・自動消去は CSS アニメーションに委ね、
  // key(memorySeq) の更新で要素を作り直して再生する（effect での setState を避ける）。
  const notice = state.memoryNotice;
  const toast = notice
    ? notice.action === "added"
      ? `🧠 覚えました: ${notice.text}`
      : `🧠 忘れました: ${notice.text}`
    : null;

  async function send(content: string) {
    const res = await fetch(`/api/channels/${channelId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ author: identity, content }),
    });
    if (!res.ok) throw new Error(`送信に失敗しました (${res.status})`);
  }

  async function toggleAmbient() {
    // 反映は SSE の ambient イベント経由（サーバが唯一の真実）。
    await fetch(`/api/channels/${channelId}/ambient`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: !state.ambient }),
    });
  }

  return (
    <div className="relative flex flex-1 flex-col">
      {toast && (
        <div
          key={state.memorySeq}
          className="memory-toast pointer-events-none absolute left-1/2 top-3 z-10 -translate-x-1/2"
        >
          <p className="rounded-full border border-green-500/40 bg-green-500/15 px-4 py-1.5 text-sm text-green-700 shadow-sm dark:text-green-300">
            {toast}
          </p>
        </div>
      )}
      <header className="space-y-2 border-b border-black/10 p-4 dark:border-white/15">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-baseline gap-3">
            <Link href="/" className="text-sm opacity-60 hover:underline">
              ← 一覧
            </Link>
            <h1 className="text-lg font-semibold">#{channelName}</h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={toggleAmbient}
              title="アンビエント（自発発言）モード: ONにすると、@なしの会話が一段落したときにアシスタントが役立つと判断すれば自分から発言します"
              className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${
                state.ambient
                  ? "border-green-500/40 bg-green-500/15 text-green-700 dark:text-green-300"
                  : "border-black/15 opacity-60 hover:opacity-100 dark:border-white/20"
              }`}
            >
              ✨ アンビエント: {state.ambient ? "ON" : "OFF"}
            </button>
            <button onClick={onChangeName} className="text-xs opacity-60 hover:underline">
              {identity} を変更
            </button>
          </div>
        </div>
        <PresenceBar
          participants={state.participants}
          status={state.status}
          connected={state.connected}
        />
      </header>

      {state.error && (
        <p className="bg-red-500/10 px-4 py-2 text-sm text-red-600 dark:text-red-400">
          {state.error}
        </p>
      )}

      <MessageList messages={state.messages} streaming={state.streaming} selfName={identity} />
      <Composer onSend={send} participants={state.participants} selfName={identity} />
    </div>
  );
}

export function ChannelView({
  channelId,
  channelName,
  initialMessages,
}: {
  channelId: string;
  channelName: string;
  initialMessages: Message[];
}) {
  const [identity, setIdentity] = useIdentity();

  if (!identity) {
    return <IdentityGate onSubmit={(name) => setIdentity(name)} />;
  }

  return (
    <Room
      channelId={channelId}
      channelName={channelName}
      identity={identity}
      initialMessages={initialMessages}
      onChangeName={() => setIdentity(null)}
    />
  );
}
