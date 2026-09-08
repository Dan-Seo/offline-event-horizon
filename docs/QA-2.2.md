# VASTNESS 2.2 verification

Dates: 2026-09-08–09, Korea time. This update preserves the sanctuary universe, free cursor, language guide, procedural streaming, and existing matter experiment. It adds five attached planetary regions and an optional Schwarzschild freefall observation.

## What changed

The **Closer** action continues the existing damped flight through an approach waypoint into a regional environment on the selected planet. Selene has a fractured ice canyon and rising ice; Serein has wind-shaped dune ridges; Ember has a dark cooling caldera; Nacre has a reflective lagoon and instanced luminous vegetation; the Silent Giant has enterable cloud volumes beneath its rings. These are regional spherical caps or volumes, not complete planet-wide landing systems. The camera remains in the existing world coordinate system. Translation immediately interrupts automatic descent.

**Beyond the horizon** is an explicitly optional scientific observation at The Wound. The observer follows analytic radial free fall; a lazy TSL shader integrates Schwarzschild null geodesics with adaptive RK4. The explanatory panel distinguishes proper time, display playback, tidal ratios, and source-frequency transfer. Drag and touch change the view without confining the cursor. Translation or Esc restores the saved exterior view. This is an application reset, not a physical escape. The original Newtonian matter experiment remains separate.

The [model document](RELATIVITY.md) contains equations, primary references, source assumptions, and numerical limits. No observed interior, rotating black hole, singularity image, quantum-gravity result, or GRMHD calculation is claimed.

## Corrections made through inspection

- Regional approaches initially rolled the horizon; arrival orientation now uses each region's local up direction.
- Terrain that looked like a raised square from orbit now sinks below the parent globe at its outer rim. Collision clearance uses the same deterministic height field and spherical-cap geometry, including liquid surfaces.
- Global regional fog flattened the sky; local volumes and restrained background influence retain distant depth.
- Nacre's stylized glowing water was replaced with actual scene reflection on a curved lagoon, using an observer-local tangent mirror. Canopy geometry and normals were refined after inspecting its close view.
- Ember's initially bright disk became a predominantly dark caldera with narrow emissive cooling seams. The gas giant's regional solid ground was removed; it uses cloud volumes and a forgiving navigation envelope.
- The first GR view was overexposed and poorly framed. Emission/exposure and the observer lens were adjusted while retaining the geodesic equations. The dark region and incoming sky are both visible in the default view.
- A cancelled observation now shares its complete shader-preparation promise with a subsequent request. The cancellation token prevents an abandoned request from taking camera control.

## Numerical and build checks

Production build and TypeScript compilation passed. `npm test`: **18 passed**. These include the existing Newtonian, language, coordinate, and streaming tests, seven GR checks, and two regional terrain checks.

The GR fixtures check continuous horizon crossing, null-cone signs, trace-free tides, local null normalization, the circular photon orbit at `1.5 r_s`, the critical impact parameter, incoming exterior light inside the horizon, and disk frequency transfer. A 366-ray grid is compared with four-times-finer integration. Escaped fixtures preserve the normalized energy invariant within `2.5e-4` and converge within `0.002 rad`. This is a fixture-based regression check; it does not bound every GPU pixel. The initial coarser integrator failed a near-critical convergence case and was refined before the accepted run.

The terrain tests sample 8,405 positions across five regional height fields to keep the collision envelope above rendered terrain and water. A separate boundary check confirms the cap rims are buried beneath the parent sphere. Vegetation is intentionally permeable.

## Local browser observation

The static production export was opened at `http://localhost:4173` in installed Chrome through Playwright. Scripts send actual keyboard, mouse, wheel, and CDP touch input. They read diagnostic state but never teleport the camera or inject simulation state. Rendered screenshots were opened and inspected. This is automated browser acceptance testing with visual inspection, not a human usability study.

The complete WebGPU approach route passed all five regional arrivals and local manual flight, plus GR initialization, pause, drag, horizon crossing, portrait layout, touch look, numerical stop, and exterior recovery. No shader/runtime errors or warnings occurred. The initial timestamp run preceded only the final canopy-normal smoothing and additional QA checks/metadata.

On the final local runtime, the WebGL2/Battery route also passed the GR observation and Nacre/Giant descents, including cancellation during initial shader preparation. The final lagoon, canopy, cloud/ring composition, GR view, and portrait panel were opened as rendered screenshots and inspected.

| Local suite                       | Passed | Coverage                                                                                                |
| --------------------------------- | -----: | ------------------------------------------------------------------------------------------------------- |
| WebGPU approaches and observation |     32 | All five regions, horizon crossing, free drag/touch, pause, stop and recovery                           |
| WebGL2 approaches and observation |     21 | Same observation; Nacre/Giant; cancellation during preparation                                          |
| Chrome controls                   |     48 | Free cursor, simultaneous keys/drag, boost/precision, focus, immediate manual takeover, resize          |
| Korean/English onboarding         |     19 | Actual-input guide, language persistence, replay and optional Wander                                    |
| Touch guide                       |     18 | Touch look, movement and pinch; portrait, landscape, tablet and laptop                                  |
| Devices and fallback              |     34 | DPR, touch, Quiet, audio controls, creation persistence, missing WebGPU and context recovery            |
| Existing orbit and matter         |     18 | Serein orbit, event-level manual takeover, capture/escape, gravity, pause, clearing and portrait layout |

