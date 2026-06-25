"use client";

import { AssistantAvatar } from "@/components/avatars";
import { ASSISTANT_BUBBLE } from "@/components/bubble-styles";
import { Markdown } from "@/components/markdown";

/** 進行中アシスタント応答。全参加者が同時にこのトークン追記を見る。 */
export function StreamingBubble({ text }: { text: string }) {
  return (
    <div className="flex flex-row gap-2.5">
      <AssistantAvatar />
      <div className="flex max-w-[78%] flex-col items-start gap-1">
        <span className="px-1 text-xs font-medium text-violet-600 dark:text-violet-300">
          AIアシスタント
        </span>
        <div className={ASSISTANT_BUBBLE}>
          {text ? <Markdown>{text}</Markdown> : null}
          <span className="ml-0.5 inline-block animate-pulse">▋</span>
        </div>
      </div>
    </div>
  );
}
