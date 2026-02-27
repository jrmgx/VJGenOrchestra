#!/usr/bin/env bash

set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUT_DIR="${SCRIPT_DIR}/assets/videos/clips"
VIDEOS_JSON="${SCRIPT_DIR}/assets/videos/videos.json"

if [[ $# -eq 0 ]]; then
  echo "Usage: $(basename "$0") file.gif [file2.gif ...]"
  exit 1
fi

mkdir -p "$OUT_DIR"
NEW_ENTRIES=()

for arg in "$@"; do
  if [[ ! -f "$arg" ]]; then
    echo "Error: not a file: $arg" >&2
    exit 1
  fi
  base=$(basename "$arg" .gif)
  out_mp4="${OUT_DIR}/${base}.mp4"
  out_thumb="${OUT_DIR}/${base}-thumb.jpg"

  echo "Converting: $arg -> $out_mp4"
  ffmpeg -y -i "$arg" -movflags +faststart -pix_fmt yuv420p \
    -vf "scale=trunc(iw/2)*2:trunc(ih/2)*2" "$out_mp4"

  echo "Generating thumbnail: $out_thumb"
  ffmpeg -y -i "$out_mp4" -ss 0 -vframes 1 -q:v 2 "$out_thumb" 2>/dev/null || true

  rel_mp4="assets/videos/clips/${base}.mp4"
  rel_thumb="assets/videos/clips/${base}-thumb.jpg"
  NEW_ENTRIES+=("{\"path\":\"${rel_mp4}\",\"thumb\":\"${rel_thumb}\"}")
done

[[ -f "$VIDEOS_JSON" ]] || echo "[]" > "$VIDEOS_JSON"
content=$(cat "$VIDEOS_JSON")
for entry in "${NEW_ENTRIES[@]}"; do
  content="${content%]},${entry}]"
done
echo "$content" > "$VIDEOS_JSON"
echo "Updated ${VIDEOS_JSON}"
