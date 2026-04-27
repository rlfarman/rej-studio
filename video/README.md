# Walkthrough video pipeline

Playwright drives the live app and captures stills + a `timeline.json`.
Remotion composes those stills into a motion video with zooms, captions,
music, and an outro.

## One-time setup

```bash
pnpm install
pnpm exec playwright install chromium
```

Drop an MP3 at `video/public/music/soundtrack.mp3`. Any track will do; the
composition fades it in at the start and out during the outro. Without a
file, render will fail — remove the `<Audio>` block in
`video/src/Walkthrough.tsx` if you want a silent cut.

## Flow

The script walks this path (edit `video/capture.ts` to change it):

1. `/genes` — focus the search box
2. Type `MYO7A`, focus the first result
3. Open the gene detail page, find the largest isoform row
4. Highlight its **Customize** button
5. Open the design tool pre-populated with that isoform
6. Highlight **Run optimizer**, submit, wait for results
7. Zoom on the score and the objectives report
8. Outro: logo + tagline + music tail

## Run it

In one terminal:

```bash
BYPASS_AUTH=true pnpm dev
```

In another:

```bash
pnpm video:capture    # walks the app, writes frames + timeline.json
pnpm video:studio     # optional: Remotion studio for live preview
pnpm video:render     # renders to video/out/walkthrough.mp4
# or both in one shot:
pnpm video
```

Override the target URL if the app runs elsewhere:

```bash
VIDEO_BASE_URL=https://staging.rej.studio pnpm video:capture
```

## Tweaking

- **Shot timing + captions** — tune `capture.ts` per call, or post-edit
  `video/timeline.json` before re-rendering (no re-capture needed).
- **Zoom intensity** — `startScale` / `endScale` in `video/src/Shot.tsx`.
- **Focus ring** — delete the ring `<div>` in `Shot.tsx` if too busy.
- **Outro copy** — `video/src/Outro.tsx`.
- **Resolution** — `WIDTH` / `HEIGHT` in `capture.ts` and the composition
  reads them back via `timeline.json`.

## Notes

- Playwright selectors were picked for stability (roles, placeholder regex,
  `href*=` patterns) but will drift if the UI changes materially. When a
  capture run fails, re-run with `PWDEBUG=1 pnpm video:capture` to step
  through the script.
- Frames and renders are gitignored. `timeline.json` is committed as a
  stub so the Remotion studio opens even before the first capture.
