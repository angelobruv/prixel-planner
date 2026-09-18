#!/usr/bin/env bash
# Validate a PRIXEL project and screenshot the plate.
#   preview.sh <project.json> [out.png]
# Env: PRIXEL_VIEW=build (mirrored setup view) · PRIXEL_GRID=1 (keep the grid on)
set -euo pipefail
here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo="$(cd "$here/../../../.." && pwd)"
json="$(cd "$(dirname "$1")" && pwd)/$(basename "$1")"
out="${2:-$repo/.prixel-preview.png}"
[ -f "$json" ] || { echo "no such project: $json" >&2; exit 1; }

# Vite must be on 127.0.0.1 — a default `npm run dev` binds ::1 only, and
# Playwright's baseURL then gets connection-refused.
if ! curl -sf -o /dev/null http://127.0.0.1:5173; then
  echo "starting dev server…"
  (cd "$repo" && nohup npx vite --host 127.0.0.1 >/tmp/prixel-vite.log 2>&1 &)
  for _ in $(seq 1 30); do curl -sf -o /dev/null http://127.0.0.1:5173 && break; sleep 1; done
fi

# Playwright's bundled Chromium is often not installed; the system one works.
if [ -z "${PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH:-}" ] \
   && [ -x "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" ]; then
  export PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
fi
cd "$repo"
PRIXEL_JSON="$json" PRIXEL_OUT="$out" \
  npx playwright test --config "$here/preview.config.mjs"
