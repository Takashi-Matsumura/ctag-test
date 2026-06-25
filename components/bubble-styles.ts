// 吹き出しのスタイル定数（プレーンモジュール。"use client" 境界をまたがない）。

/** 自分の発言: ブルー〜インディゴのグラデーション。 */
export const SELF_BUBBLE =
  "rounded-2xl rounded-tr-sm bg-gradient-to-br from-blue-500 to-indigo-600 px-3.5 py-2 text-sm text-white shadow-sm";

/** 他の参加者の発言: ニュートラルなサーフェス。 */
export const OTHER_BUBBLE =
  "rounded-2xl rounded-tl-sm bg-zinc-100 px-3.5 py-2 text-sm text-foreground shadow-sm dark:bg-zinc-800";

/** AIアシスタントの発言: バイオレット系で他者と区別。 */
export const ASSISTANT_BUBBLE =
  "rounded-2xl rounded-tl-sm border border-violet-200 bg-violet-50 px-3.5 py-2 text-sm text-foreground shadow-sm dark:border-violet-900/50 dark:bg-violet-950/40";
