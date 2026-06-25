"use client";

import { useEffect, useRef } from "react";
import type { Message } from "@/lib/store/types";
import { StreamingBubble } from "@/components/streaming-bubble";

function Bubble({ message, self }: { message: Message; self: boolean }) {
  const isAssistant = message.role === "assistant";
  return (
    <div className={`flex flex-col ${self ? "items-end" : "items-start"}`}>
      <span className="px-1 text-xs opacity-60">
        {isAssistant ? "🤖 assistant" : message.author}
      </span>
      <div
        className={`max-w-[80%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm ${
          isAssistant
            ? "bg-black/[.06] dark:bg-white/[.10]"
            : self
              ? "bg-foreground text-background"
              : "bg-black/[.04] dark:bg-white/[.06]"
        }`}
      >
        {message.content}
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
