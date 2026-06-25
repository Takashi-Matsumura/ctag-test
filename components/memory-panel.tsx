"use client";

import { useEffect, useState } from "react";

interface MemoryRow {
  id: string;
  scope: "global" | "channel";
  channelId: string | null;
  kind: "fact" | "preference" | "decision" | "summary";
  text: string;
  source: "explicit" | "auto" | "summary";
  author: string | null;
  createdAt: number;
}

const KIND_LABEL: Record<MemoryRow["kind"], string> = {
  fact: "事実",
  preference: "好み",
  decision: "決定",
  summary: "要約",
};
const SOURCE_LABEL: Record<MemoryRow["source"], string> = {
  explicit: "覚えて",
  auto: "自動",
  summary: "要約",
};

/**
 * 記憶パネル（右ドロワー）。一覧表示と削除のみ。
 * - 取得は REST（GET）。記憶イベントで増減したら refreshKey を変えて再取得する。
 * - 削除は DELETE。反映は SSE の memory イベント→refreshKey 更新で再取得（サーバが唯一の真実）。
 */
export function MemoryPanel({
  channelId,
  refreshKey,
  onClose,
}: {
  channelId: string;
  refreshKey: number;
  onClose: () => void;
}) {
  const [memories, setMemories] = useState<MemoryRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/channels/${channelId}/memories`)
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled) setMemories((d?.memories as MemoryRow[]) ?? []);
      })
      .catch(() => {
        if (!cancelled) setError("記憶の取得に失敗しました");
      });
    return () => {
      cancelled = true;
    };
  }, [channelId, refreshKey]);

  async function remove(id: string) {
    await fetch(`/api/channels/${channelId}/memories?memoryId=${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    // 一覧の更新は memory(removed) イベント → refreshKey 更新による再取得に任せる。
  }

  return (
    <div className="fixed inset-0 z-30 flex justify-end">
      {/* 背景クリックで閉じる */}
      <button
        aria-label="閉じる"
        onClick={onClose}
        className="flex-1 cursor-default bg-black/20"
      />
      <aside className="flex h-full w-80 max-w-[85vw] flex-col border-l border-black/10 bg-[var(--background)] shadow-xl dark:border-white/15">
        <header className="flex items-center justify-between border-b border-black/10 p-4 dark:border-white/15">
          <h2 className="text-sm font-semibold">🧠 記憶</h2>
          <button onClick={onClose} className="text-sm opacity-60 hover:opacity-100">
            閉じる
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          {error && <p className="px-1 py-2 text-sm text-red-600 dark:text-red-400">{error}</p>}
          {!error && memories === null && (
            <p className="px-1 py-2 text-sm opacity-60">読み込み中…</p>
          )}
          {!error && memories?.length === 0 && (
            <p className="px-1 py-2 text-sm opacity-60">
              まだ記憶はありません。「@assistant 覚えて: …」で追加できます。
            </p>
          )}

          <ul className="space-y-2">
            {memories?.map((m) => (
              <li
                key={m.id}
                className="group rounded-lg border border-black/10 p-2.5 dark:border-white/15"
              >
                <div className="mb-1 flex items-center gap-1.5 text-[10px]">
                  <span
                    className={`rounded-full px-1.5 py-0.5 ${
                      m.scope === "global"
                        ? "bg-amber-500/15 text-amber-700 dark:text-amber-300"
                        : "bg-sky-500/15 text-sky-700 dark:text-sky-300"
                    }`}
                  >
                    {m.scope === "global" ? "全体" : "このch"}
                  </span>
                  <span className="rounded-full bg-black/5 px-1.5 py-0.5 opacity-70 dark:bg-white/10">
                    {KIND_LABEL[m.kind]}
                  </span>
                  <span className="rounded-full bg-black/5 px-1.5 py-0.5 opacity-70 dark:bg-white/10">
                    {SOURCE_LABEL[m.source]}
                  </span>
                  <button
                    onClick={() => remove(m.id)}
                    title="この記憶を忘れる"
                    className="ml-auto rounded px-1 text-red-600 opacity-0 transition-opacity hover:bg-red-500/10 group-hover:opacity-100 dark:text-red-400"
                  >
                    削除
                  </button>
                </div>
                <p className="whitespace-pre-wrap text-sm">{m.text}</p>
                {m.author && (
                  <p className="mt-0.5 text-[11px] opacity-50">— {m.author}</p>
                )}
              </li>
            ))}
          </ul>
        </div>
      </aside>
    </div>
  );
}
