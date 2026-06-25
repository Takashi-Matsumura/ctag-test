import { MENTION_SPLIT_RE } from "@/lib/mention";
import type { MemoryScope } from "@/lib/memory/types";

/**
 * @assistant 宛て発話から「覚えて／忘れて」コマンドを解析する。
 * mention.ts（@判定）は汚さず、記憶コマンドの解釈はここに閉じる。
 */
export interface MemoryCommand {
  kind: "remember" | "forget";
  /** remember: 記憶本文。forget: 対象を絞るキーワード（無ければ直近の明示記憶）。 */
  text?: string;
  /** 「全体で/みんなで」等で global、既定は channel。 */
  scope: MemoryScope;
}

// 「覚えて」系。寛容に拾う（mention.ts の MENTION_RE と同じ方針）。
const REMEMBER_RE = /(覚え(?:て|といて|ておいて|とい?て)|おぼえて|メモ(?:して|っといて|しておいて)|記憶して|remember)/i;
// 「忘れて」系。
const FORGET_RE = /(忘れて|削除して|消して|forget)/i;
// global スコープにするキーワード。
const GLOBAL_RE = /(全体|みんな|皆|チーム|グローバル|全員)/;
// 「: 〜」「： 〜」以降を本文とみなす（複数行も拾う）。
const AFTER_COLON_RE = /[:：]\s*([\s\S]+)$/;

function afterColon(content: string): string | null {
  const m = content.match(AFTER_COLON_RE);
  const text = m?.[1]?.trim();
  return text ? text : null;
}

/** メンション・トリガ語・スコープ語を取り除いた残りを本文として拾う。 */
function stripToBody(content: string): string {
  return content
    .replace(MENTION_SPLIT_RE, " ")
    .replace(REMEMBER_RE, " ")
    .replace(/(全体で|みんなで|皆で|チームで|グローバルに|全員に|全体に)/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function parseMemoryCommand(content: string): MemoryCommand | null {
  const scope: MemoryScope = GLOBAL_RE.test(content) ? "global" : "channel";

  if (FORGET_RE.test(content)) {
    return { kind: "forget", text: afterColon(content) ?? undefined, scope };
  }

  if (REMEMBER_RE.test(content)) {
    const text = afterColon(content) ?? stripToBody(content);
    if (!text) return null; // 本文が無ければコマンド扱いしない（通常応答に回す）
    return { kind: "remember", text, scope };
  }

  return null;
}
