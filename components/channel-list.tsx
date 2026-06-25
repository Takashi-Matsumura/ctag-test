"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { ChannelSummary } from "@/lib/store/types";

export function ChannelList({ channels }: { channels: ChannelSummary[] }) {
  const router = useRouter();
  const [deleting, setDeleting] = useState<string | null>(null);

  async function remove(id: string, name: string) {
    if (!confirm(`#${name} を削除しますか？\n全員の会話履歴も消えます（取り消せません）。`)) return;
    setDeleting(id);
    try {
      const res = await fetch(`/api/channels/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`削除に失敗しました (${res.status})`);
      router.refresh(); // サーバコンポーネントの一覧を再取得
    } finally {
      setDeleting(null);
    }
  }

  return (
    <ul className="flex flex-col gap-2">
      {channels.map((c) => (
        <li key={c.id} className="flex items-center gap-2">
          <Link
            href={`/channels/${c.id}`}
            className="flex flex-1 items-center justify-between rounded-md border border-black/10 px-4 py-3 hover:bg-black/[.03] dark:border-white/15 dark:hover:bg-white/[.05]"
          >
            <span className="font-medium">#{c.name}</span>
            <span className="text-xs opacity-60">{c.messageCount} 件</span>
          </Link>
          <button
            onClick={() => remove(c.id, c.name)}
            disabled={deleting === c.id}
            aria-label={`#${c.name} を削除`}
            title="削除"
            className="rounded-md border border-black/10 px-3 py-3 text-sm opacity-60 hover:bg-red-500/10 hover:text-red-600 hover:opacity-100 disabled:opacity-30 dark:border-white/15 dark:hover:text-red-400"
          >
            {deleting === c.id ? "…" : "🗑"}
          </button>
        </li>
      ))}
    </ul>
  );
}
