# ctag-test — マルチプレイヤー共有チャンネル

Anthropic「Claude Tag」の **マルチプレイヤー**（チャンネルごとに1体の共有アシスタント／複数人が会話と状態をリアルタイム共有）を、**ローカルLLMのクローズド環境**で再現する実験プロジェクトです。

外部API・クラウドに一切依存せず、OpenAI互換のローカルLLM（llama.cpp / Ollama / LM Studio / vLLM 等）に接続して動きます。

## 主な機能

- **共有チャンネル**: 1チャンネル＝1体の共有アシスタント。複数ユーザーが同じ会話を共有します。
- **リアルタイム配信（SSE）**: 誰かの発言も、アシスタントのストリーミング応答（トークン単位）も、接続中の全員へ即時配信。
- **途中参加でも引き継ぎ**: 後から入っても、進行中の生成を含む全状態をスナップショットで受け取ります。
- **@メンションで呼び出し**: `@assistant` を付けたときだけアシスタントが応答。付けなければ参加者同士の会話。
- **参加者表示 / 状態表示**: 接続中メンバー、`考え中 / 入力中 / 順番待ち` を表示。
- **1チャンネル1体の直列化**: 同時投稿してもアシスタントのターンは1つずつ（順番待ち）。
- **Markdown 表示**: アシスタントの応答は Markdown でレンダリング。
- **チャンネル削除**: 一覧から個別に削除可能。

## アーキテクチャ

投稿（POST）と購読（SSE）を分離し、送信者本人も他人と同じ SSE 経由で結果を受け取ることで「全員が同一の真実を見る」状態を保ちます。

```
Browser ──POST /messages──▶ Route Handler
                             1. 発話を Store に確定 → Hub.publish(message)
                             2. @assistant ならロック経由で AssistantRunner 起動
                                  └─ ローカルLLM(OpenAI互換, stream)へfetch
                                     token ごとに Hub.publish(token)  ← 全員に配信
Browser ◀──GET /events(SSE)── Hub（globalThis-pin の EventEmitter, channelId=topic）
                             接続時に snapshot（全履歴+進行中バッファ+参加者+状態）
```

主要モジュール（`lib/`）:

| ファイル | 役割 |
|---|---|
| `lib/hub.ts` | チャンネル単位の pub/sub＋presence。全購読者へファンアウト |
| `lib/lock.ts` | チャンネルごとの直列実行（1チャンネル1体を保証） |
| `lib/store/` | 会話ストア（`ChannelStore` interface＋in-memory 実装。永続化に差し替え可） |
| `lib/llm/client.ts` | OpenAI互換のストリーミングクライアント（依存ゼロ） |
| `lib/llm/runner.ts` | ロック内でLLMをストリームし、Hub配信＋Store確定 |
| `lib/sse.ts` | SSE 整形・keep-alive |
| `lib/mention.ts` | `@assistant` 等のメンション判定 |

ランタイムは常駐 Node プロセス（`next dev` / `next start`）前提。Lambda ではないため SSE の長時間接続とプロセス内状態保持が成立します。

## なぜ別のリアルタイムサーバが不要なのか

一般的なチャットアプリは、リアルタイム通信のために WebSocket サーバ（Socket.IO 等）や Redis pub/sub を**別プロセスとして用意**します。本アプリにそれが無いのは、リアルタイムの役割が消えたからではなく、**Next.js を動かす Node プロセスの中に同居している**からです。鍵は「Next.js の魔法」ではなく **`next start` が“常駐し続ける1個の Node サーバ”である**という性質です。

- **常駐サーバなので接続も状態も保持できる**: `next start` はリクエストごとに使い捨てられる Lambda ではなく、ずっと生きている HTTP サーバ。だから長時間接続を張りっぱなしにでき、会話履歴をメモリ上に保持できる。
- **WebSocket ではなく SSE**: チャットの通信は実質「サーバ→全員へ配信」＋「クライアント→サーバへ1回 POST」で、完全な双方向は不要。配信は Route Handler が `ReadableStream` を返す **SSE**、送信は普通の **POST**。SSE は素の HTTP で動き、ブラウザの `EventSource` が自動再接続まで担う。
- **配信バスはプロセス内の EventEmitter**: 全 SSE 接続が同じプロセスのメモリに居るので、配信仲介は **`channelId` をトピックにした Node 標準 `EventEmitter` 1個**（`lib/hub.ts`）で済む。これが Redis pub/sub の代わり。
- **状態もメモリ上のオブジェクト**: 会話履歴は同プロセス内の `Map`（`lib/store/memory.ts`）。プロセスが生き続けるのでリクエストをまたいで共有される。

