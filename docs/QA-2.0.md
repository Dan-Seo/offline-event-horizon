# VASTNESS 2.0 verification

Date: 2026-09-08. This record belongs to the sanctuary refactor. `QA.md` and its original evidence describe the earlier universe edition.

## Implemented and inspected

The existing free-flight, camera-relative coordinate mapping, sector streaming, WebGPU matter buffers, planets, nebulae, and Blender Cathedral remain. Five procedural local environments coexist on one ocean world. The starting viewpoint is the mirror sea; no chapter manager or forced progression was added.

Real Chrome browser pages were driven using Playwright mouse, keyboard, wheel, and CDP touch input. Screenshots were opened and inspected during iteration, including the opening sea, waterfall, forest, cloud garden, living sky, mobile portrait, and WebGL2. QA diagnostics are read-only; there is no teleport or event-trigger test API.

Visual fixes included:

- Negative-base shader `pow` produced a checkerboard on the sea. Absolute/nonnegative bases removed the artifact.
- Asynchronous shader warm-up and nested reflection initially attempted to bind unfinished pipelines. The reflection's first real draw now follows shader compilation before flight becomes available.
- Island generation had a fractional-power edge case and reversed winding; both were corrected.
- Back-face cloud depth testing removed mist in front of cliffs. Volume entry/exit selection plus local surface haze now provides a bounded approximation.
- Grass color used transformed height and overexposed to white triangles. A per-vertex blade-tip attribute now controls its color.
- Waterfall curtains reached above the curved sea. Their lower extent and mist placement now meet the local water.
- Reflections were visibly coarse. Resolution now scales from .30 to .85 with quality.
- Tree canopies, trunk smoothness, and foliage distribution were refined; lower tiers retain leaves across the whole grove.
- Sanctuary focus labels and destination menus no longer occupy the default view.

## Controls and resilience

Local Chrome checks passed for immediate WASD, W+D, pointer lock, relative mouse while flying, wheel, boost, precision, roll, rise/descend, damped release, body selection, F approach, manual interruption, right-drag orbit, help, pause/resume, reset, blur recovery, water wakes, and resizing. Double-click recentering is included in the final acceptance script.

Laptop 1366×768, tablet-like 1024×768, phone-like 390×844, and landscape 844×390 viewports were exercised. Touch tests sent actual simultaneous touch input for movement, look, pinch, release, and selection. Canvas hit testing, horizontal overflow, drawing-buffer/DPR consistency, reduced-motion preference, Quiet, opt-in audio controls, local creation persistence, and keyboard controls after resize were checked.

With `navigator.gpu` unavailable, the renderer selected WebGL2 and remained navigable. Reduced CPU fields, visible context-loss recovery and the working retry link passed. Failed hero downloads kept the procedural fallback. Deliberately slowed frame scheduling caused automatic High→Balanced adaptation. Four quality tiers and the optional stress scenarios stayed live. Expected injected asset/context-loss errors are recorded separately from unexpected errors.

## Local performance observation

Static production build, Chrome 152.0.7977.82, NVIDIA Ampere adapter, 2560×1440, DPR 1, High. The scene opened in about 3.9 seconds on this machine. Browser frame intervals were sampled independently of the artwork's HUD.

| Scenario             | p95 frame interval | Largest interval | Frames over 50ms |
| -------------------- | -----------------: | ---------------: | ---------------: |
| Opening              |              7.0ms |            7.2ms |                0 |
| Water to forest      |              7.0ms |            7.2ms |                0 |
| Forest stillness     |              7.0ms |            7.1ms |                0 |
| Cloud-garden flight  |              7.0ms |            7.1ms |                0 |
| Inside clouds        |              7.0ms |            7.1ms |                0 |
| Surface to anomaly   |              7.0ms |           62.5ms |                1 |
| Procedural streaming |              7.0ms |           27.8ms |                0 |

This local measurement preceded the final trunk smoothing. The deployed build is measured separately below. No claim of 144 FPS on other GPUs or mobile hardware follows from this result. Counters include reflection/post-processing work. Compute submission time is CPU scheduling cost, not GPU execution time.

## Build and mathematical checks

Production export and TypeScript checks passed. Three existing coordinate/streaming tests passed. Three analytic Python fixtures passed for the optional reconstruction-audit helper, covering a nontrivial world-to-camera rotation, sparse IDs and empty observations, known pixel residual, and radial distortion. These fixtures are not a captured reconstruction or study result.

## Production validation

Pending deployment of this revision. This section will be updated only after opening and checking the public URL.

## Practical limits

- Only Chrome/Edge Chromium paths available in this environment can be exercised. Safari, Firefox, physical phones/tablets, thermals, and long-duration memory stability are not covered.
- Trees are stylized procedural geometry and remain permeable to flight. Broad island/ocean collision floors are provided; other planets do not offer full terrain landing.
- The reflection is planar, while the visible ocean cap is curved. Near-terrain volumetric occlusion, moonbow, visitor motion, atmosphere, and waterfall flow are cinematic approximations.
- Small creatures use actual damped force integration around an analytic shared flow, not an all-pairs biological flocking model.
- Browser automation verifies behavior and rendered output. No human usability study or therapeutic-efficacy evaluation has occurred.
- Personal image capture, COLMAP reconstruction, and UE5 work remain unperformed; the reconstruction document and helper prepare a future contribution.
