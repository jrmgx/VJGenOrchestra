---
name: convert-to-visualizer
description: Convert a standalone/external visualizer codebase to a visualizer compatible with our engine
---

# Convert to Visualizer

## When to use

When the intent is to convert an existing standalone visualizer use these instructions:

## Instructions

### General rules

To get a working visualizer please follow these instructions:

 - You must render onto the Canvas passed to render(canvas, ctx, audio, container, options, engine)
 - Each visualizer renders to its own offscreen canvas; the engine composites all active ones onto the main canvas
 - Prefer transparent backgrounds (clearRect or alpha compositing) so layers blend when multiple visualizers are active
 - Get audio from the passed `audio` object: `audio.getByteFrequencyData()`, `audio.analyser`, or pre-filtered `audio.kick`, `audio.bass`, `audio.mid`, `audio.high` (see SimpleBar for reference)
 - For custom canvases (e.g. Three.js), use the container to inject your canvas; the engine will composite it
 - Post-processors: export `postProcess: true` and receive the current composite as 7th param: `render(canvas, ctx, audio, container, options, engine, sourceCanvas)`. Use sourceCanvas as texture/source. Your output replaces all previous layers on the main canvas; the chain then continues with normal merging for visualizers after you. Example: A, B, post C, D → C receives A+B merged, C replaces them, final = C+D merged.
 - Options: add `options.html` in your visualizer folder. Use `name` or `id` on inputs for keys. Values are passed as `options` (5th param). Example: `<input type="range" name="speed" min="0" max="2" value="1">` → `options.speed`. The engine injects `engine/options.css` for shared styles (transparent bg, sans-serif bold black text, label as block).

### File inputs

File inputs must NOT be in `options.html` (they cannot pass `File` objects across iframe boundaries). Instead, export `fileInputs` from your visualizer:

```js
export const fileInputs = {
  glb: { accept: ".glb,.gltf", label: "Choose GLB" },
  texture: { accept: "image/*", label: "Texture" },  // multiple supported
};
```

- Each key maps to `options[key]` (e.g. `options.glb`, `options.texture`).
- The engine creates a trigger button in the main app; when the user selects a file, it is passed to `render()` as `options[key]`.
- Multiple file inputs are supported via multiple keys. See `visualizers/glb3d`, `visualizers/Damien` for reference.

### Step by step instructions

 - Convert this standalone visualizer in `[DIR]` to work with VJGenOrchestra.
 - Create `visualizers/[id]/index.js` that exports `render(canvas, ctx, audio, container, options, engine)` and optionally `cleanup(canvas, container)`. The engine object provides `engine.text` (text from the bottom panel) for visualizers that need it.
 - Replace their audio setup with the passed `audio` (use `audio.getByteFrequencyData()` or `audio.analyser.getByteTimeDomainData()`).
 - Replace their `requestAnimationFrame` loop—the engine calls `render` each frame.
 - For custom canvases (e.g. Three.js), inject into `container` instead of `document.body`.
 - Move UI controls (toggles, sliders) to `options.html` with `name`/`id` on inputs; values arrive as `options`. For file inputs, use the `fileInputs` export instead.
 - Add the id to `manifest.json`. See `visualizers/SimpleBar`, `SimpleCube`, `glb3d` for reference.
