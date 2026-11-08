#!/usr/bin/env bash
# Generate HTTP-200 invite pages for WhatsApp/Open Graph.
# GitHub Pages returns 404 for unknown paths; scrapers ignore OG on 404.
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$root"

slugs=("nos-casamos" "te-invitamos-a-nuestra-boda")
codes_file="${1:-invites.txt}"

if [[ ! -f "$codes_file" ]]; then
  echo "Missing $codes_file" >&2
  exit 1
fi

count=0
while IFS= read -r raw || [[ -n "$raw" ]]; do
  code="$(echo "$raw" | tr -d '[:space:]')"
  [[ -z "$code" || "$code" == \#* ]] && continue
  for slug in "${slugs[@]}"; do
    dir="$slug/$code"
    mkdir -p "$dir"
    cp -f index.html "$dir/index.html"
    count=$((count + 1))
  done
done < "$codes_file"

echo "Generated $count invite page(s) from $codes_file"
