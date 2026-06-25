import { readFileSync, writeFileSync, renameSync } from 'node:fs';
import { randomUUID } from 'node:crypto';

const FILE = '/Users/matsbaccano/projects/ctag-test/.data/memories.json';
const CH_ID = 'ch_d5045f6e';

function newId(prefix) {
  return `${prefix}_${randomUUID().slice(0, 8)}`;
}

// 昨日のキックオフ時刻に合わせる（13分目 = 覚えてコマンドのタイミング）
const base = Date.now() - 24 * 60 * 60 * 1000 + 13 * 60 * 1000;

const newMemories = [
  {
    id: newId('mem'),
    scope: 'channel',
    channelId: CH_ID,
    kind: 'decision',
    text: 'プロジェクト名は「Bloom」',
    subject: null,
    source: 'explicit',
    author: 'たかし',
    embedding: null,
    embeddingModel: null,
    createdAt: base,
    updatedAt: base,
  },
  {
    id: newId('mem'),
    scope: 'channel',
    channelId: CH_ID,
    kind: 'decision',
    text: 'プロジェクト Bloom の締め切りは 7月31日',
    subject: null,
    source: 'explicit',
    author: 'たかし',
    embedding: null,
    embeddingModel: null,
    createdAt: base + 1000,
    updatedAt: base + 1000,
  },
  {
    id: newId('mem'),
    scope: 'channel',
    channelId: CH_ID,
    kind: 'decision',
    text: '認証方式: JWT + リフレッシュトークン（DB保存・ローテーションあり）を採用',
    subject: null,
    source: 'explicit',
    author: 'たかし',
    embedding: null,
    embeddingModel: null,
    createdAt: base + 2000,
    updatedAt: base + 2000,
  },
  {
    id: newId('mem'),
    scope: 'channel',
    channelId: CH_ID,
    kind: 'fact',
    text: 'さやかがフロント担当（Next.js 実装・Figma ワイヤーフレーム）',
    subject: 'さやか',
    source: 'explicit',
    author: 'たかし',
    embedding: null,
    embeddingModel: null,
    createdAt: base + 3000,
    updatedAt: base + 3000,
  },
  {
    id: newId('mem'),
    scope: 'channel',
    channelId: CH_ID,
    kind: 'fact',
    text: 'ひろきがバックエンド担当（FastAPI 実装・DB スキーマ設計）',
    subject: 'ひろき',
    source: 'explicit',
    author: 'たかし',
    embedding: null,
    embeddingModel: null,
    createdAt: base + 4000,
    updatedAt: base + 4000,
  },
  {
    id: newId('mem'),
    scope: 'channel',
    channelId: CH_ID,
    kind: 'decision',
    text: '毎週月曜日にこのチャンネルで進捗確認を行う',
    subject: null,
    source: 'auto',
    author: 'assistant',
    embedding: null,
    embeddingModel: null,
    createdAt: base + 5000,
    updatedAt: base + 5000,
  },
];

// 既存データを読んで追記
const existing = JSON.parse(readFileSync(FILE, 'utf8'));
const merged = [...existing, ...newMemories];

// アトミック書き込み（temp→rename）
const tmp = FILE + '.tmp';
writeFileSync(tmp, JSON.stringify(merged, null, 2), 'utf8');
renameSync(tmp, FILE);

console.log(`追加: ${newMemories.length}件 / 合計: ${merged.length}件`);
newMemories.forEach(m => console.log(`  [${m.kind}] ${m.text}`));
