"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/**
 * アシスタント本文を Markdown としてレンダリングする。
 * react-markdown は既定で生 HTML を描画しない（XSS安全）。
 * チャットバブル向けに余白を詰めた prose を当てる。
 */
export function Markdown({ children }: { children: string }) {
  return (
    <div className="prose prose-sm max-w-none dark:prose-invert prose-p:my-1 prose-headings:my-2 prose-ul:my-1 prose-ol:my-1 prose-li:my-0.5 prose-pre:my-2 prose-pre:bg-black/[.06] dark:prose-pre:bg-white/[.10]">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{children}</ReactMarkdown>
    </div>
  );
}
