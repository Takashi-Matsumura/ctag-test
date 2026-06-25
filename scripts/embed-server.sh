#!/usr/bin/env bash
#
# セマンティック記憶想起用の embedding サーバを :8082 で起動する。
# 生成用 LLM(:8080) とは別プロセス・別モデル。日本語対応の bge-m3（CLS プーリング）。
# モデルは初回に HuggingFace から自動ダウンロード（以降はキャッシュを再利用）。
#
# 単発起動:   bash scripts/embed-server.sh
# 常駐化:     README の「常駐化（macOS launchd）」を参照。
#
set -euo pipefail

# launchd 配下では PATH が最小になりうるため、llama-server を解決してフォールバックする。
LLAMA_SERVER="$(command -v llama-server || true)"
if [ -z "${LLAMA_SERVER}" ]; then
  LLAMA_SERVER="/opt/homebrew/bin/llama-server"
fi

exec "${LLAMA_SERVER}" \
  --hf-repo bbvch-ai/bge-m3-GGUF --hf-file bge-m3-q4_k_m.gguf \
  --embeddings --pooling cls \
  --host 127.0.0.1 --port 8082 \
  -c 2048 -ngl 99
