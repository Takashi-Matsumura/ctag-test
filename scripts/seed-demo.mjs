import Database from '/Users/matsbaccano/projects/ctag-test/node_modules/better-sqlite3/lib/index.js';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';

const DB_PATH = resolve('/Users/matsbaccano/projects/ctag-test/.data/channels.db');

function newId(prefix) {
  return `${prefix}_${randomUUID().slice(0, 8)}`;
}

const db = new Database(DB_PATH);
db.pragma('foreign_keys = ON');

// ベース時刻: 昨日の10:00 AM
const base = Date.now() - 24 * 60 * 60 * 1000;
const t = (offsetMin) => base + offsetMin * 60 * 1000;

const CH_ID = newId('ch');

db.prepare('INSERT INTO channels (id, name, created_at) VALUES (?, ?, ?)').run(
  CH_ID, 'プロジェクト Bloom 相談室', t(0)
);

const msgs = [
  {
    author: 'たかし', role: 'user', at: 0,
    content: 'みなさん、新プロジェクト「Bloom」のキックオフです!\nECサイトのリニューアルで、フロントは Next.js、バックは FastAPI で行く予定です。担当範囲などをここで共有しましょう！',
  },
  {
    author: 'さやか', role: 'user', at: 2,
    content: 'よろしくお願いします！デザインとフロント実装を担当できます。まず認証まわりの方針を決めたいです。',
  },
  {
    author: 'ひろき', role: 'user', at: 4,
    content: 'お疲れ様です。バックエンド（FastAPI）側は僕が担当します。インフラも見れます。',
  },
  {
    author: 'たかし', role: 'user', at: 6,
    content: '@assistant 今回のECサイトリニューアルで、認証システムは JWT とセッションどちらが適切でしょう？フロントは Next.js、バックは FastAPI の構成です。セキュリティと開発効率の観点から教えてください。',
  },
  {
    author: 'assistant', role: 'assistant', at: 7, status: 'complete',
    content: 'Next.js + FastAPI 構成での認証について整理します。\n\n**JWT（推奨）**\n- サーバーレスやスケールアウトに対応しやすい（セッションストア不要）\n- FastAPI 側は python-jose や PyJWT で署名検証のみ\n- Next.js は httpOnly Cookie にアクセストークン＋リフレッシュトークンを格納\n- **リフレッシュトークンは DB に保存**し、失効・強制ログアウトに対応する\n\n**セッション方式**\n- 実装はシンプルだが Redis などのセッションストアが必要\n- 水平スケール時にスティッキーセッションか共有ストアが要る\n\nECサイトでカート・注文履歴を扱うなら、JWT + リフレッシュトークン（DB保存・ローテーション）が堅牢です。アクセストークンは15分〜1時間の短命にして、リフレッシュで延命する構成をお勧めします。',
  },
  {
    author: 'さやか', role: 'user', at: 10,
    content: 'ありがとうございます！JWT + リフレッシュトークンで進めましょう。Next.js 側の httpOnly Cookie 管理は私が担当します。',
  },
  {
    author: 'ひろき', role: 'user', at: 11,
    content: '了解です。FastAPI 側のトークン検証・失効管理は僕が実装します。リフレッシュトークンのローテーションもやっておきます。',
  },
  {
    author: 'たかし', role: 'user', at: 13,
    content: '@assistant 覚えて: プロジェクト名は「Bloom」、締め切りは 7月31日、認証は JWT + リフレッシュトークン方式（DB保存・ローテーションあり）を採用することに決定。さやかがフロント、ひろきがバックエンド担当。',
  },
  {
    author: 'assistant', role: 'assistant', at: 14, status: 'complete',
    content: '覚えました！「Bloom」プロジェクトの重要な決定事項として記録しました。以降の会話でこの情報を参照しながらお手伝いします。',
  },
  {
    author: 'さやか', role: 'user', at: 16,
    content: 'では今週のタスクを整理しませんか。私はまず Figma でワイヤーフレームを作ります。',
  },
  {
    author: 'ひろき', role: 'user', at: 17,
    content: 'バックは DB スキーマ設計から始めます。商品・注文・ユーザーテーブルあたり。',
  },
  {
    author: 'たかし', role: 'user', at: 19,
    content: '@assistant 締め切りまでのスケジュールを考えると、今週中に終わらせるべき最優先タスクはどれでしょうか？',
  },
  {
    author: 'assistant', role: 'assistant', at: 20, status: 'complete',
    content: '「Bloom」プロジェクトの締め切り（7月31日）を踏まえた優先順位です。\n\n**今週の最優先タスク**\n\n1. **DB スキーマ確定**（ひろきさん）\n   認証のリフレッシュトークンテーブルも含め設計を固める。後から変えるとマイグレーションコストが高い。\n\n2. **ワイヤーフレーム（主要画面のみ）**（さやかさん）\n   商品一覧・カート・決済フローの3画面を優先。デザイン確定前でも実装に着手できる粒度でOK。\n\n3. **認証基盤の実装着手**（ひろきさん＋さやかさん）\n   JWT 発行・検証・Cookie 管理は他機能のブロッカーになるため早期着手を推奨。\n\n7月31日まで約5週間。週次でここに進捗を共有してもらえれば、ボトルネックを早めにキャッチできます。',
  },
  {
    author: 'ひろき', role: 'user', at: 23,
    content: '整理してくれてありがとうございます。DB スキーマは木曜までに叩き台を作ってここに貼ります！',
  },
  {
    author: 'さやか', role: 'user', at: 24,
    content: 'ワイヤーフレームも木曜目標にします👍 週次の進捗共有はここのチャンネルで続けましょうか。',
  },
  {
    author: 'たかし', role: 'user', at: 25,
    content: 'それがいいですね。では毎週月曜にここで状況確認します。今日はありがとうございました！',
  },
  {
    author: 'assistant', role: 'assistant', at: 27, status: 'complete', ambient: true,
    content: 'キックオフお疲れ様でした！今日の決定事項をまとめておきます。\n\n- 認証: JWT + リフレッシュトークン（DB保存・ローテーション）\n- フロント担当: さやかさん（ワイヤーフレーム → 木曜）\n- バックエンド担当: ひろきさん（DBスキーマ → 木曜）\n- 次回確認: 毎週月曜にこのチャンネルで\n\n木曜に成果物が揃ったら、次のステップの優先順位付けもお手伝いします。',
  },
];

const insert = db.prepare(
  'INSERT INTO messages (id, channel_id, role, author, content, created_at, status, ambient) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
);

for (const m of msgs) {
  insert.run(
    newId('msg'),
    CH_ID,
    m.role,
    m.author,
    m.content,
    t(m.at),
    m.status ?? null,
    m.ambient ? 1 : 0,
  );
}

db.close();

console.log('チャンネル ID:', CH_ID);
console.log(`メッセージ ${msgs.length} 件を挿入しました。`);
