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
- **記憶・学習**: チームの事実/好み/決定を覚え、関連時だけ思い出して応答に活かす（明示「覚えて」＋自動抽出＋会話要約＋セマンティック想起）。詳細は [記憶・学習（メモリ）](#記憶学習メモリ)。

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

## 記憶・学習（メモリ）

アシスタントがチームの**事実・好み・決定**を覚え、関連する場面でだけ思い出して応答に活かします。記憶はチャンネル横断の長期記憶（global）とチャンネル内の会話要約を持ち、`.data/memories.json` に**永続化**されます（会話履歴と違い再起動でも残ります）。

- **明示記憶**: `@assistant 覚えて: 〜`（「全体で覚えて」で global スコープ、`忘れて: 〜` で削除）
- **自動抽出**: 数ターンごとに会話から事実/好み/決定を背景抽出（雑談は除外）
- **会話要約**: 履歴が伸びたら古い部分を要約してコンテキストを圧縮
- **セマンティック想起**: embedding で関連記憶だけを system プロンプトに注入（未設定時は明示記憶を最近順に注入する degrade で動作）
- **プロンプトインジェクション対策**: 記憶は信頼できないデータとして扱い、アシスタントへの命令文は保存・追従しない多層防御

### 想起のしくみ（生成 :8080 と embedding :8082 の関係）

通常の質問は、生成 LLM に渡る前に embedding で関連記憶を集める **RAG 型**のフローで処理されます。生成用 LLM（`:8080`）と embedding 専用モデル（`:8082`, bge-m3）は別プロセスで、1ターンの中で順番に呼ばれます。

```
ユーザー: "@assistant 締め切りいつ?"
   │ POST /api/channels/[id]/messages
   ▼
[runner.ts] runAssistantTurn
   │ ① recallForTurn(history)
   │     a. クエリ = 直近ユーザー発話(最大3件)
   │     b. embedText(query) ──POST──▶ :8082 bge-m3  …クエリを1024次元ベクトルへ
   │     c. memoryStore.search()  …memories.json の各記憶ベクトルとの
   │        コサイン類似度を【プロセス内で計算】し上位K件を選ぶ
   │     d. 関連記憶を注入ブロックに整形
   │ ② systemContent = SYSTEM_PROMPT + 記憶ブロック
   │ ③ streamChat(chat) ──POST(stream)──▶ :8080 gemma  …生成しトークンを配信
   ▼
確定メッセージを Store 保存＋全員へ SSE 配信
```

ポイント:

- **順序は「embed(:8082) → 記憶検索 → プロンプトに記憶を足す → 生成(:8080)」**。生成前に想起が完結する。
- **検索の本体はプロセス内のコサイン計算**（`json-store.ts` の `cosineSim`）。`:8082` は「クエリ文 → ベクトル」変換にだけ使う。記憶側のベクトルは保存時に一度だけ作って `memories.json` に入れてあるので、検索のたびに作り直さない。
- **通常1ターンの外部呼び出しは `:8082` ×1（クエリの embedding）＋ `:8080` ×1（生成）** の計2回。
- **`覚えて`/`忘れて`** は生成せず、記憶を embedding して保存するだけ（定型応答を返す）。
- **`:8082` が落ちている/未設定**なら embedding は `null` となり **degrade**（明示記憶を最近順に注入）に切り替え、**生成は止めない**。
- 応答後に**自動抽出・会話要約**が背景で `:8080` を使って新しい記憶を作り、`:8082` で embedding して保存する（応答配信はブロックしない）。

### 環境変数（記憶・embedding）

| 変数 | 既定 | 説明 |
|---|---|---|
| `MEMORY_DRIVER` | `json` | `json`(永続) / `memory`(揮発) / `off`(無効) |
| `MEMORY_FILE` | `.data/memories.json` | JSON ストアの保存先 |
| `LLM_EMBED_BASE_URL` | （空） | embedding 用 OpenAI互換ベースURL。未設定なら想起は degrade |
| `LLM_EMBED_MODEL` | （空） | embedding モデル名（保存時のタグにも使用） |
| `LLM_EMBED_API_KEY` | `LLM_API_KEY` を流用 | embedding 用APIキー |
| `MEMORY_RECALL_TOPK` | `6` | 想起する最大件数 |
| `MEMORY_RECALL_MIN_SCORE` | `0.3` | コサイン類似度の足切り（bge-m3 なら `0.5` 前後が目安） |
| `MEMORY_SUMMARY_THRESHOLD` | `40` | 要約を始める履歴件数 |
| `MEMORY_RECENT_WINDOW` | `20` | 要約対象から除外する直近件数（生注入する窓） |
| `MEMORY_EXTRACT_EVERY` | `5` | 何ターンごとに自動抽出するか |

### embedding サーバ（セマンティック想起用）

生成用 LLM(:8080) とは**別プロセス・別モデル**で embedding 専用サーバを立てます。日本語対応の **bge-m3**（CLS プーリング）を推奨。同じ起動内容を [`scripts/embed-server.sh`](scripts/embed-server.sh) に用意しています。

```bash
bash scripts/embed-server.sh
# 中身:
# llama-server --hf-repo bbvch-ai/bge-m3-GGUF --hf-file bge-m3-q4_k_m.gguf \
#   --embeddings --pooling cls --host 127.0.0.1 --port 8082 -c 2048 -ngl 99
```

`.env.local`:

```bash
LLM_EMBED_BASE_URL=http://localhost:8082/v1
LLM_EMBED_MODEL=bge-m3
```

疎通確認:

```bash
curl -s http://localhost:8082/v1/embeddings \
  -H 'Content-Type: application/json' \
  -d '{"input":"テスト","model":"bge-m3"}' | head -c 120
```

> **モデルを切り替えるとき**: 記憶には作成時の embedding モデル名と次元が記録され、検索は不一致を除外します。別モデルに替えると過去記憶は意味検索に出なくなるため、記憶が貯まっている場合は再 embedding（埋め直し）が必要です。

#### 常駐化（macOS launchd）

ログイン時に自動起動し、落ちても再起動するよう LaunchAgent に登録できます。

`~/Library/LaunchAgents/com.ctag.embed.plist`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>com.ctag.embed</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/bash</string>
    <string>/Users/&lt;you&gt;/projects/ctag-test/scripts/embed-server.sh</string>
  </array>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>StandardOutPath</key><string>/tmp/ctag-embed.log</string>
  <key>StandardErrorPath</key><string>/tmp/ctag-embed.log</string>
  <key>EnvironmentVariables</key>
  <dict><key>PATH</key><string>/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin</string></dict>
</dict>
</plist>
```

```bash
# 登録（自動起動を開始）
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.ctag.embed.plist
# 停止・解除
launchctl bootout gui/$(id -u)/com.ctag.embed
# ログ
tail -f /tmp/ctag-embed.log
```

> 常駐化しない場合、マシン再起動後は :8082 が消え、アプリは degrade に自動フォールバックします（明示記憶の最近順注入）。

## 制限事項（v1）

- **会話履歴は永続化なし**: 会話は in-memory でサーバ再起動で消えます（`ChannelStore` interface 差し替えで SQLite/JSON 対応可能）。なお[記憶（メモリ）](#記憶学習メモリ)は `.data/memories.json` に永続化され再起動でも残ります。
- **認証・分離なし**: 全チャンネルが全員に見える公開スペース。
- **単一プロセス前提**: pub/sub はプロセス内 EventEmitter（水平スケールには別途 pub/sub 基盤が必要）。

## スクリプト

```bash
npm run dev     # 開発サーバ
npm run build   # 本番ビルド
npm run start   # 本番起動
npm run lint    # ESLint
```
