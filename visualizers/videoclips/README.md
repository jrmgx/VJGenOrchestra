# videoclips

Video loop visualizer with audio-reactive playback speed.

## Assets

Place mp4 files in `assets/videos/` (any subfolder). Add thumbnails and update the list:

```bash
# Generate thumbnails (creates *-thumb.jpg next to each .mp4)
for f in assets/videos/**/*.mp4; do
  ffmpeg -y -i "$f" -ss 1 -vframes 1 -q:v 2 "${f%.mp4}-thumb.jpg" 2>/dev/null
done

# Update visualizers/videoclips/videos.js with the new list
```