These completed local suites reported no unexpected browser/shader errors. The device suite deliberately lost the WebGL context and recorded the expected diagnostic separately before verifying its visible recovery path.

The local profiling run used High quality, DPR 1, a 1600×1000 viewport, and 180 sampled frames per location. P95 browser frame intervals were 7.0ms. P95 GPU render-pass durations were approximately 0.52ms at the opening, 2.03ms near the photon sphere, 2.16ms inside the horizon, and 1.70–2.30ms at the five regions. GPU values come from Three.js timestamp queries, aggregate render passes for the most recent frame, and exclude CPU work and presentation. Quantized compute readings of zero do not mean computation is free. These are observations from this development host, not physical-phone or general hardware guarantees. The exact distributions are retained in [local-webgpu-profile.json](evidence/vastness-2.2/local-webgpu-profile.json).

## Public runtime

The final runtime is commit `b7cd6237f5156da0cd35e01d48834f5d85b64d7f`, deployed to [offline-vastness.vercel.app](https://offline-vastness.vercel.app). Vercel reported READY for `dpl_B4wn1CyQrbMkg6a9uRa5sMiSSkM7`; the immutable deployment is [offline-event-horizon-4zvsi2p98-sf-i455.vercel.app](https://offline-event-horizon-4zvsi2p98-sf-i455.vercel.app). The [GitHub build](https://github.com/Dan-Seo/offline-event-horizon/actions/runs/34242403714) passed installation, TypeScript, tests, and production compilation. Five public assets returned HTTP 200 with SHA-256 hashes identical to the committed files. Deployment and asset records are retained in `evidence/vastness-2.2`.

The public alias was opened in actual installed Chrome. The complete WebGPU approach/observation suite passed **35 checks**, including all five regional arrivals, translation during descent, GR startup cancellation/reopening, horizon crossing, pause, mouse/touch look, Quiet pointer pass-through, the numerical stop, and exterior recovery. All five new planetary views, the opening, the exterior/interior GR views, and the portrait observation panel were opened and visually inspected. No shader/runtime errors or warnings occurred in this route. The updated canopy has smooth normals, the lagoon reflects the surrounding scene, and the scientific panel remains readable at 390×844.

The remaining public suites also passed: **48 Chrome control checks**, **48 Edge control checks** (Edge 152.0.4191.66), **19 onboarding checks**, **18 touch-guide checks**, **34 device/fallback checks**, and **19 WebGL2 observation/Nacre checks**. The WebGL2 route verified preparation cancellation, pause, horizon crossing, free drag/touch, Quiet, the numerical stop, recovery, and the reflective planetary approach at Battery quality. There were no unexpected runtime/shader errors. Deliberately induced WebGL context loss is recorded separately and its visible recovery path passed.

Reports and selected actual rendered screenshots are retained in [evidence/vastness-2.2](evidence/vastness-2.2/). The browser automation supplied actual keyboard, pointer and CDP touch events; no human participant or physical-phone test is implied. The runtime was not changed during these production suites. Later commits that only record this evidence do not change the deployed application.

## Public performance observation

[production-webgpu.json](evidence/vastness-2.2/production-webgpu.json) records Chrome **152.0.7977.82**, an **NVIDIA Ampere** adapter, **1600×1000**, **DPR 1**, and **High** quality throughout. Initial readiness took **5,001ms**. The profiling route ran alone before the other automated browsers were launched. Each of eight steady views was sampled for 180 frames after arrival; this does not measure every transition frame or constitute a thermal soak.

| View             | GPU render p95, ms | Browser frame interval p95, ms |
| ---------------- | -----------------: | -----------------------------: |
| Opening sea      |               0.52 |                            7.0 |
| Photon sphere    |               2.10 |                            7.0 |
| Inside horizon   |               2.16 |                            7.0 |
| Nacre lagoon     |               1.84 |                            7.0 |
| Giant cloud tops |               5.51 |                            7.1 |
| Selene canyon    |               2.10 |                            7.0 |
| Ember caldera    |               2.82 |                            7.0 |
| Serein dunes     |               0.59 |                            7.0 |

The largest sampled browser interval was **20.8ms** at Serein. GPU render timestamps exclude CPU work and presentation; they must not be inverted into a claim about achieved FPS. Short headless-browser cadence measurements on this host do not predict physical-phone performance. Full distributions, quantized compute measurements, quality, renderer, and camera snapshots are retained in the JSON.

## Coverage limits

Physical phones, Safari, Firefox, prolonged thermal behavior, and long-duration memory stability require separate testing. The GR render is capped and upscaled; very thin high-order images can alias or exceed the integration budget. Planetary mirrors use tangent planes, atmospheric/cloud scattering is approximate, and full planetary landing remains out of scope. No new Blender assets or UE5 edition were added in this update. No participant study or therapeutic outcome is claimed.
