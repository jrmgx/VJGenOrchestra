# VJGenOrchestra Visualizer Agent

This file provides instructions for working with the VJGenOrchestra visualizer engine.

## Coding rules

This project is already in advanced development stage so:

- Try to use existing Classes, methods, components.
- Use the same way of doing thing; most new features will be variations of existing ones.
- Refactor often.

**IMPORTANT:**

- Do not be too verbose in your code.
- Never remove attribution links.
- Find the root cause of bugs; do not try workarounds.
- Do not implement defensive code by default; keep everything simple.
- Always double check if your new code can be refactored with existing code.
- The engine should be agnostic and not know about specific visualizers.
- If you start the server via `npx http-server -p 8888`, stop it after your test.

## JSON formatting

Always pretty-format JSON for human readability.

Example:

```json
["entry", "entry"]
```

should be:

```json
[
  "entry",
  "entry"
]
```

## General project info

This project is an orchestrator of visualizers called VJGenOrchestra. It behaves as a library giving components to visualizers.

### Structure

```
VJGenOrchestra/
├── index.html
├── index.css
├── engine/
│   ├── engine.js        # Orchestrator + compositing loop
│   ├── audio.js         # Mic access (getUserMedia + AnalyzerNode)
│   ├── audioAnalysis.js # Pre-filtered audio values (kick, bass, mid, high)
│   ├── audio-options.html # Global Audio options (detection tuning)
│   ├── canvas.js        # Main canvas + offscreen canvas creation
│   └── options.css      # Shared styles for options.html (transparent bg, sans-serif bold black text)
└── visualizers/
    ├── manifest.json  # ["ex1", "ex2", ...] – list of visualizer ids
    ├── ex1/
    │   ├── index.js
    │   └── options.html
    └── ex2/
        └── index.js
```

The engine discovers visualizers from `manifest.json` on load. Add a new folder and its id to the manifest to register it.

### Canvas architecture

- **Main canvas** – Single visible canvas shown to the user. Cleared and recomposited each frame.
- **Offscreen canvases** – Each active visualizer renders to its own offscreen canvas. The engine composites them onto the main canvas in manifest order (first = bottom layer).
- Visualizers can render on transparent backgrounds to allow layering and future image operations between canvases.

### Visualizer contract

Each visualizer lives in `visualizers/[id]/index.js`. Export:

- **render(canvas, ctx, audio, container, options, engine)** – called each frame. Draw to the provided `canvas`/`ctx`, or use `container` to inject your own canvas (e.g. Three.js WebGL). Use `audio.getByteFrequencyData()` or `audio.analyser.getByteTimeDomainData()` for raw audio. Pre-filtered values: `audio.kick` (0/1), `audio.bass`, `audio.mid`, `audio.high` (0–1). `options` is an object from `options.html` (see below).
- **cleanup(canvas, container, slot)** *(optional)* – called when the visualizer is turned off. Remove injected elements, dispose resources, and clear `container.visualizerState`.
- **State**: Use `container.visualizerState` for any per-instance state (scene, renderer, etc.). Do NOT use module-level variables for instance-specific data—the same visualizer can be loaded multiple times in the manifest and each instance must work independently.

Add the id to `manifest.json` to register it.

**Additional rules for all visualizers:**

- Prefer transparent backgrounds (`clearRect` or alpha compositing) so layers blend when multiple visualizers are active.
- **Post-processors**: export `postProcess: true` and receive the current composite as 7th param: `render(canvas, ctx, audio, container, options, engine, sourceCanvas)`. Use `sourceCanvas` as texture/source. Your output replaces all previous layers on the main canvas; the chain then continues with normal merging for visualizers after you. Example: A, B, post C, D → C receives A+B merged, C replaces them, final = C+D merged.

### Options (options.html)

Visualizers can define `options.html` in their folder for external controls. The engine loads it in an iframe and displays it in the options box.

- Use `name` or `id` on inputs for keys. Values are passed as `options` to `render()`.
- Example: `<input type="range" name="speed" min="0" max="2" value="1">` → `options.speed`
- Checkbox → boolean, number/range → number, else string.
- If no `options.html` exists, the section shows "[name] has no options" and is not collapsible.
- **options.css**: The engine injects `engine/options.css` into the iframe on load (transparent background, sans-serif bold black text, labels as blocks). No need to link it manually.
- **Audio options**: A global "Audio" section appears at the top of the options panel. Use it to tune kick detection (threshold, diff, frames) for all visualizers.

#### Custom option groups (hidden + buttons)

