"use client";

import { useEffect, useRef } from "react";
import type { Message } from "@/lib/store/types";
import { AssistantAvatar, SparkleIcon, UserAvatar } from "@/components/avatars";
import { ASSISTANT_BUBBLE, OTHER_BUBBLE, SELF_BUBBLE } from "@/components/bubble-styles";
import { Markdown } from "@/components/markdown";
import { StreamingBubble } from "@/components/streaming-bubble";
import { MENTION_SPLIT_RE } from "@/lib/mention";

function isMentionToken(s: string): boolean {
  return /^[@＠](?:assistant|ai|bot|アシスタント)$/iu.test(s);
}

/** ユーザー発話。@メンションを強調しつつプレーン表示。 */
function MentionText({ content, onAccent }: { content: string; onAccent?: boolean }) {
  const parts = content.split(MENTION_SPLIT_RE);
  const mentionClass = onAccent
    ? "rounded bg-white/25 px-1 font-medium text-white"
    : "rounded bg-blue-500/15 px-1 font-medium text-blue-600 dark:text-blue-300";
  return (
    <span className="whitespace-pre-wrap">
      {parts.map((part, i) =>
        isMentionToken(part) ? (
          <span key={i} className={mentionClass}>
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
  const name = isAssistant ? "AIアシスタント" : message.author;

  return (
    <div className={`flex gap-2.5 ${self ? "flex-row-reverse" : "flex-row"}`}>
      {isAssistant ? <AssistantAvatar /> : <UserAvatar name={message.author} />}
      <div className={`flex max-w-[78%] flex-col gap-1 ${self ? "items-end" : "items-start"}`}>
        <span className="flex items-center gap-1.5 px-1 text-xs">
          <span
            className={
              isAssistant ? "font-medium text-violet-600 dark:text-violet-300" : "opacity-60"
            }
          >
            {name}
          </span>
          {message.ambient && (
            <span className="inline-flex items-center gap-0.5 rounded-full bg-violet-500/15 px-1.5 py-0.5 text-[10px] font-medium text-violet-600 dark:text-violet-300">
              <SparkleIcon className="h-2.5 w-2.5" />
              自発
            </span>
          )}
        </span>
        <div className={isAssistant ? ASSISTANT_BUBBLE : self ? SELF_BUBBLE : OTHER_BUBBLE}>
          {isAssistant ? (
            <Markdown>{message.content}</Markdown>
          ) : (
            <MentionText content={message.content} onAccent={self} />
          )}
        </div>
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
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
      {messages.map((m) => (
        <Bubble key={m.id} message={m} self={m.role === "user" && m.author === selfName} />
      ))}
      {streaming && <StreamingBubble text={streaming.text} />}
      <div ref={endRef} />
    </div>
  );
}
