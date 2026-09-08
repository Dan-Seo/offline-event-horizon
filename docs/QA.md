# VASTNESS verification record

2026-09-08. Windows workstation, NVIDIA Ampere adapter. Installed Chrome 152.0.7977.82 and Edge 152.0.4191.66 through Playwright in headless mode, with the real GPU renderer and no unsafe WebGPU flags. Tests send actual browser keyboard, mouse, wheel, and touch events. Viewport emulation is not physical mobile-device testing or a human usability study.

## Build and asset checks

- Next.js static production build and strict TypeScript passed.
- Three tests passed: continuous monotonic angular-size distance mapping, local precision at large coordinates, and repeatable/distinct seeded sector generation.
- Dependency audit reported zero vulnerabilities.
- Blender 5.2.1 exported the original Cathedral hero and its lower-detail variant. Normals and UVs are present; four primitives/materials in each GLB. High: 31,308 triangles / 863,452 bytes. Low: 8,125 triangles / 288,196 bytes.

## Controls and viewports

The local production preview passed 30 desktop control checks. They exercise W, A, S, D, simultaneous W+D, mouse look during flight, wheel speed, Shift boost, settling, Q/E roll, Space, Ctrl precision, actual planet clicking, F approach, manual override, left-drag orbit, double-click travel, H help, P pause/resume, R recovery, Drift interruption, pointer lock/Escape, blur clearing, resize, canvas hit-testing, and horizontal overflow.

On the final public deployment, another 36 checks covered laptop 1366×768, tablet 1024×768 at DPR 2, mobile 390×844 at DPR 2, and 844×390 landscape. Touch input is delivered with actual browser touch events: simultaneous movement/look, pinch speed, release damping, tap selection, and rotation. The mobile context requests reduced motion. The suite also checks gravity input, visible star creation, persistence after reload, the visible Create/gather controls, Quiet, sound opt-in/mute, automatic WebGL2 fallback, CPU matter forces, and context-loss recovery. After deliberately losing the context, the actual recovery link successfully starts a fresh WebGL2 renderer and keyboard input works again.

No unexpected console errors occurred in those runs. The deliberately injected WebGL device-loss error is recorded separately. Sound controls were exercised; this is not a subjective listening evaluation.

Fifteen additional resilience checks passed: all four quality tiers and technical stress scenarios remain live, leaving stress restores the original budget, failed hero downloads retain navigation, and deliberately slowed frame scheduling triggers an automatic High-to-Balanced downgrade without breaking movement. Deliberate resource failures are recorded separately from unexpected console errors.

## Visual inspection and corrections

Actual browser captures cover the opening orbit, ringed giant, black hole, Cathedral approach, nebula interior, newly created star, mobile portrait/landscape, and WebGL2.

Inspection led to changes in landmark scale and placement, planet orientation, focus stopping distance, atmospheric brightness, material normal derivatives, black-hole distortion boundaries, mobile selection-label bounds, shader prewarming, and created-star visibility. A real touch-input defect dropped brief look gestures under reduced motion; accumulated angular input now preserves them. The nebula texture now tiles at each noise octave's own period, eliminating planar repetition seams visible from inside the volume.

## Production record

Public URL: **https://offline-vastness.vercel.app**. Final runtime commit: `4f6f0b8`. Vercel deployment: `dpl_ACrLd6wVa6JPdWSCwJTvbCFfRbHD`, built and published on 2026-09-08. Both this URL and the previous project URL are registered production domains. [Deployment record](evidence/deployment.json).

The first attempt to use the new address exposed a deployment-domain issue: an alias alone redirected unauthenticated visitors to Vercel login. Registering it as a verified production project domain fixed this. A fresh unauthenticated browser session then loaded VASTNESS successfully; the root returned HTTP 200.

Tests against the actual public URL passed:

- Chrome: all 30 desktop control checks.
- Edge: all 30 desktop control checks.
- Chrome responsive/touch, creation, sound controls, WebGL2, and recovery: all 36 checks.
- Technical stress, quality tiers, missing hero downloads, and adaptive quality: all 15 resilience checks.
- Immediate forward input after readiness: passed independently on WebGPU and forced WebGL2.
- Poster, both GLBs, and both fonts returned HTTP 200 and exactly matched local SHA-256 digests.

