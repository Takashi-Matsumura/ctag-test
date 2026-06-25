"use client";

/** 進行中アシスタント応答。全参加者が同時にこのトークン追記を見る。 */
export function StreamingBubble({ text }: { text: string }) {
  return (
    <div className="flex flex-col items-start">
      <span className="px-1 text-xs opacity-60">🤖 assistant</span>
      <div className="max-w-[80%] whitespace-pre-wrap rounded-2xl bg-black/[.06] px-3 py-2 text-sm dark:bg-white/[.10]">
        {text}
        <span className="ml-0.5 inline-block animate-pulse">▋</span>
      </div>
    </div>
  );
}
