# VASTNESS verification record

2026-09-08. Windows workstation, NVIDIA Ampere adapter. Installed Chrome through Playwright in headless mode, with the real GPU renderer and no unsafe WebGPU flags. Viewport emulation is not physical mobile-device testing.

## Build and asset checks

- Next.js static production build and strict TypeScript passed.
- Three tests passed: continuous monotonic angular-size distance mapping, local precision at large coordinates, and repeatable/distinct seeded sector generation.
- Dependency audit reported zero vulnerabilities.
- Blender 5.2.1 exported the original Cathedral hero and its lower-detail variant. Normals and UVs are present; four primitives/materials in each GLB. High: 31,308 triangles / 863,452 bytes. Low: 8,125 triangles / 288,196 bytes.

## Controls and viewports

The local production preview passed 30 desktop control checks. They exercise W, A, S, D, simultaneous W+D, mouse look during flight, wheel speed, Shift boost, settling, Q/E roll, Space, Ctrl precision, actual planet clicking, F approach, manual override, left-drag orbit, double-click travel, H help, P pause/resume, R recovery, Drift interruption, pointer lock/Escape, blur clearing, resize, canvas hit-testing, and horizontal overflow.

Another 32 checks covered laptop 1366×768, tablet 1024×768 at DPR 2, mobile 390×844 at DPR 2, and 844×390 landscape. Touch input is delivered with actual browser touch events: simultaneous movement/look, pinch speed, release damping, tap selection, and rotation. The mobile context requests reduced motion. The suite also checks gravity input, visible star creation, persistence after reload, Quiet, sound opt-in/mute, automatic WebGL2 fallback, CPU matter forces, and context-loss recovery.

No unexpected console errors occurred in those runs. The deliberately injected WebGL device-loss error is recorded separately. Sound controls were exercised; this is not a subjective listening evaluation.

Fifteen additional resilience checks passed: all four quality tiers and technical stress scenarios remain live, leaving stress restores the original budget, failed hero downloads retain navigation, and deliberately slowed frame scheduling triggers an automatic High-to-Balanced downgrade without breaking movement. Deliberate resource failures are recorded separately from unexpected console errors.

## Visual inspection and corrections

Actual browser captures cover the opening orbit, ringed giant, black hole, Cathedral approach, nebula interior, newly created star, mobile portrait/landscape, and WebGL2.

Inspection led to changes in landmark scale and placement, planet orientation, focus stopping distance, atmospheric brightness, material normal derivatives, black-hole distortion boundaries, mobile selection-label bounds, shader prewarming, and created-star visibility. A real touch-input defect dropped brief look gestures under reduced motion; accumulated angular input now preserves them. The nebula texture now tiles at each noise octave's own period, eliminating planar repetition seams visible from inside the volume.

## Local performance sample

Dedicated Chrome process, 2560×1440, DPR 1, High quality, 80,000 GPU matter particles. First interaction readiness: 2,664 ms in the measured local run.

- Normal landmark travel: approximately 144 FPS, p95 about 7.1 ms.
- Fast procedural flight across 1.258 billion coordinate units: p95 7.1 ms, p99 13.9 ms, maximum 27.9 ms; 27 sectors remained resident.
- No sampled interval exceeded 50 ms during that run.

These are animation-frame cadence measurements, capped by the workstation's display cadence. They are not GPU timestamp queries or evidence of equivalent performance on weaker hardware. That local sample preceded the final nebula seam correction and visible-star correction; the deployed build requires its own final sample.

## Production record

Pending the VASTNESS deployment and tests against its actual public URL. The existing Event Horizon deployment is not evidence for this edition.

## Coverage limits

Physical phones/tablets, Safari, Firefox, battery drain, thermal throttling, and multi-hour GPU memory behavior have not been tested. Reduced motion preserves damped free flight and live simulation; P pauses the latter. Close orbital inspection is supported, but full ground landing and an ecological surface are not implemented. Lensing, atmosphere, stellar growth, and companion orbits are cinematic approximations. No UE5 edition or cross-engine benchmark was built.

Reproduction scripts are in `scripts/`; final production reports will be retained in `docs/evidence/`.
