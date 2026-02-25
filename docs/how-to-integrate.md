[← back](../README.md)

# How to integrate your own visualizer in VJGenOrchestra

For this part you will need `git` and a GitHub account.<br>
Cursor App is also recommended.

## Integration

When your visualizer is working, you should have some files for it.<br>
To integrate it into this project:

1. Get the VJGenOrchestra source code with `git`
2. Create a new directory under `visualizers` with the name you want.
3. Copy your visualizer files into it.
4. Prompt something like:

> Convert the visualizer in **DIR** so it works with VJGenOrchestra engine /convert-to-visualizer

The best App to do that would be Cursor.com as some skills have been written to help it do the job.<br>
If needed you can use the rules for your own tool, they are in `.cursor/skills`

## Contribution

To publish your visualizer to the project, you should:

1. Create a `git branch` with your visualizer name
2. Commit your changes to it
3. Push the branch back to GitHub
