# VASTNESS verification record

2026-09-08. Windows workstation, NVIDIA Ampere adapter. Installed Chrome through Playwright in headless mode, with the real GPU renderer and no unsafe WebGPU flags. Viewport emulation is not physical mobile-device testing.

## Build and asset checks

- Next.js static production build and strict TypeScript passed.
- Three tests passed: continuous monotonic angular-size distance mapping, local precision at large coordinates, and repeatable/distinct seeded sector generation.
- Dependency audit reported zero vulnerabilities.
- Blender 5.2.1 exported the original Cathedral hero and its lower-detail variant. Normals and UVs are present; four primitives/materials in each GLB. High: 31,308 triangles / 863,452 bytes. Low: 8,125 triangles / 288,196 bytes.

## Controls and viewports

The local production preview passed 30 desktop control checks. They exercise W, A, S, D, simultaneous W+D, mouse look during flight, wheel speed, Shift boost, settling, Q/E roll, Space, Ctrl precision, actual planet clicking, F approach, manual override, left-drag orbit, double-click travel, H help, P pause/resume, R recovery, Drift interruption, pointer lock/Escape, blur clearing, resize, canvas hit-testing, and horizontal overflow.

Another 35 checks covered laptop 1366×768, tablet 1024×768 at DPR 2, mobile 390×844 at DPR 2, and 844×390 landscape. Touch input is delivered with actual browser touch events: simultaneous movement/look, pinch speed, release damping, tap selection, and rotation. The mobile context requests reduced motion. The suite also checks gravity input, visible star creation, persistence after reload, the visible Create/gather controls, Quiet, sound opt-in/mute, automatic WebGL2 fallback, CPU matter forces, and context-loss recovery.

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

Public URL: **https://offline-vastness.vercel.app**. Runtime commit: `aec3704`. Vercel deployment: `dpl_6jo2cZip1KXv2xvjvk2Upgxzjx93`, built and published on 2026-09-08. Both this URL and the previous project URL are registered production domains.

The first attempt to use the new address exposed a deployment-domain issue: an alias alone redirected unauthenticated visitors to Vercel login. Registering it as a verified production project domain fixed this. A fresh unauthenticated browser session then loaded VASTNESS successfully; the root returned HTTP 200.

Tests against the actual public URL passed:

- Chrome: all 30 desktop control checks.
- Edge: all 30 desktop control checks.
- Chrome responsive/touch, creation, sound controls, WebGL2, and recovery: all 35 checks.
- Technical stress, quality tiers, missing hero downloads, and adaptive quality: all 15 resilience checks.
- Poster, both GLBs, and both fonts returned HTTP 200 and exactly matched local SHA-256 digests.

No unexpected console errors occurred. Deliberate GLB failures and WebGL context loss remain separately identified in the reports. The test harness waits for the 120 ms diagnostic snapshot to publish complete changes rather than treating a shorter fixed delay as a failed control.

Raw reports: [Chrome controls](evidence/production-chrome-controls.json), [Edge controls](evidence/production-edge-controls.json), [devices and recovery](evidence/production-devices.json), [resilience](evidence/production-resilience.json), and [asset verification](evidence/production-assets.json). Final performance and landmark captures are recorded below after their dedicated run.

## Coverage limits

Physical phones/tablets, Safari, Firefox, battery drain, thermal throttling, and multi-hour GPU memory behavior have not been tested. Reduced motion preserves damped free flight and live simulation; P pauses the latter. Close orbital inspection is supported, but full ground landing and an ecological surface are not implemented. Lensing, atmosphere, stellar growth, and companion orbits are cinematic approximations. No UE5 edition or cross-engine benchmark was built.

Reproduction scripts are in `scripts/`; production reports are retained in `docs/evidence/`.
