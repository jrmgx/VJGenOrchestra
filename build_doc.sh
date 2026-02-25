#!/usr/bin/env bash
set -e

cd "$(dirname "$0")"

# Convert .md links to .html in generated HTML
fix_links() {
  local f="$1"
  if [[ "$OSTYPE" == darwin* ]]; then
    sed -i '' 's/href="\([^"]*\)\.md\([^"]*\)"/href="\1.html\2"/g' "$f"
  else
    sed -i 's/href="\([^"]*\)\.md\([^"]*\)"/href="\1.html\2"/g' "$f"
  fi
}

npx marked README.md -o readme.html
fix_links readme.html

for f in docs/*.md; do
  [ -f "$f" ] || continue
  out="${f%.md}.html"
  npx marked "$f" -o "$out"
  fix_links "$out"
done
