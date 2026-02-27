# Convert GIF to Video Clip for VideoClips Visualizer

The VideoClips visualizer uses HTML5 `<video>` elements, which do not support GIF files. To use animated GIFs, you must convert them to MP4 first.

## Finding good GIF

- Example search on [giphy.com/search/geometry](https://giphy.com/search/geometry)

## Prerequisites

- [ffmpeg](https://ffmpeg.org/) installed on your system

## Quick Start

Use the provided script from the project root:

```bash
./transform_gif_to_videoclip.sh my-animation.gif
```

This converts the GIF to MP4, generates a thumbnail, places both in `assets/videos/clips/`, and appends the entry to `assets/videos/videos.json`.

## Manual Conversion with ffmpeg

### 1. Convert GIF to MP4

```bash
ffmpeg -i input.gif -movflags +faststart -pix_fmt yuv420p -vf "scale=trunc(iw/2)*2:trunc(ih/2)*2" output.mp4
```

- `-movflags +faststart`: Optimizes for web playback (metadata at the start)
- `-pix_fmt yuv420p`: Ensures broad browser compatibility
- `-vf "scale=..."`: Ensures even dimensions (required for yuv420p)

### 2. Generate Thumbnail

```bash
ffmpeg -y -i output.mp4 -ss 1 -vframes 1 -q:v 2 output-thumb.jpg
```

- `-ss 1`: Seeks to 1 second (or first frame if shorter)
- `-vframes 1`: Extracts one frame
- `-q:v 2`: Good quality (default)

## Where to Put the Files

Place the resulting MP4 and thumbnail in:

- **`assets/videos/clips/`** – for clips (recommended for GIFs)
- **`assets/videos/loops/`** – for seamless loops

Example paths:

```
assets/videos/clips/my-animation.mp4
assets/videos/clips/my-animation-thumb.jpg
```

## What Gets Updated

The script automatically appends new entries to **`assets/videos/videos.json`**. Each entry has:

- **`path`**: Path to the MP4 file (relative to project root)
- **`thumb`**: Path to the thumbnail JPG

## Tips

- Loop your GIF before converting if you want seamless playback: use `-loop` or `-stream_loop` in ffmpeg.
- For short GIFs, the thumbnail may be at frame 0; use `-ss 0` or a very small value.
- Keep file sizes reasonable for smooth web playback (lower resolution or bitrate if needed).
