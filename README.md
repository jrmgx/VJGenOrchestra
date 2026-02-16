# VJGenOrchestra

Also called VJ-GO.

Orchestrator for VJ visualizers. Provides shared building blocks (audio, canvas) and lets users combine multiple effects.

## Create your own standalone visualizer

### Create a good visualizer

Do not add multiple effects into one visualizer, work on one concept and push it to its limit.
The goal is to have multiple visualizer combined in the engine.

Do not add too many options: maybe you can use some options when developing your visualizer to find the sweet spot for specific values and remove the options in the final version letting your value hardcoded.

### Recommended prompt for later integration

Use this at the start of a coding session when building a new visualizer you plan to integrate into VJGenOrchestra later:

> I'm building a standalone visualizer that I may later integrate into VJGenOrchestra. Keep the visual logic self-contained: separate the render/draw code from setup (audio, canvas creation, UI). Use a single render function that receives audio data and draws one frame—avoid tying the loop to document or window. Keep controls (toggles, sliders, etc.) in one place so they can be moved or wired elsewhere later. This will make conversion to the engine format straightforward.

Iterate on your own as much as you need and when ready you can integrate it easily in the main project.

## How it works

1. **Start** – Click to enable audio and canvas (browser requires user gesture).
2. **Engine** – Wires the audio analyser and canvas display.
3. **Canvas system** – One visible canvas composites all active visualizers. Each visualizer renders to its own offscreen canvas; the engine draws them in order onto the main canvas.
4. **Controls** – Toggle each visualizer on/off independently. Multiple can be active at once.

## Structure

```
VJGenOrchestra/
├── index.html
├── index.css
├── engine/
│   ├── engine.js      # Orchestrator + compositing loop
│   ├── audio.js       # Mic access (getUserMedia + AnalyserNode)
│   ├── canvas.js      # Main canvas + offscreen canvas creation
│   └── options.css    # Shared styles for options.html (transparent bg, sans-serif bold black text)
└── visualizers/
    ├── manifest.json  # ["ex1", "ex2", ...] – list of visualizer ids
    ├── ex1/
    │   ├── index.js
    │   └── options.html
    └── ex2/
        └── index.js
```

The engine discovers visualizers from `manifest.json` on load. Add a new folder and its id to the manifest to register it.

## Canvas architecture

- **Main canvas** – Single visible canvas shown to the user. Cleared and recomposited each frame.
- **Offscreen canvases** – Each active visualizer renders to its own offscreen canvas. The engine composites them onto the main canvas in manifest order (first = bottom layer).
- Visualizers can render on transparent backgrounds to allow layering and future image operations between canvases.

## Visualizer contract

Each visualizer lives in `visualizers/[id]/index.js`. Export:

- **render(canvas, ctx, analyser, container, options)** – called each frame. Draw to the provided `canvas`/`ctx`, or use `container` to inject your own canvas (e.g. Three.js WebGL). Use `analyser.getByteFrequencyData()` or `getByteTimeDomainData()` for audio reactivity. `options` is an object from `options.html` (see below).
- **cleanup(canvas, container)** *(optional)* – called when the visualizer is turned off. Remove injected elements and restore state.

Add the id to `manifest.json` to register it.

## Options (options.html)

Visualizers can define `options.html` in their folder for external controls. The engine loads it in an iframe and displays it in the options box.

- Use `name` or `id` on inputs for keys. Values are passed as `options` to `render()`.
- Example: `<input type="range" name="speed" min="0" max="2" value="1">` → `options.speed`
- Checkbox → boolean, number/range → number, else string.
- If no `options.html` exists, the section shows "[name] has no options" and is not collapsible.
- **options.css**: The engine injects `engine/options.css` into the iframe on load (transparent background, sans-serif bold black text, labels as blocks). No need to link it manually.

## Run

### Setup your computer

#### Windows

Go into your Windows Sound Settings and enable "Stereo Mix" as an input device. Then VJ-GO will treat your computer's output as a "Microphone," letting you listen to it easily.

#### macOS

1. Install [Blackhole](https://existential.audio/blackhole/) (virtual audio driver).
2. Open **Audio MIDI Setup** and create a **Multi-Output Device** that includes Blackhole and your speakers. Set it as the system output so audio plays and is routed to Blackhole.
3. When VJ-GO asks for microphone access, choose **Blackhole** as the input. This lets the visuals react to your system audio.

### Run the VJ-GO

From the directory root:

```bash
npx http-server -p 8888
```

Open `http://localhost:8888/VJGenOrchestra/`.
