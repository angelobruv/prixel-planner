#!/usr/bin/env bash
# Contact sheet of piece artwork at all four rotations, with the cell grid drawn.
#   pieces.sh [out.png]                      every piece, small
#   PRIXEL_SKUS=PX-012,PX-028 pieces.sh o.png just these, large
#   pieces.sh --measure PX-012 [out.png]      also print which corner is solid (exact, geometric)
set -euo pipefail
here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo="$(cd "$here/../../../.." && pwd)"
if [ "${1:-}" = "--measure" ]; then export PRIXEL_SKUS="$2" PRIXEL_MEASURE=1; shift 2; fi
out="${1:-$repo/.prixel-pieces.png}"
if ! curl -sf -o /dev/null http://127.0.0.1:5173; then
  (cd "$repo" && nohup npx vite --host 127.0.0.1 >/tmp/prixel-vite.log 2>&1 &)
  for _ in $(seq 1 30); do curl -sf -o /dev/null http://127.0.0.1:5173 && break; sleep 1; done
fi
if [ -z "${PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH:-}" ] \
   && [ -x "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" ]; then
  export PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
fi
cd "$repo"
PRIXEL_OUT="$out" npx playwright test --config "$here/pieces.config.mjs" | grep -vE "^\s*$|passed|Running|preview|›|✓"
