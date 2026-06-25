"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function NewChannelForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [pending, setPending] = useState(false);

  async function submit() {
    const n = name.trim();
    if (!n || pending) return;
    setPending(true);
    try {
      const res = await fetch("/api/channels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: n }),
      });
      if (!res.ok) throw new Error(`作成に失敗しました (${res.status})`);
      const { channel } = await res.json();
      router.push(`/channels/${channel.id}`);
    } finally {
      setPending(false);
    }
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
      className="flex gap-2"
    >
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="新しいチャンネル名"
        className="flex-1 rounded-md border border-black/15 bg-transparent px-3 py-2 text-sm outline-none focus:border-black/40 dark:border-white/20 dark:focus:border-white/50"
      />
      <button
        type="submit"
        disabled={pending || !name.trim()}
        className="rounded-md bg-foreground px-4 py-2 text-sm text-background disabled:opacity-40"
      >
        作成
      </button>
    </form>
  );
}
