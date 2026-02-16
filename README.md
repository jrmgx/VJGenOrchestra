# VJGenOrchestra

Also called VJ-GO.

Orchestrator for VJ visualizers. Provides shared building blocks (audio, canvas) and lets users combine multiple effects.

## How it works

1. **Start** – Click to enable audio and canvas (browser requires user gesture).
2. **Engine** – Wires the audio analyser and canvas display.
3. **Canvas system** – One visible canvas composites all active visualizers. Each visualizer renders to its own offscreen canvas; the engine draws them in order onto the main canvas.
4. **Controls** – Toggle each visualizer on/off independently. Multiple can be active at once.

## Structure

```
VJGenOrchestra/
├── index.html
├── engine/
│   ├── engine.js      # Orchestrator + compositing loop
│   ├── audio.js       # Mic access (getUserMedia + AnalyserNode)
│   └── canvas.js      # Main canvas + offscreen canvas creation
└── visualizers/
    ├── manifest.json  # ["ex1", "ex2", ...] – list of visualizer ids
    ├── ex1/
    │   └── index.js   # Frequency bars
    └── ex2/
        └── index.js   # Rotating rays
```

The engine discovers visualizers from `manifest.json` on load. Add a new folder and its id to the manifest to register it.

## Canvas architecture

- **Main canvas** – Single visible canvas shown to the user. Cleared and recomposited each frame.
- **Offscreen canvases** – Each active visualizer renders to its own offscreen canvas. The engine composites them onto the main canvas in manifest order (first = bottom layer).
- Visualizers can render on transparent backgrounds to allow layering and future image operations between canvases.

## Visualizer contract

Each visualizer lives in `visualizers/[id]/index.js`. Export:

- **render(canvas, ctx, analyser, container)** – called each frame. Draw to the provided `canvas`/`ctx`, or use `container` to inject your own canvas (e.g. Three.js WebGL). Use `analyser.getByteFrequencyData()` or `getByteTimeDomainData()` for audio reactivity.
- **cleanup(canvas, container)** *(optional)* – called when the visualizer is turned off. Remove injected elements and restore state.

Add the id to `manifest.json` to register it.

## Run

### Setup your computer

#### Windows

Go into your Windows Sound Settings and enable "Stereo Mix" as an input device. Then VJ-GO will treat your computer's output as a "Microphone," letting you listen to it easily.

#### macOS

1. Install [Blackhole](https://existential.audio/blackhole/) (virtual audio driver).
2. Open **Audio MIDI Setup** and create a **Multi-Output Device** that includes Blackhole and your speakers. Set it as the system output so audio plays and is routed to Blackhole.
3. When VJ-GO asks for microphone access, choose **Blackhole** as the input. This lets the visuals react to your system audio.

### Run the VJ-GO

From the Generatives root:

```bash
npx http-server -p 8888
```

Open `http://localhost:8888/VJGenOrchestra/`.
