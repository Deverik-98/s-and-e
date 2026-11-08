#!/usr/bin/env bash
# Pull invite codes from Apps Script (action=codes) → invites.txt → static pages.
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$root"

SCRIPT_URL="${SE_SCRIPT_URL:-}"
if [[ -z "$SCRIPT_URL" ]]; then
  SCRIPT_URL="$(node -e "const c=require('fs').readFileSync('js/config.js','utf8'); const m=c.match(/scriptUrl:\\s*\\\"([^\\\"]+)/); if(!m) process.exit(1); process.stdout.write(m[1])")"
fi

echo "Fetching codes from Apps Script..."
# Avoid Cursor sandbox HTTP proxy (403 CONNECT to script.google.com)
json="$(env -u https_proxy -u http_proxy -u HTTPS_PROXY -u HTTP_PROXY -u ALL_PROXY -u all_proxy \
  curl -sL --max-time 60 "${SCRIPT_URL}?action=codes")"
echo "$json" | head -c 300; echo

tmp="$(mktemp)"
printf '%s' "$json" > "$tmp"
node - "$tmp" <<'NODE'
const fs = require("fs");
const raw = fs.readFileSync(process.argv[2], "utf8");
let data;
try { data = JSON.parse(raw); } catch (e) {
  console.error("Invalid JSON from Apps Script. Did you deploy Code.gs with action=codes?");
  console.error(raw.slice(0, 300));
  process.exit(1);
}
if (!data.ok || !Array.isArray(data.codes)) {
  console.error("Unexpected response:", data);
  process.exit(1);
}
const codes = [...new Set(data.codes.map((c) => String(c).trim()).filter(Boolean))].sort();
const lines = ["# Auto-generated from sheet — do not edit by hand", "demo", ...codes];
fs.writeFileSync("invites.txt", lines.join("\n") + "\n");
console.log(`Wrote invites.txt with ${codes.length} sheet code(s) + demo`);
NODE
rm -f "$tmp"

# Drop stale invite folders not listed in invites.txt
for slug in nos-casamos te-invitamos-a-nuestra-boda; do
  [[ -d "$slug" ]] || continue
  find "$slug" -mindepth 1 -maxdepth 1 -type d | while read -r dir; do
    code="$(basename "$dir")"
    if ! grep -qx "$code" invites.txt; then
      echo "Removing stale $dir"
      rm -rf "$dir"
    fi
  done
done

./scripts/gen-invite-pages.sh
echo "Done. Review git status, then commit & push when ready."
