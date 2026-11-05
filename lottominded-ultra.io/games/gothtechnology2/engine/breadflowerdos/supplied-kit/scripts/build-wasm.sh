#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
CXX="${WASM_CXX:-clang++}"
command -v "$CXX" >/dev/null || { echo 'Install LLVM clang++ with wasm32 and wasm-ld support.' >&2; exit 1; }
mkdir -p dist
"$CXX" --target=wasm32 -std=c++20 -O2 -fno-fast-math -fno-builtin \
  -fno-exceptions -fno-rtti -nostdinc++ -nostdlib \
  -Iengine/freestanding -Iengine/include -Ithird_party/breadflowerdos/src \
  engine/src/input_bridge.cpp -Wl,--no-entry \
  -Wl,--export=sr_abi_version -Wl,--export=sr_capabilities \
  -Wl,--export=sr_slots -Wl,--export=sr_upstream_id \
  -Wl,--export=sr_clear -Wl,--export=sr_set -Wl,--export=sr_has -Wl,--export=sr_get \
  -Wl,--initial-memory=131072 -Wl,--max-memory=131072 -Wl,-z,stack-size=16384 \
  -o dist/breadflower-input.wasm
printf 'Built isolated input proof: dist/breadflower-input.wasm\n'
