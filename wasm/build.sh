#!/usr/bin/env bash
#
# shtsume の WebAssembly 版をビルドする。
# Emscripten (emcc) が使える環境で実行すること。
# Docker で Emscripten の環境を用意する場合は wasm/build-in-docker.sh を使う。
#
# 成果物は ShogiHome の WebAssembly エンジン ABI (shogihome-wasm-engine/1) に従い、
# そのまま ShogiHome の public/engines/<dir>/ に配置できる。
#
#   build/wasm/shtsume/
#     engine.json   マニフェスト
#     shtsume.js    Emscripten のグルーコード (ES モジュール)
#     shtsume.wasm
#     LICENSE.txt
#
# 環境変数
#   OUT_DIR     成果物の出力先 (既定: build/wasm/shtsume)
set -euo pipefail

repo_root=$(cd "$(dirname "$0")/.." && pwd)
cd "$repo_root"

out_dir=${OUT_DIR:-build/wasm/shtsume}

rm -rf "$out_dir"
mkdir -p "$out_dir"

emcc -std=gnu11 -Wall -O3 \
  -pthread \
  -Isource \
  source/*.c wasm/exports.c \
  -o "$out_dir/shtsume.js" \
  -sMODULARIZE=1 \
  -sEXPORT_ES6=1 \
  -sEXPORT_NAME=createShtsume \
  -sENVIRONMENT=worker,node \
  -sINVOKE_RUN=0 \
  -sALLOW_MEMORY_GROWTH=1 \
  -sMAXIMUM_MEMORY=2GB \
  -sPTHREAD_POOL_SIZE=1 \
  --pre-js wasm/shim.js \
  -sEXPORTED_FUNCTIONS=_usi_command,_malloc,_free \
  -sEXPORTED_RUNTIME_METHODS=ccall,cwrap
chmod a-x "$out_dir/shtsume.wasm"

# エンジンを起動して id / option の申告を取得し、マニフェストを生成する
node wasm/gen-manifest.mjs wasm/manifest.json "$out_dir/shtsume.js" "$out_dir/engine.json"
cp LICENSE "$out_dir/LICENSE.txt"

echo "WebAssembly engine package: $out_dir"
ls -l "$out_dir"
