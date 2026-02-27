#!/usr/bin/env bash

set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUT_DIR="${SCRIPT_DIR}/assets/videos/clips"
VIDEOS_JSON="${SCRIPT_DIR}/assets/videos/videos.json"

if [[ $# -eq 0 ]]; then
  echo "Usage: $(basename "$0") video.mp4 [video2.mov ...]"
  exit 1
fi

mkdir -p "$OUT_DIR"
NEW_ENTRIES=()

for arg in "$@"; do
  if [[ ! -f "$arg" ]]; then
    echo "Error: not a file: $arg" >&2
    exit 1
  fi
  base=$(basename "$arg")
  base_no_ext="${base%.*}"
  out_video="${OUT_DIR}/${base}"
  out_thumb="${OUT_DIR}/${base_no_ext}-thumb.jpg"

  echo "Moving: $arg -> $out_video"
  mv "$arg" "$out_video"

  echo "Generating thumbnail: $out_thumb"
  ffmpeg -y -i "$out_video" -ss 0 -vframes 1 -q:v 2 "$out_thumb" 2>/dev/null || true

  rel_video="assets/videos/clips/${base}"
  rel_thumb="assets/videos/clips/${base_no_ext}-thumb.jpg"
  NEW_ENTRIES+=("{\"path\":\"${rel_video}\",\"thumb\":\"${rel_thumb}\"}")
done

if [[ ${#NEW_ENTRIES[@]} -gt 0 ]]; then
  [[ -f "$VIDEOS_JSON" ]] || echo "[]" > "$VIDEOS_JSON"
  content=$(cat "$VIDEOS_JSON")
  for entry in "${NEW_ENTRIES[@]}"; do
    content="${content%]},${entry}]"
  done
  echo "$content" > "$VIDEOS_JSON"
  echo "Updated ${VIDEOS_JSON}"
fi
