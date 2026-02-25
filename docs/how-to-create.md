[← back](../README.md)

# How to create a new standalone visualizer for later integration in the orchestrator

Open your favorite (vibe) coding editor/tool and ask for anything.<br>
Use the recommended prompt below to start your session.

For example:

> I want to show bright bubbles that moves with the rhythm of the music.
> Lighting effect should pop when a kick happen.
> Make an option so I can display more or less bubble on screen.

## Recommended prompt for later integration

Use this at the start of your coding session when building a new visualizer:

> I'm building a standalone visualizer that I may later integrate into VJGenOrchestra. Keep the visual logic self-contained: separate the render/draw code from setup (audio, canvas creation, UI). Use a single render function that receives audio data and draws one frame—avoid tying the loop to document or window. Keep controls (toggles, sliders, etc.) in one place so they can be moved or wired elsewhere later. This will make conversion to the engine format straightforward.

Iterate on your own as much as you need and when ready you can integrate it easily in the main project.

## Tips to create a good visualizer

Do not add multiple effects into one visualizer, work on one concept and push it to its limit.<br>
The goal is to have multiple visualizers combined in the engine.

The engine exposes pre-filtered audio values (kick, bass, mid, high), live kick detection and more to come.

Do not add too many options: maybe you can use some options when developing your visualizer to find the sweet spot for specific values
and remove the options in the final version letting your value hardcoded.