→ つまり「接続保持(SSE)」と「配信バス(EventEmitter)」を**別サーバに切り出さず、Next.js の常駐 Node プロセスに同居**させているだけ。

### 成立条件と限界

この手軽さは **「Node プロセスが1個で、ずっと生きている」** という前提に依存します。**社内LAN・単一マシンの自前ホストはまさにこの前提に合致**するため非常に相性が良い一方、前提が崩れると従来どおり「別プロセス＋外部 pub/sub」が必要になります。

- **サーバーレス（Vercel Functions / Lambda 等）では破綻**: 接続が時間で切れ、リクエストごとに別インスタンスへ振られ得る。インスタンス A の EventEmitter は B に繋いだクライアントへ届かない。→ 自前ホストの常駐 Node が前提。
- **水平スケールでは破綻**: Node を複数立てるとプロセス内ハブはプロセス間をまたげない。→ Redis pub/sub 等での橋渡しが必要（＝従来構成に回帰）。
- **再起動で状態消失**: 履歴はメモリのため。`ChannelStore` interface を差し替えれば永続化可能。
- **接続数の上限**: 1プロセスで多数の SSE を保持。チーム/LAN 規模なら十分（補足: HTTP/1.1 は同一ドメインの SSE がタブ6本程度で頭打ち、HTTP/2 なら多重化で緩和）。

## 技術スタック

- Next.js 16（App Router, Route Handler の `ReadableStream` で SSE）
- React 19 / TypeScript 5
- Tailwind CSS v4（`@tailwindcss/typography`）
- react-markdown / remark-gfm
- ローカルLLM: OpenAI互換 `/v1/chat/completions`（stream対応）

## セットアップ

### 1. 依存インストール

```bash
npm install
```

### 2. ローカルLLM を用意（任意）

OpenAI互換エンドポイントを持つ実装ならどれでも可。例:

- **llama.cpp server**: `http://localhost:8080/v1`
- **Ollama**: `http://localhost:11434/v1`
- **LM Studio**: `http://localhost:1234/v1`

> LLM が無くても `LLM_DRIVER=mock` でモック応答により全機能を試せます。

### 3. 環境変数（`.env.local`）

```bash
# 実ローカルLLMに接続する場合
LLM_DRIVER=openai
LLM_BASE_URL=http://localhost:8080/v1
LLM_MODEL=your-model-name
LLM_API_KEY=not-needed
# 推論モデルの思考フェーズを無効化して即レスにする（厳格なOpenAI互換サーバでは 0）
LLM_NO_THINK=1

# 実LLM無しで試す場合は:
# LLM_DRIVER=mock

# 会話ストア（v1 は memory のみ）
STORE_DRIVER=memory
```

| 変数 | 既定 | 説明 |
|---|---|---|
| `LLM_DRIVER` | `mock` | `openai`＝実LLM、`mock`＝モック |
| `LLM_BASE_URL` | `http://localhost:8080/v1` | OpenAI互換のベースURL |
| `LLM_MODEL` | `local-model` | モデル名 |
| `LLM_API_KEY` | `not-needed` | 多くのローカルサーバは不要 |
| `LLM_NO_THINK` | `1` | 思考フェーズ無効化（`chat_template_kwargs.enable_thinking=false`） |
| `STORE_DRIVER` | `memory` | 会話ストア（現状 memory のみ） |

### 4. 起動

```bash
npm run dev
# http://localhost:3000
```

## 使い方

1. トップページでチャンネルを作成。
2. チャンネルを開き、初回に**表示名**を設定（`localStorage` に保存）。
3. メッセージを送信。`@assistant` を含めるとアシスタントが応答します。
4. **別のブラウザ／タブ**で同じチャンネルを開くと、会話・参加者・ストリーミングがリアルタイムに共有されます。

## 制限事項（v1）

- **永続化なし**: 会話は in-memory。サーバ再起動で消えます（`ChannelStore` interface 差し替えで SQLite/JSON 対応可能）。
- **認証・分離なし**: 全チャンネルが全員に見える公開スペース。
- **単一プロセス前提**: pub/sub はプロセス内 EventEmitter（水平スケールには別途 pub/sub 基盤が必要）。

## スクリプト

```bash
npm run dev     # 開発サーバ
npm run build   # 本番ビルド
npm run start   # 本番起動
npm run lint    # ESLint
```
