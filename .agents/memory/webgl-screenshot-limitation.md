---
name: WebGL apps can't be screenshot-verified
description: The agent screenshot tool runs headless Chrome with no GPU, so WebGL/canvas-GL apps fail to render in screenshots even when they work in a real browser.
---

# WebGL apps cannot be visually verified via the screenshot tool

The `screenshot` tool (app_preview) uses headless Chrome with **no GPU/WebGL**
(`VENDOR=0xffff, DEVICE=0xffff`, `webglcontextcreationerror: Failed to initialize WebGL`).
Any library that requires a WebGL context — **MapLibre GL / Mapbox GL, three.js,
deck.gl, regl, PixiJS (WebGL mode)** — will throw on init and render nothing in a
screenshot, even though it renders fine in the user's real browser (the Replit
preview iframe is the user's actual GPU-backed Chrome).

**Why:** the headless screenshotter has no hardware acceleration; passing
`failIfMajorPerformanceCaveat: false` does not help because there is no driver at all.

**How to apply:**
- Don't treat a blank/fallback map (or empty 3D canvas) in an agent screenshot as a
  bug. Verify these apps via typecheck, console logs, and code review instead.
- Wrap WebGL init in try/catch and render a graceful fallback UI so a WebGL-less
  context doesn't white-screen the whole React tree (the rest of the app should still
  work). Construction of `new maplibregl.Map(...)` throws **synchronously** on
  context-creation failure, so a try/catch around the constructor is enough.
- Tell the user explicitly that the map/3D view can't be screenshot-verified but will
  work in their browser.
