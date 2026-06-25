// アバター/アイコン（プレゼンテーション専用）。

const AVATAR_COLORS = [
  "bg-rose-500",
  "bg-orange-500",
  "bg-amber-500",
  "bg-emerald-500",
  "bg-teal-500",
  "bg-sky-500",
  "bg-blue-500",
  "bg-indigo-500",
  "bg-violet-500",
  "bg-fuchsia-500",
  "bg-pink-500",
  "bg-cyan-500",
];

function colorFor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

/** 人間のアバター。表示名の頭文字を色付きの円に。 */
export function UserAvatar({ name }: { name: string }) {
  const initial = [...name][0]?.toUpperCase() ?? "?";
  return (
    <div
      className={`flex h-8 w-8 shrink-0 select-none items-center justify-center rounded-full text-sm font-semibold text-white shadow-sm ${colorFor(name)}`}
      title={name}
    >
      {initial}
    </div>
  );
}

/** AIアシスタントのアバター（バイオレットのグラデ円＋ボットアイコン）。 */
export function AssistantAvatar() {
  return (
    <div
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 text-white shadow-sm"
      title="AIアシスタント"
    >
      <BotIcon className="h-5 w-5" />
    </div>
  );
}

export function BotIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <rect x="3" y="11" width="18" height="10" rx="2" />
      <circle cx="12" cy="5" r="2" />
      <path d="M12 7v4" />
      <line x1="8" y1="16" x2="8" y2="16" />
      <line x1="16" y1="16" x2="16" y2="16" />
    </svg>
  );
}

export function SparkleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M12 3l1.6 5.4L19 10l-5.4 1.6L12 17l-1.6-5.4L5 10l5.4-1.6z" />
    </svg>
  );
}
