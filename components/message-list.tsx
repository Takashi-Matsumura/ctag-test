"use client";

import { useEffect, useRef } from "react";
import type { Message } from "@/lib/store/types";
import { Markdown } from "@/components/markdown";
import { StreamingBubble } from "@/components/streaming-bubble";
import { MENTION_SPLIT_RE } from "@/lib/mention";

function isMentionToken(s: string): boolean {
  return /^@(?:assistant|ai|bot|アシスタント)$/iu.test(s);
}

/** ユーザー発話。@メンションを色付きで強調しつつプレーン表示。 */
function MentionText({ content }: { content: string }) {
  const parts = content.split(MENTION_SPLIT_RE);
  return (
    <span className="whitespace-pre-wrap">
      {parts.map((part, i) =>
        isMentionToken(part) ? (
          <span
            key={i}
            className="rounded bg-blue-500/15 px-1 font-medium text-blue-600 dark:text-blue-300"
          >
            {part}
          </span>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </span>
  );
}

function Bubble({ message, self }: { message: Message; self: boolean }) {
  const isAssistant = message.role === "assistant";
  return (
    <div className={`flex flex-col ${self ? "items-end" : "items-start"}`}>
      <span className="px-1 text-xs opacity-60">
        {isAssistant ? "🤖 assistant" : message.author}
      </span>
      <div
        className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${
          isAssistant
            ? "bg-black/[.06] dark:bg-white/[.10]"
            : self
              ? "bg-foreground text-background"
              : "bg-black/[.04] dark:bg-white/[.06]"
        }`}
      >
        {isAssistant ? (
          <Markdown>{message.content}</Markdown>
        ) : (
          <MentionText content={message.content} />
        )}
      </div>
    </div>
  );
}

export function MessageList({
  messages,
  streaming,
  selfName,
}: {
  messages: Message[];
  streaming: { runId: string; text: string } | null;
  selfName: string;
}) {
  const endRef = useRef<HTMLDivElement>(null);

  // 新着・トークン追記のたびに最下部へ追従。
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streaming]);

  return (
    <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-4">
      {messages.map((m) => (
        <Bubble key={m.id} message={m} self={m.role === "user" && m.author === selfName} />
      ))}
      {streaming && <StreamingBubble text={streaming.text} />}
      <div ref={endRef} />
    </div>
  );
}
