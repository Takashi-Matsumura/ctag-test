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

  async function send(content: string) {
    const res = await fetch(`/api/channels/${channelId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ author: identity, content }),
    });
    if (!res.ok) throw new Error(`送信に失敗しました (${res.status})`);
  }

  return (
    <div className="flex flex-1 flex-col">
      <header className="space-y-2 border-b border-black/10 p-4 dark:border-white/15">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-baseline gap-3">
            <Link href="/" className="text-sm opacity-60 hover:underline">
              ← 一覧
            </Link>
            <h1 className="text-lg font-semibold">#{channelName}</h1>
          </div>
          <button onClick={onChangeName} className="text-xs opacity-60 hover:underline">
            {identity} を変更
          </button>
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
      <Composer onSend={send} />
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
