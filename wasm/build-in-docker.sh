#!/usr/bin/env bash
#
# Emscripten の Docker イメージ上で shtsume の WebAssembly 版をビルドする。
# 成果物は build/wasm/shtsume/ に出力される (詳細は wasm/build.sh を参照)。
#
# 環境変数
#   EMSDK_IMAGE  使用する Docker イメージ (既定: emscripten/emsdk:4.0.15)
#   OUT_DIR      wasm/build.sh にそのまま渡す。
set -euo pipefail

repo_root=$(cd "$(dirname "$0")/.." && pwd)
image=${EMSDK_IMAGE:-emscripten/emsdk:4.0.15}

docker run --rm \
  --user "$(id -u):$(id -g)" \
  -e HOME=/tmp \
  -e OUT_DIR \
  -v "$repo_root:/src" \
  -w /src \
  "$image" \
  bash wasm/build.sh
