"use client";

import { useEffect, useRef, useState } from "react";

interface Candidate {
  insert: string; // 挿入する名前（@ は付けない）
  desc: string; // 補足表示
}

interface MentionState {
  start: number; // トリガ文字(@ / ＠)の位置
  query: string; // @ の後ろ〜カーソルまで
}

const TRIGGERS = new Set(["@", "＠"]);

/** カーソル左側に「空白を挟まない @／＠」があれば、その入力中メンションを返す。 */
function detectMention(value: string, caret: number): MentionState | null {
  for (let i = caret - 1; i >= 0; i--) {
    const ch = value[i];
    if (TRIGGERS.has(ch)) {
      // トリガ直前は行頭か空白でなければメンション扱いしない（メール等の誤検出防止）。
      const prev = i > 0 ? value[i - 1] : "";
      if (prev !== "" && !/\s/u.test(prev)) return null;
      return { start: i, query: value.slice(i + 1, caret) };
    }
    if (/\s/u.test(ch)) return null;
  }
  return null;
}

export function Composer({
  onSend,
  participants,
  selfName,
}: {
  onSend: (content: string) => Promise<void>;
  participants: string[];
  selfName: string;
}) {
  const [text, setText] = useState("");
  const [pending, setPending] = useState(false);
  const [mention, setMention] = useState<MentionState | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  // IME（日本語などの変換）中かどうか。変換確定の Enter を送信と区別する。
  const composingRef = useRef(false);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const pendingCaretRef = useRef<number | null>(null);

  // 候補: アシスタント + 自分以外の参加者。
  const allCandidates: Candidate[] = [
    { insert: "assistant", desc: "AIアシスタントを呼び出す" },
    ...participants
      .filter((p) => p !== selfName && p.toLowerCase() !== "assistant")
      .map((p) => ({ insert: p, desc: "参加者" })),
  ];
  const q = mention?.query.toLowerCase() ?? "";
  const candidates = mention
    ? allCandidates.filter((c) => q === "" || c.insert.toLowerCase().includes(q))
    : [];
  const open = mention !== null && candidates.length > 0;

  // 候補挿入後のカーソル位置を反映。
  useEffect(() => {
    if (pendingCaretRef.current != null && taRef.current) {
      const pos = pendingCaretRef.current;
      pendingCaretRef.current = null;
      taRef.current.focus();
      taRef.current.setSelectionRange(pos, pos);
    }
  }, [text]);

  function onChangeValue(value: string, caret: number) {
    setText(value);
    setMention(detectMention(value, caret));
    setActiveIndex(0);
  }

  function accept(c: Candidate | undefined) {
    if (!c || !mention) return;
    const caret = taRef.current?.selectionStart ?? text.length;
    const before = text.slice(0, mention.start);
    const after = text.slice(caret);
    const inserted = `@${c.insert} `; // 常に半角 @ を挿入（判定が確実に通る）。
    pendingCaretRef.current = before.length + inserted.length;
    setText(before + inserted + after);
    setMention(null);
  }

  async function submit() {
    const content = text.trim();
    if (!content || pending) return;
    setPending(true);
    try {
      await onSend(content);
      setText(""); // 送信成功後にクリア（自分の発話も SSE 経由で表示される）。
      setMention(null);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="shrink-0 border-t border-black/10 dark:border-white/15">
      <div className="mx-auto w-2/3">
      <p className="px-3 pt-2 text-xs opacity-50">
        ヒント: <code className="rounded bg-black/[.06] px-1 dark:bg-white/[.12]">@</code> で候補表示。
        <code className="rounded bg-black/[.06] px-1 dark:bg-white/[.12]">@assistant</code>{" "}
        で AIアシスタントが応答します。
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
        className="relative flex items-end gap-2 p-3"
      >
        {open && (
          <ul className="absolute bottom-full left-3 z-10 mb-1 w-72 overflow-hidden rounded-md border border-black/15 bg-background shadow-lg dark:border-white/20">
            {candidates.map((c, i) => (
              <li key={c.insert}>
                <button
                  type="button"
                  // mousedown でフォーカスを奪わせず確定（blur より先に処理）。
                  onMouseDown={(e) => {
                    e.preventDefault();
                    accept(c);
                  }}
                  onMouseEnter={() => setActiveIndex(i)}
                  className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm ${
                    i === activeIndex ? "bg-black/[.06] dark:bg-white/[.10]" : ""
                  }`}
                >
                  <span className="font-medium">@{c.insert}</span>
                  <span className="text-xs opacity-60">{c.desc}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        <textarea
          ref={taRef}
          value={text}
          onChange={(e) => onChangeValue(e.target.value, e.target.selectionStart ?? e.target.value.length)}
          onCompositionStart={() => {
            composingRef.current = true;
          }}
          onCompositionEnd={() => {
            composingRef.current = false;
          }}
          onBlur={() => window.setTimeout(() => setMention(null), 120)}
          onKeyDown={(e) => {
            const composing = e.nativeEvent.isComposing || composingRef.current;
            // 候補表示中のキー操作（IME変換中は候補確定もしない）。
            if (open && !composing) {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setActiveIndex((i) => (i + 1) % candidates.length);
                return;
              }
              if (e.key === "ArrowUp") {
                e.preventDefault();
                setActiveIndex((i) => (i - 1 + candidates.length) % candidates.length);
                return;
              }
              if (e.key === "Escape") {
                e.preventDefault();
                setMention(null);
                return;
              }
              if (e.key === "Enter" || e.key === "Tab") {
                e.preventDefault();
                accept(candidates[activeIndex]);
                return;
              }
            }
            // 通常の Enter 送信。IME 変換確定の Enter では送信しない。
            if (e.key === "Enter" && !e.shiftKey) {
              if (composing) return;
              e.preventDefault();
              void submit();
            }
          }}
          rows={1}
          placeholder="メッセージを入力（@ で候補・Enterで送信）"
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
    </div>
  );
}
