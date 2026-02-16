# VJGenOrchestra

Also called VJ-GO.

Orchestrator for VJ visualizers. Provides shared building blocks (microphone, canvas) and lets users switch between effects.

## How it works

1. **Start** – Click to enable microphone and canvas (browser requires user gesture).
2. **Engine** – Wires the microphone analyser and canvas display.
3. **Visualizers** – Each effect receives `{ canvas, ctx, analyser }` and draws one frame per loop.
4. **Controls** – Switch between effects (ex1, ex2, etc.).

## Structure

```
VJGenOrchestra/
├── index.html
├── engine/
│   ├── engine.js      # Orchestrator + effect switching
│   ├── microphone.js  # Mic access (getUserMedia + AnalyserNode)
│   └── canvas.js      # Canvas + effect loop
└── visualizers/
    ├── manifest.json  # ["ex1", "ex2"] – list of visualizer ids
    ├── ex1/
    │   └── index.js   # Frequency bars
    └── ex2/
        └── index.js   # Rotating rays
```

The engine discovers visualizers from `manifest.json` on load. Add a new folder and its id to the manifest to register it.

## visualizer contract

Each visualizer lives in `visualizers/[id]/index.js`. Export a `render(canvas, ctx, analyser)` function. It is called each frame. Use `analyser.getByteFrequencyData()` or `getByteTimeDomainData()` for audio reactivity. Add the id to `manifest.json` to register it.

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
