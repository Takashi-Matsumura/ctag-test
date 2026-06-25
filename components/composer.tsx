"use client";

import { useState } from "react";

export function Composer({ onSend }: { onSend: (content: string) => Promise<void> }) {
  const [text, setText] = useState("");
  const [pending, setPending] = useState(false);

  async function submit() {
    const content = text.trim();
    if (!content || pending) return;
    setPending(true);
    try {
      await onSend(content);
      setText(""); // 送信成功後にクリア（自分の発話も SSE 経由で表示される）。
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="border-t border-black/10 dark:border-white/15">
      <p className="px-3 pt-2 text-xs opacity-50">
        ヒント: <code className="rounded bg-black/[.06] px-1 dark:bg-white/[.12]">@assistant</code>{" "}
        を付けるとアシスタントが応答します（付けなければ参加者同士の会話）。
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
        className="flex items-end gap-2 p-3"
      >
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            // Enter で送信、Shift+Enter で改行。
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void submit();
            }
          }}
          rows={1}
          placeholder="メッセージを入力（@assistant で呼び出し・Enterで送信）"
          className="max-h-32 flex-1 resize-none rounded-md border border-black/15 bg-transparent px-3 py-2 text-sm outline-none focus:border-black/40 dark:border-white/20 dark:focus:border-white/50"
        />
        <button
          type="submit"
          disabled={pending || !text.trim()}
          className="rounded-md bg-foreground px-4 py-2 text-sm text-background disabled:opacity-40"
        >
          {pending ? "送信中" : "送信"}
        </button>
      </form>
    </div>
  );
}