For pick-one-from-many options (e.g. color scheme, mode, shape), use a hidden input plus buttons with `data-value`:

```html
<label>Mode
  <input type="hidden" name="mode" value="city" id="mode">
  <button type="button" data-value="city" title="City">🏢</button>
  <button type="button" data-value="forest" title="Forest">🌲</button>
</label>
```

- The hidden input holds the selected value; use `name` for the options key.
- Each button has `data-value="<value>"` — the engine detects these for automix schema extraction.
- Container: the hidden input must be inside a `label` or a `div` that also contains the buttons (so the engine finds them via `closest("label") || parentElement`).
- On click: set `input.value = btn.dataset.value`, dispatch `change`, and sync button state (opacity, selected class).
- Listen for `optionsApplied` to sync when options are set programmatically (e.g. automix).
- For dynamically created buttons (from a list), use `btn.dataset.value = item.id` (or path, etc.). See Metaball, VideoClips, Particles, BirdsEye, TunnelWrap.

#### File inputs

File inputs must NOT be in `options.html` (they cannot pass `File` objects across iframe boundaries). Export `fileInputs` from your visualizer; the engine creates trigger buttons in the main app:

```js
export const fileInputs = {
  glb: { accept: ".glb,.gltf", label: "Choose GLB" },
  texture: { accept: "image/*", label: "Texture" },  // multiple supported
};
```

- Each key maps to `options[key]` (e.g. `options.glb`, `options.texture`).
- When the user selects a file, it is passed to `render()` as `options[key]`.
- Multiple file inputs are supported via multiple keys. See `visualizers/glb3d`, `visualizers/Damien` for reference.

## Creating or converting visualizers

### Option 1: Create a new visualizer from scratch

Use when the user wants to add a new visualizer, create a visual effect, or build a custom visualization.

### Option 2: Convert an existing standalone visualizer

Use when the intent is to convert an existing standalone visualizer to work with VJGenOrchestra.

## Step by step instructions

### Create new visualizer

- Create `visualizers/[id]/index.js` that exports `render(canvas, ctx, audio, container, options, engine)` and optionally `cleanup(canvas, container, slot)`.
- Implement `render`: draw to the provided `canvas`/`ctx`. Use `audio.getByteFrequencyData()` or `audio.analyser.getByteTimeDomainData()` for raw audio; use `audio.kick`, `audio.bass`, `audio.mid`, `audio.high` for pre-filtered values.
- The engine calls `render` each frame—no `requestAnimationFrame` loop needed.
- For custom canvases (e.g. Three.js), inject into `container` instead of `document.body`.
- **State**: Store per-instance state (scene, renderer, etc.) in `container.visualizerState`. Do NOT use module-level variables—the same visualizer can appear multiple times in the manifest and each instance must work independently. In `cleanup`, clear `container.visualizerState` and dispose resources.
- Add `options.html` for UI controls (toggles, sliders) with `name`/`id` on inputs; values arrive as `options`. For file inputs, use the `fileInputs` export instead.
- Add the id to `manifest.json`.
- See `visualizers/SimpleViz`, `Simple3D` for reference.

### Convert existing visualizer

- Convert the standalone visualizer in `[DIR]` to work with VJGenOrchestra.
- Create `visualizers/[id]/index.js` that exports `render(canvas, ctx, audio, container, options, engine)` and optionally `cleanup(canvas, container, slot)`.
- Replace their audio setup with the passed `audio` (use `audio.getByteFrequencyData()` or `audio.analyser.getByteTimeDomainData()`).
- Replace their `requestAnimationFrame` loop—the engine calls `render` each frame.
- For custom canvases (e.g. Three.js), inject into `container` instead of `document.body`.
- **State**: Store per-instance state (scene, renderer, etc.) in `container.visualizerState`. Do NOT use module-level variables—the same visualizer can appear multiple times in the manifest and each instance must work independently. In `cleanup`, clear `container.visualizerState` and dispose resources.
- Move UI controls (toggles, sliders) to `options.html` with `name`/`id` on inputs; values arrive as `options`. For file inputs, use the `fileInputs` export instead.
- Add the id to `manifest.json`. See `visualizers/SimpleViz`, `Simple3D` for reference.

## Skills and server

- **Create a visualizer**: see skill `/create-visualizer` (or project skill **create-visualizer**).
- **Convert a standalone visualizer**: see skill `/convert-to-visualizer` (or project skill **convert-to-visualizer**).

To start the project locally:

`npx http-server -p 8888`

(Stop the server after tests; see Coding rules above.)
