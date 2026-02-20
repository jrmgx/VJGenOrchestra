# VJGenOrchestra

Also called VJ-GO.

Orchestrator for VJ visualizers.
Provides shared building blocks (audio, canvas) and lets users combine multiple visualizers.

The end goal is to allow anyone to vibe-code their visualizer idea and easily integrate them with other visualizers to combine things together.

## Guide

This is how you should use this project:
1. First you (vibe) code a standalone visualizer on your own.
2. You integrate your visualizer into the Orchestrator.
3. You play with the Orchestrator (that now contains your visualizer as well as the other ones).

### 1- How to create a new standalone visualizer for later integration in the orchestrator?

Open your favorite (vibe) coding editor/tool and ask for anything.
Use the recommended prompt below to start your session.

For example:
> I want to show bright bubbles that moves with the rhythm of the music.
> Lighting effect should pop when a kick happen.
> Make an option so I can display more or less bubble on screen.

#### Recommended prompt for later integration

Use this at the start of your coding session when building a new visualizer:

> I'm building a standalone visualizer that I may later integrate into VJGenOrchestra. Keep the visual logic self-contained: separate the render/draw code from setup (audio, canvas creation, UI). Use a single render function that receives audio data and draws one frame—avoid tying the loop to document or window. Keep controls (toggles, sliders, etc.) in one place so they can be moved or wired elsewhere later. This will make conversion to the engine format straightforward.

Iterate on your own as much as you need and when ready you can integrate it easily in the main project.

#### Tips to create a good visualizer

Do not add multiple effects into one visualizer, work on one concept and push it to its limit.
The goal is to have multiple visualizers combined in the engine.

The engine exposes pre-filtered audio values (kick, bass, mid, high), live kick detection and more to come.

Do not add too many options: maybe you can use some options when developing your visualizer to find the sweet spot for specific values
and remove the options in the final version letting your value hardcoded.

### 2- How to integrate your own visualizer in VJGenOrchestra?

For this part you will need `git` and a GitHub account.
Cursor App is also recommended.

#### Integration

When your visualizer is working, you should have some files for it.
To integrate it into this project:
1. Get the VJGenOrchestra source code with `git`
2. Create a new directory under `visualizers` with the name you want.
3. Copy your visualizer files into it.
4. Prompt something like:
> Convert the visualizer in **DIR** so it works with VJGenOrchestra engine /convert-to-visualizer

The best App to do that would be Cursor.com as some skills have been written to help it do the job.
If needed you can use the rules for your own tool, they are in `.cursor/skills`

#### Contribution

To publish your visualizer to the project, you should:
1. Create a `git branch` with your visualizer name
2. Commit your changes to it
3. Push the branch back to GitHub

### 3- How to run VJGenOrchestra?

#### Setup your computer

##### Windows

Go into your Windows Sound Settings and enable "Stereo Mix" as an input device.
Then VJ-GO will treat your computer's output as a "Microphone," letting you listen to it easily.

##### macOS

1. Install [Blackhole](https://existential.audio/blackhole/) (virtual audio driver).
2. Open **Audio MIDI Setup** and create a **Multi-Output Device** that includes Blackhole and your speakers.
   Set it as the system output so audio plays and is routed to Blackhole.
3. When VJ-GO asks for microphone access, choose **Blackhole** as the input. This lets the visuals react to your system audio.

#### Run VJ-GO

You need `npm` installed on your computer, then from the directory root:

```bash
npx http-server -p 8888
```

And open `http://localhost:8888`

Most feature are self explanatory, but the bottom panel may need more info, check the next section.

Keyboard shortcut that are shown on the user interface are accessible with `ctrl` key + symbol.

##### Bottom panel

The bottom panel has multiple parts:

1- The **audio** part on the left lets you tune kick detection in real time while playing.

##### What it shows

- **Bass | Mid | High** – Three bars for the current frequency levels (bass = low, mid = mid, high = treble).
- **Red/green line** – The **min level** threshold. Bass must be above this line for a kick to trigger. The line turns green when bass is above it.
- **Rise strip** (below the bars) – How much the bass jumped from the previous frame. The **orange vertical line** is the **min rise** threshold. When the gray/green bar passes that line and bass is above the red line, a kick is detected.
- **Kick LED** – Lights up when a kick is detected.

##### Sliders

| Slider      | Meaning                                                                 |
|------------|-------------------------------------------------------------------------|
| **Min level**  | Ignore kicks below this bass level. Use it to filter out noise.         |
| **Min rise**   | How much the bass must jump in one frame to trigger. Lower = more sensitive. |
| **Hold time**  | How long the kick stays "on" (in frames). Longer = visualizers react longer. |

Kick detection uses **transient** logic: it reacts to a sudden rise in bass, not to the level alone. If changing **Min level** has little effect, try **Min rise** instead—it controls sensitivity to bass jumps.

2- The **webcam** part on the right is to be defined. // TODO
