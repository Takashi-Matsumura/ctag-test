"use client";

import type { AssistantStatus } from "@/lib/events";

const STATUS_LABEL: Record<AssistantStatus, string> = {
  idle: "",
  queued: "順番待ち…",
  thinking: "考え中…",
  streaming: "入力中…",
};

export function PresenceBar({
  participants,
  status,
  connected,
}: {
  participants: string[];
  status: AssistantStatus;
  connected: boolean;
}) {
  const statusLabel = STATUS_LABEL[status];
  return (
    <div className="flex items-center gap-3 text-xs">
      <span
        className={`inline-block h-2 w-2 rounded-full ${connected ? "bg-green-500" : "bg-gray-400"}`}
        title={connected ? "接続中" : "再接続中…"}
      />
      <span className="opacity-70">
        参加者 {participants.length}: {participants.join(", ") || "—"}
      </span>
      {statusLabel && (
        <span className="ml-auto animate-pulse font-medium opacity-80">
          アシスタント: {statusLabel}
        </span>
      )}
    </div>
  );
}
