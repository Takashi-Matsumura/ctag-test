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
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
      className="flex items-end gap-2 border-t border-black/10 p-3 dark:border-white/15"
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
        placeholder="メッセージを入力（Enterで送信 / Shift+Enterで改行）"
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
  );
}
