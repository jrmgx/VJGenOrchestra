[← back](../README.md)

# How to use VJGenOrchestra

## Setup your computer

VJGenOrchestra use the microphone as the audio input source, so you need a tiny bit of setup to have it working.

### Windows

You can use an App like [Cable](https://vb-audio.com/Cable/).<br>
This App will allow you to route your sound to a virtual microphone and then use it into your web browser where you have VJGO started.

### macOS

You can use an App like [Blackhole](https://existential.audio/blackhole/) (virtual audio driver).<br>
Then open **Audio MIDI Setup** and create a **Multi-Output Device** that includes Blackhole and your speakers.<br>
This App will allow you to route your sound to a virtual microphone and then use it into your web browser where you have VJGO started.

## User Interface

Keyboard shortcut that are shown on the user interface are accessible with `ctrl` key + symbol.

VJGenOrchestra has three main parts: the **visualizer list** (left), the **options panel** (top right), and the **bottom panel**.

### Visualizer list

- **Blend mode:** How layers are combined (Normal, Lighten, etc.). Use `Ctrl`+`-` / `Ctrl`+`+` to cycle.
- **Effect buttons:** Click to toggle visualizers and post-processors on/off. Active effects show a green underline.
- **Drag & Drop:** Drag to reorder. Order = compositing order (first = bottom layer).
- **Shortcuts:** `Ctrl`+`1` … `Ctrl`+`0` toggles the first 10 effects.

### Options panel

- **Options:** Shows/hides the options box. When visible, each active effect has a collapsible section with its controls (sliders, colors, etc.). File inputs appear as trigger buttons.

### Bottom panel

**Audio (left):** Kick detection tuning. **Bass | Mid | High** bars show frequency levels.
Green line = min level; bass must be above it.
Rise strip = bass jump; orange line = min rise.
Kick triggers when both thresholds pass.
**Sliders:** Min level (filter noise), Min rise (sensitivity to jumps), Hold time (how long kick stays on).

**Automix (right) — BETA:** Checkbox to enable.
Multi-select lists define which visualizers and post-processors automix can turn on/off.
On each kick (with cooldown), it makes incremental changes: randomly toggles some effects and randomizes their options.

