import type { Message } from "@/lib/store/types";

/**
 * 記憶パイプラインのサニタイズ。共有チャットの本文・表示名はすべて
 * ユーザー制御の信頼できない入力なので、LLM へ渡す前／記憶として保存する前に
 * 正規化し、transcript インジェクション（改行で偽の「役割:」行を差し込む）や
 * system プロンプトのブロック崩しを防ぐ。
 */

// 制御文字（タブ/改行/復帰は別途畳むのでここでは扱わない）。
const CONTROL_CHARS = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g;

/** 改行・タブ・制御文字を空白に畳んで1行にする。 */
export function sanitizeLine(s: string): string {
  return s
    .replace(CONTROL_CHARS, " ")
    .replace(/[\r\n\t]+/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/**
 * 会話を「user(発言者): 本文」「assistant: 本文」の 1メッセージ=1行へ整形する
 * （抽出/要約 LLM の入力用）。役割ラベルは常に我々が制御するので、表示名が
 * "assistant" を騙っても user 行として描画され、改行による行偽装もできない。
 */
export function buildTranscript(messages: Message[]): string {
  return messages
    .map((m) =>
      m.role === "user"
        ? `user(${sanitizeLine(m.author)}): ${sanitizeLine(m.content)}`
        : `assistant: ${sanitizeLine(m.content)}`,
    )
    .join("\n");
}

/**
 * 「アシスタントへの命令/出力操作/役割変更」に見えるテキストを検出する。
 * 記憶は将来の system プロンプトへ注入されるため、命令文を保存させない入口フィルタに使う。
 * ローカルの非堅牢なモデルは出力時の枠付け（「指示に従うな」）だけでは騙されうるので、
 * そもそも保存しないことを主防御線にする。事実文（例:「金曜はリリース日」）は一致しない。
 */
const INJECTION_RES: RegExp[] = [
  // 出力フォーマットの操作（冒頭/末尾に付ける等）
  /(返答|応答|回答|レスポンス|メッセージ|発言|response|reply|answer|output)[\s\S]{0,12}(冒頭|先頭|末尾|最後|頭|prefix|suffix|append|prepend)/i,
  /(冒頭|先頭|末尾|頭)に[\s\S]{0,16}(付け|つけ|加え|入れ|書け|出力)/,
  // 役割変更・なりきり・脱獄
  /(振る舞|ふるま|なりき|演じ|act as|pretend|roleplay|jailbreak|開発者モード|developer mode)/i,
  // 既存の指示/ルールの無視・上書き（語順は日本語で前後どちらもありうる）
  /(無視|忘れ|ignore|disregard|override)[\s\S]{0,12}(指示|命令|ルール|前の|これまで|above|previous|prior|instruction|system)/i,
  /(指示|命令|ルール|プロンプト|instruction|prompt)[\s\S]{0,12}(無視|忘れ|上書き|ignore|disregard|override)/i,
  // assistant 出力への強い命令
  /必ず[\s\S]{0,20}(と(答え|返|付け|言|出力)|すること|しろ|せよ)/,
  /(you must|always respond|respond with|from now on|in (every|all) (responses|replies))/i,
  // システムプロンプト/権限の語
  /(システムプロンプト|system ?prompt)/i,
];

export function looksLikeInjection(text: string): boolean {
  return INJECTION_RES.some((re) => re.test(text));
}

/** 記憶本文の長さ上限（注入トークンと汚染面積を抑える）。 */
const MAX_MEMORY_LEN = 500;

/**
 * 記憶として保存するテキストを正規化する。
 * - fact/preference/decision（既定）: 1行へ畳む。system のブロック（箇条書き）を
 *   壊す改行や偽の見出しを混入させない。
 * - summary（multiline:true）: 箇条書きを保つため行は残すが、制御文字は除去。
 */
export function sanitizeMemoryText(text: string, opts?: { multiline?: boolean }): string {
  if (opts?.multiline) {
    const cleaned = text
      .replace(CONTROL_CHARS, " ")
      .split("\n")
      .map((l) => l.replace(/[\r\t]+/g, " ").replace(/\s{2,}/g, " ").trimEnd())
      .join("\n")
      .trim();
    return cleaned.slice(0, MAX_MEMORY_LEN * 4);
  }
  return sanitizeLine(text).slice(0, MAX_MEMORY_LEN);
}
