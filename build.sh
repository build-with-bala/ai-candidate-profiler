#!/usr/bin/env bash
# Builds self-contained executables for all supported OS/arch targets.
# Requires Bun >= 1.1 (https://bun.sh). Run from the repo root.
set -euo pipefail
cd "$(dirname "$0")"

VERSION=$(grep -o 'VERSION = "[^"]*"' src/main.ts | cut -d'"' -f2)
mkdir -p dist

declare -a TARGETS=(
  "bun-darwin-arm64  ai-profiler-macos-arm64"
  "bun-darwin-x64    ai-profiler-macos-x64"
  "bun-linux-x64     ai-profiler-linux-x64"
  "bun-linux-arm64   ai-profiler-linux-arm64"
  "bun-windows-x64   ai-profiler-windows-x64.exe"
)

for entry in "${TARGETS[@]}"; do
  read -r target out <<<"$entry"
  echo "→ $out  ($target)"
  bun build --compile --minify --target="$target" src/main.ts --outfile "dist/$out"
done

echo
echo "Built v$VERSION:"
ls -lh dist/