No unexpected console errors occurred in the completed runs. Deliberate GLB failures and WebGL context loss remain separately identified in the reports. Two test-harness issues were corrected: waiting for the 120 ms diagnostic snapshot to publish complete changes, and targeting the artwork's recovery alert specifically because Next.js also has an empty route-announcer alert. Neither correction changes application behavior.

Raw reports: [Chrome controls](evidence/production-chrome-controls.json), [Edge controls](evidence/production-edge-controls.json), [devices and recovery](evidence/production-devices.json), [resilience](evidence/production-resilience.json), and [asset verification](evidence/production-assets.json).

## Startup refinement

The first public release (`aec3704`) had one 125.1 ms interval shortly after readiness in its dedicated sample. Scene material compilation had not warmed the post-processing graph. The final release completes the first full pipeline draw behind the arrival poster and, on WebGPU, waits for that submitted work before enabling flight. The tradeoff is a longer preparation period before controls become available.

A fresh public startup run on the final release immediately pressed W, verified forward movement, and sampled the following seven seconds:

| Backend | Readiness | p95 interval | Maximum interval | Intervals >50 ms |
| --- | ---: | ---: | ---: | ---: |
| WebGPU | 3,586 ms | 7.0 ms | 34.7 ms | 0 |
| WebGL2 | 5,800 ms | 7.0 ms | 34.8 ms | 0 |

These are individual workstation samples, not guaranteed startup times. [Final startup data](evidence/production-startup.json), [preserved earlier performance sample](evidence/production-before-prewarm.json). The startup script counts complete frame intervals after readiness and does not include the preparation interval itself.

## Final public performance

Dedicated Chrome process, 2560×1440 viewport, DPR 1, High quality, 80,000 GPU matter particles, NVIDIA Ampere. Readiness was 2,988 ms in this separate run. No other browser QA workload ran concurrently with the measurement.

| Scenario | Sample | p95 | p99 | Maximum | Intervals >50 ms |
| --- | ---: | ---: | ---: | ---: | ---: |
| Opening | 8 s | 7.0 ms | 7.1 ms | 7.1 ms | 0 |
| Approach The Wound | 22 s | 7.0 ms | 7.1 ms | 7.2 ms | 0 |
| Approach The Cathedral | 22 s | 7.0 ms | 7.1 ms | 7.2 ms | 0 |
| Enter The Bloom | 22 s | 7.0 ms | 7.1 ms | 7.1 ms | 0 |
| Fast procedural streaming | 18 s | 7.0 ms | 7.1 ms | 20.9 ms | 0 |
| Star creation and gravity | 6 s | 7.0 ms | 7.1 ms | 7.1 ms | 0 |

The normal cadence was approximately 144 FPS, matching this workstation's display cadence. Real W + Shift + wheel input traveled approximately 1.257 billion coordinate units; the world retained 27 resident sectors while generating and recycling distant content. No unexpected console errors occurred.

These are animation-frame intervals and renderer counters, not GPU timestamp queries or guaranteed performance on other hardware. The GPU submission timer in the technical overlay measures CPU submission overhead. This is a short exploration sample, not a thermal or long-duration stability benchmark. [Raw final performance data](evidence/production-performance.json).

## Captures

Actual deployed browser images: [opening orbit](evidence/production-opening.png), [black-hole approach](evidence/production-wound.png), [nebula interior](evidence/production-bloom.png), and [mobile portrait](evidence/production-mobile.png). The final opening, closer anomaly approach, and mobile captures were refreshed after redeployment. The nebula image is from the first public release; its volume rendering is unchanged by the final startup and approach refinements.

## Coverage limits

Physical phones/tablets, Safari, Firefox, battery drain, thermal throttling, and multi-hour GPU memory behavior have not been tested. Reduced motion preserves damped free flight and live simulation; P pauses the latter. Close orbital inspection is supported, but full ground landing and an ecological surface are not implemented. Lensing, atmosphere, stellar growth, and companion orbits are cinematic approximations. No UE5 edition or cross-engine benchmark was built.

Reproduction scripts are in `scripts/`; production reports are retained in `docs/evidence/`.
