[← back](../README.md)

# Add Your Own Fonts to the Text Visualizer

The Text visualizer loads font files listed in `assets/fonts/fonts.json`.<br>
Bundled fonts live in `assets/fonts/`. You can add more by copying files and updating the manifest.

## Add a font file

1. Place a `.ttf` or `.woff2` file in **`assets/fonts/`** (use a short, ASCII filename without spaces if possible).

2. Open **`assets/fonts/fonts.json`** and append a new object to the array, for example:

```json
{
  "id": "my-display-font",
  "label": "My Display Font",
  "family": "VJGO_MyDisplayFont",
  "src": "assets/fonts/MyDisplayFont-Regular.ttf"
}
```

3. Reload the app (hard refresh) so the engine registers the new `@font-face` and the options list rebuilds.

## Field reference

| Field | Required | Description |
|--------|----------|-------------|
| `id` | Yes | Stable slug (letters, numbers, hyphens). |
| `label` | Yes | Name shown in the font picker. |
| `family` | Yes | Unique CSS `font-family` name. Use a prefix like `VJGO_` and **no spaces** so it matches canvas and the UI. Must be unique across all entries. |
| `src` | Yes for files | Path from the project root, e.g. `assets/fonts/YourFont.ttf`. Omit for built-in system entries (`system: true`). |
| `system` | No | Set to `true` only for the three system fonts (`sans-serif`, `serif`, `monospace`). |

Do not edit the three system entries unless you know what you are doing.

## Tips

- Prefer **WOFF2** or **TTF**; variable fonts are supported if the browser can load them.
- Keep **`family`** unique: duplicate names will conflict with `FontFace` registration.
- After changing `fonts.json`, keep it **pretty-printed** (readable array/objects) like the rest of the repo.
