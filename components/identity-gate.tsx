"use client";

import { useState } from "react";

/** 表示名(identity)を尋ねるゲート。設定するまでチャンネルには参加させない。 */
export function IdentityGate({ onSubmit }: { onSubmit: (name: string) => void }) {
  const [name, setName] = useState("");

  return (
    <div className="flex flex-1 items-center justify-center p-6">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const trimmed = name.trim();
          if (trimmed) onSubmit(trimmed);
        }}
        className="w-full max-w-sm space-y-4 rounded-lg border border-black/10 p-6 dark:border-white/15"
      >
        <div>
          <h2 className="text-lg font-semibold">表示名を入力</h2>
          <p className="mt-1 text-sm opacity-70">
            このチャンネルの全員にあなたの発言として表示されます。
          </p>
        </div>
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="例: たかし"
          className="w-full rounded-md border border-black/15 bg-transparent px-3 py-2 outline-none focus:border-black/40 dark:border-white/20 dark:focus:border-white/50"
        />
        <button
          type="submit"
          disabled={!name.trim()}
          className="w-full rounded-md bg-foreground px-3 py-2 text-background disabled:opacity-40"
        >
          参加する
        </button>
      </form>
    </div>
  );
}
