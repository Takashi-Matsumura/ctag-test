/**
 * アシスタント呼び出しの @メンション判定。
 * これに一致したユーザー発話のときだけアシスタントが応答する
 *（＝Claude Tag の「タグ付けして呼ぶ」挙動）。
 * 後続が英数字のときは弾く（@airport が @ai に誤マッチしないように）。
 */
const MENTION_RE = /@(assistant|ai|bot|アシスタント)(?![a-z0-9])/iu;

/** UI 表示やヒントで使う代表メンション。 */
export const ASSISTANT_MENTION = "@assistant";

export function mentionsAssistant(content: string): boolean {
  return MENTION_RE.test(content);
}

/** メンション強調表示のための分割用（マッチ部分を保持して split）。 */
export const MENTION_SPLIT_RE = /(@(?:assistant|ai|bot|アシスタント)(?![a-z0-9]))/giu;
