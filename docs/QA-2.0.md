# VASTNESS 2.0 verification

Date: 2026-09-08. This record belongs to the sanctuary refactor. `QA.md` and its original evidence describe the earlier universe edition.

## Implemented and inspected

The existing free-flight, camera-relative coordinate mapping, sector streaming, WebGPU matter buffers, planets, nebulae, and Blender Cathedral remain. Five procedural local environments coexist on one ocean world. The starting viewpoint is the mirror sea; no chapter manager or forced progression was added.

Real Chrome browser pages were driven using Playwright mouse, keyboard, wheel, and CDP touch input. Screenshots were opened and inspected during iteration, including the opening sea, waterfall, forest, cloud garden, living sky, mobile portrait, and WebGL2. QA diagnostics are read-only; there is no teleport or event-trigger test API.

Visual fixes included:

- Negative-base shader `pow` produced a checkerboard on the sea. Absolute/nonnegative bases removed the artifact.
- Asynchronous shader warm-up and nested reflection initially attempted to bind unfinished pipelines. The reflection's first real draw now follows shader compilation before flight becomes available.
- Island generation had a fractional-power edge case and reversed winding; both were corrected.
- Back-face cloud depth testing removed mist in front of cliffs. The final refinement copies opaque depth independently for the main view and mirror, clips each ray to the visible surface, and integrates that interval. This also removed the horizontal bands caused by truncating a fixed sample grid on nearby trunks. Depth copies are skipped during asynchronous compilation and released on disposal.
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

## Initial production validation

Runtime commit `1fe5908` was built successfully on Vercel and published at [offline-vastness.vercel.app](https://offline-vastness.vercel.app). Deployment `dpl_Hu5MeFJqRTB8BHCY5rzbwiZLbs18`; [immutable deployment](https://offline-event-horizon-lfb2e9vul-sf-i455.vercel.app).

The actual public page was opened, rendered, and visually inspected after deployment. Chrome 152.0.7977.82 and Edge 152.0.4191.66 each passed 40 control checks. The device/fallback suite passed another 33 checks on the public URL, including simultaneous touch controls, the automatic WebGL2 path, persistent creation, opt-in audio controls, and successful context-loss recovery. Unexpected browser/shader errors: **0** in those runs. These were browser-automation checks with real input events, not a human participant study.

The deployed poster, both hero GLBs, and both fonts returned HTTP 200 and matched the committed files byte-for-byte. [Reports and rendered screenshots](evidence/vastness-2.0-initial) include deployment identity and separate local/production provenance. This initial evidence predates the final depth refinement.

The public build was also observed during continuous travel to Moonfall and the Living Sky, followed by 70 seconds of stillness. Both environmental events appeared without camera takeover or notifications. A separate 110-second Wander run stayed within 100 local units of its starting position, paused repeatedly, and held its composition during the sea visitor. W interrupted it immediately afterward. Those event runs used concurrent browser instances to inspect behavior; their frame-rate readings are not the isolated performance benchmark.

### Isolated production performance

After the other QA browser instances closed, the public build was measured at 2560×1440, DPR 1, High, on the same NVIDIA Ampere/Chrome workstation. Initial readiness: **3,463ms**. All eight sampled scenarios had p95 **7.0ms** (approximately 144 Hz frame cadence). Largest interval: **41.6ms** during the surface-to-anomaly flight. Frames over 50ms: **0**. Unexpected browser/shader errors: **0**. The updated forest, cloud garden, and anomaly screenshots were inspected after this run.

High renders 80,000 matter particles plus 8,192 living particles; geometry counters include the reflected scene. Procedural streaming continued beyond 600,000 local units and retained 27 resident sectors. See [the initial production measurement](evidence/vastness-2.0-initial/production-performance.json) for per-scenario intervals and counters. These are short workstation observations, not GPU timestamp queries or a guarantee for other devices.

## Final depth-refinement deployment

Runtime commit `f4dd0d4` passed the local production build and Vercel's build, then replaced the production alias. Deployment `dpl_5f8TSBVmxZ4oewBEpFv65NBwT544`; [immutable deployment](https://offline-event-horizon-9bst2gq9i-sf-i455.vercel.app). [Final reports and screenshots](evidence/vastness-2.0) are separate from the initial deployment evidence above.

The public URL was reopened after publication. Chrome and Edge again passed **40 controls each**. The device/fallback suite again passed **33 checks**, including two-thumb movement and look, pinch, DPR/resize, local creation persistence, opt-in audio, absent-WebGPU selection, and context-loss recovery. No unexpected browser or shader errors occurred. A continuous flight into the forest on WebGL2/Battery also completed without errors; its rendered trunks were inspected for the corrected fog bands.

The final sea, Moonfall, Living Sky, and mobile portrait were visually inspected. An additional 110-second production Wander run paused repeatedly, held its composition during the sea visitor, and yielded immediately to W afterward. The visitor and its reflection are recorded in `production-signature.jpg`. The opening visual check reported no browser warnings or errors. Five production assets again returned HTTP 200 and matched local SHA-256 hashes.

After those browser instances closed, the final public runtime was measured independently at **2560×1440, DPR 1, High**, Chrome **152.0.7977.82**, NVIDIA **Ampere**. Initial readiness was **3,487ms**. All eight scenarios had p95 **7.0ms**; the longest interval was **48.6ms**, during surface-to-space travel. Frames over 50ms: **0**. Unexpected errors: **0**. High remained selected throughout. The final forest, cloud garden, and anomaly screenshots from this run were opened and inspected.

| Final runtime scenario | p95 interval | Largest interval | Frames over 50ms |
| ---------------------- | -----------: | ---------------: | ---------------: |
| Opening                |        7.0ms |           20.9ms |                0 |
| Water to forest        |        7.0ms |            7.1ms |                0 |
| Forest stillness       |        7.0ms |            7.1ms |                0 |
| Cloud garden flight    |        7.0ms |            7.1ms |                0 |
| Inside clouds          |        7.0ms |            7.1ms |                0 |
| Surface to anomaly     |        7.0ms |           48.6ms |                0 |
| Procedural streaming   |        7.0ms |           13.9ms |                0 |
| Light and gravity      |        7.0ms |            7.1ms |                0 |

[Full final performance report](evidence/vastness-2.0/production-performance.json). These are short observed browser frame intervals on this workstation, not direct GPU duration measurements or a guarantee for physical mobile devices.

## Practical limits

- Only Chrome/Edge Chromium paths available in this environment can be exercised. Safari, Firefox, physical phones/tablets, thermals, and long-duration memory stability are not covered.
- Trees are stylized procedural geometry and remain permeable to flight. Broad island/ocean collision floors are provided; other planets do not offer full terrain landing.
- The reflection is planar, while the visible ocean cap is curved. Near-terrain volumetric occlusion, moonbow, visitor motion, atmosphere, and waterfall flow are cinematic approximations.
- Small creatures use actual damped force integration around an analytic shared flow, not an all-pairs biological flocking model.
- Browser automation verifies behavior and rendered output. No human usability study or therapeutic-efficacy evaluation has occurred.
- Personal image capture, COLMAP reconstruction, and UE5 work remain unperformed; the reconstruction document and helper prepare a future contribution.
