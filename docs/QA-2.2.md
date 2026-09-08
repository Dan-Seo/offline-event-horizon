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

The complete WebGPU approach route passed all five regional arrivals and local manual flight, plus GR initialization, pause, drag, horizon crossing, portrait layout, touch look, numerical stop, and exterior recovery. No shader/runtime errors or warnings occurred. The initial timestamp run preceded only the final canopy-normal smoothing and two QA-script additions.

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

## Coverage limits

WebGPU/WebGL2, production acceptance, and final deployment records are being completed. This local record alone does not certify the public runtime.

Physical phones, Safari, Firefox, prolonged thermal behavior, and long-duration memory stability require separate testing. The GR render is capped and upscaled; very thin high-order images can alias or exceed the integration budget. Planetary mirrors use tangent planes, atmospheric/cloud scattering is approximate, and full planetary landing remains out of scope. No new Blender assets or UE5 edition were added in this update. No participant study or therapeutic outcome is claimed.
