import { randomUUID } from "node:crypto";

/** 短めの ID（チャンネル/メッセージ/ラン用）。衝突の心配がない単一プロセス前提。 */
export function newId(prefix: string): string {
  return `${prefix}_${randomUUID().slice(0, 8)}`;
}
