# Add Your Own Videos to VideoClips

The VideoClips visualizer plays video files from `assets/videos/`.<br>
Use the provided scripts to add your own clips.

## Prerequisites

- [ffmpeg](https://ffmpeg.org/) installed on your system

## Add Existing Video Files

For mp4, mov, webm, or other video files you already have:

```bash
./add_video_clip.sh my-video.mp4
```

This moves the file to `assets/videos/clips/`, generates a thumbnail, and appends the entry to `assets/videos/videos.json`.

Multiple files:

```bash
./add_video_clip.sh video1.mp4 video2.mov
```

## Convert GIF to Video

To use animated GIFs, convert them first:

```bash
./transform_gif_to_videoclip.sh my-animation.gif
```

This converts the GIF to MP4, places it in `assets/videos/clips/`, generates a thumbnail, and appends the entry to `assets/videos/videos.json`.

### Finding good GIFs

- Example search on [giphy.com/search/geometry](https://giphy.com/search/geometry)

### Manual conversion with ffmpeg

```bash
ffmpeg -i input.gif -movflags +faststart -pix_fmt yuv420p -vf "scale=trunc(iw/2)*2:trunc(ih/2)*2" output.mp4
ffmpeg -y -i output.mp4 -ss 0 -vframes 1 -q:v 2 output-thumb.jpg
```

- `-movflags +faststart`: Optimizes for web playback
- `-pix_fmt yuv420p`: Ensures broad browser compatibility
- `-vf "scale=..."`: Ensures even dimensions (required for yuv420p)

## File Layout

Videos go in: **`assets/videos/clips/`**<br>
The scripts update **`assets/videos/videos.json`** automatically.<br>
You may need to do it manually: each entry has `path` and `thumb`.

## Tips

- For short GIFs, use `-ss 0` when generating thumbnails.
- Keep file sizes reasonable for smooth web playback.
- Loop your GIF before converting if you want seamless playback.
