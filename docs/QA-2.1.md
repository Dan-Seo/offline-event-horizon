# VASTNESS 2.1 verification

Date: 2026-09-08. This update extends the existing sanctuary renderer. It adds Korean/English arrival, optional hands-on navigation guidance, two planet archetypes, and an interactive black-hole orbit experiment.

## Changes checked

- Saved language takes precedence over browser language; Korean and English can be selected both on arrival and in settings. Main controls, help, destinations, experiments, and recovery copy are translated.
- Look, movement, and speed lessons advance from actual accumulated input. Desktop uses left-drag look, WASD, and wheel; touch uses right-side look, left-side movement, and pinch. The cursor remains free throughout. Skipping, immediate Wander, persistence, and help replay are supported.
- Explore is visible in the footer. Serein adds dunes and salt basins; Nacre adds green oceans, clouds, and luminous coasts. Ice basins/fractures, volcanic seams, and gas bands distinguish the existing worlds. Optional planet orbit yields to manual flight.
- Released matter has independent position and velocity, three starting-speed choices, mutable gravity, actual capture/escape outcomes, and measured trail history. P freezes it exactly. The idle scene contains no experiment panel.

## Corrections found during QA

An interplanetary route through Serein → Nacre → Selene → Ember → the Silent Giant exposed a very slow framing retreat. Retreat speed was limited by the nearby world's local precision speed, unlike forward travel. Both directions now use the same automatic-travel envelope. The repeated route completed all six approaches, including the anomaly, in approximately 8–16 seconds per leg in the local run; the previously slow Giant leg took about 8.1 seconds. Camera movement remains continuous and manual interruption remains available.

Arrival text could remain visible behind the planet note; destination travel now dismisses it and mutually exclusive overlays suppress it. Nacre's cloud thresholds were softened, ice fractures were broken up with finer procedural variation, and faint touch-zone labels were hidden behind the welcome guide. Screenshots of both new planets, Selene, the anomaly/trails, Korean arrival, and phone-sized guidance were opened and inspected.

The first 2.1 build corrected intentional cursor release when opening panels and completing the guide. The user's subsequent request to never confine the mouse superseded that design: pointer lock and the L shortcut have now been removed entirely. Desktop look uses left drag, hover does not steer or interrupt Wander, and clicking a visible object selects it without changing cursor ownership. Drag capture is released on pointer-up, blur, Esc, or opening a panel. English/Korean guidance and the control checks follow that behavior.

Existing regression selectors were made exact after translated canvas accessibility text introduced a second matching label; the precision-speed check now samples while Ctrl is held rather than racing its release. These were test corrections, not suppressed application errors.

## Numerical checks

`npm test`: **9 passed**. Six new checks cover circular-orbit energy/radius stability for 90 simulated seconds, capture and escape, identical fixed-step results at 30/120 render Hz, pause and force changes, bounded repeated-release state, and language precedence. The three coordinate/streaming checks remain.

The orbit model uses softened Newtonian gravity and velocity Verlet at 1/120 second. It integrates at most 144 CPU test particles; dense ambient matter retains its existing GPU simulation. The absorbing radius, escape boundary, disk appearance, and lensing are artistic choices. This is not general relativity or an N-body simulation.

## Initial local browser checks

The following records preceded the final free-cursor refinement. Static production export at `http://localhost:4173`, actual installed Chrome through Playwright. All interactions use real browser keyboard, pointer, wheel, or CDP touch events. Diagnostics are read-only; tests do not teleport the camera or substitute simulation state.

| Suite | Passed | Coverage |
| --- | ---: | --- |
| Korean/English onboarding | 19 | Language, real lessons, cursor return, skip, replay, persistence, manual override, accessible destinations |
| Touch guide and layout | 18 | Actual touch look/movement/pinch; 390×844, 844×390, 1024×768, 1366×768; reachable menus and unobstructed canvas |
| Continuous encounters | 24 | Five planets, orbit and interruption, anomaly, bound/captured/escaped matter, gravity, pause, clear, keyboard panel |
| Existing Chrome controls | 40 | Simultaneous input, pointer lock, selection, focus, orbit, boost/precision, help, pause, reset, blur and resize |
| Quality and resilience | 15 | Four tiers, stress modes, missing hero fallback, deliberate frame-scheduling slowdown and automatic adaptation |
| Device and fallback | 33 | Touch, DPR/resize, Quiet, audio controls, saved creation, absent-WebGPU selection, context loss and lighter retry |
| WebGL2 encounters | 19 | Both new planets, orbit, all release outcomes, mutable gravity, pause, clear, and phone-sized experiment layout |

No unexpected browser/shader errors occurred in these completed local runs. Missing-asset and context-loss errors were deliberately injected and recorded separately. The production build and TypeScript compilation passed. After inspecting the phone-sized experiment, its controls were compacted to leave more of the live scene visible. A further anomaly-only pass checked the compact layout and all release outcomes, pause, gravity, clear, and keyboard access. Selection labels are hidden while panels are open.

## Local performance observation

A local timing pass used Chrome 152.0.7977.82, an NVIDIA Ampere adapter, 2560×1440, DPR 1, and High quality. Initial readiness was 4,025ms. All 13 scenarios had p95 frame intervals of 7.0ms; the largest interval was 41.6ms and none exceeded 50ms. The new scenarios include 144 simultaneous interactive tracers, both new planetary approaches, and close orbital surface detail. High remained selected. These are browser frame intervals rather than GPU timestamps, and do not predict performance on other hardware. This exploratory pass preceded the final compact experiment layout; the public runtime is measured separately after deployment.

## Coverage limits

Browser-emulated touch and viewport testing is not a physical-phone test. Safari, Firefox, physical mobile GPUs, prolonged thermal behavior, and long-duration memory behavior need separate coverage. Planetary approach is orbital inspection, not terrain landing. No new Blender assets or UE5 edition were added. No human participant study or clinical benefit is claimed.

## Production refinement

The initial 2.1 runtime, `3d22d29`, built successfully on GitHub and Vercel. The public Korean guide, touch guide, Chrome/Edge controls, six continuous encounters, and device/fallback recovery passed. Five public assets returned HTTP 200 and matched committed SHA-256 hashes.

During a subsequent WebGL2 encounter run, a held W had reached the input manager but automatic orbit had not yielded within the 80ms check. Cancellation previously waited for the next render-loop update. Input events now relinquish automation synchronously, retaining the same velocity damping and frame-loop safety check. A browser listener registered after the application observes FREE during the real W event, before a later render. This directly checks the corrected ownership rule instead of relaxing the timeout. The initial failed check is retained as `production-input-delay.json`.

The final local free-cursor check passed 48 desktop controls, 19 onboarding checks, and 18 touch-guide checks. New acceptance checks cover unlocked canvas clicks and L, hover without camera steering, simultaneous left-drag/W input, immediate menu access after release, uninterrupted Wander on hover, synchronous drag takeover, and cancellation during an active drag. Since the 3.0 repair pass the takeover also requires a drag past about four pixels of travel, so a bare mouse-down no longer ends automation and the drag-takeover check drags before it asserts; the takeover itself is still synchronous within that input event. The production export compiled successfully with TypeScript; all nine numerical/language tests passed.

## Final public runtime

Runtime commit: `4d7f3d296f23811b53684785768456efb4edd915`.

- Public URL: https://offline-vastness.vercel.app
- Immutable deployment: https://offline-event-horizon-q5c5dxd9m-sf-i455.vercel.app
- Vercel deployment: `dpl_9SiK9WDqYBjcwxzSRvkJF7iQ9ubT`, READY.
- [GitHub build](https://github.com/Dan-Seo/offline-event-horizon/actions/runs/34233047830): passed installation, TypeScript, numerical tests, and production build.

The public alias was opened in actual installed browsers, and these tests ran against the deployed runtime. Playwright supplied real keyboard/mouse events and CDP touch gestures; this is automated browser acceptance testing, not a human usability study. Both browsers kept the cursor free throughout clicking, dragging, choosing a planet, opening controls, and interrupting automatic travel.

| Public suite | Passed | Browser / coverage |
| --- | ---: | --- |
| Desktop controls | 48 | Chrome 152.0.7977.82; free cursor, drag, simultaneous inputs, automation ownership, selection, cancellation and resize |
| Desktop controls | 48 | Edge 152.0.4191.66; same acceptance sequence |
| Korean/English onboarding | 19 | Actual three-step guide, immediate menu access, preference persistence, replay and optional Wander |
| Touch guide | 18 | Touch look, movement and pinch; portrait, landscape, tablet and laptop viewport layouts |
| Continuous encounters | 26 | Five planets and the anomaly, actual orbit motion, event-level manual takeover, capture/escape, pause and gravity |
| WebGL2 encounters | 20 | Both new planets and the anomaly on Battery quality; the previously failing immediate takeover now passes |
| Devices and fallback | 34 | DPR, touch, rotation, audio/mute, creation persistence, Quiet, missing WebGPU and context-loss recovery |
| Public assets | 5 | HTTP 200 and SHA-256 equality for both hero GLBs, the recovery poster, and both fonts |

There were no unexpected runtime or shader errors in these completed public suites. The device suite deliberately lost a WebGL context and verified the visible recovery path; that expected error is recorded separately.

Production screenshots of Korean arrival and the drag lesson, English help, mobile guidance, Serein, Nacre, and desktop/portrait orbit trails were opened and visually inspected. The tutorial stays out of the central view, translated copy is readable, and the compact experiment leaves the surrounding world visible. New and existing planets remain in the same continuous world. The cursor uses a visible grab/grabbing affordance and never enters pointer lock.

Reports and selected screenshots are committed in [`evidence/vastness-2.1`](evidence/vastness-2.1/). `deployment.json` identifies this final runtime; `deployment-initial.json`, `production-devices-initial.json`, and `production-input-delay.json` retain the earlier deployment and observed failure history. Local reports are explicitly named as local records.

## Final production performance

The public runtime was then measured alone after closing the other automated QA browsers. Chrome 152.0.7977.82 used WebGPU on an NVIDIA Ampere adapter at 2560×1440, DPR 1, High quality. Initial readiness took **3,902ms**. All **13 scenarios** completed with no browser/shader errors, and High remained selected with 80,000 ambient matter particles.

Every scenario had a p95 browser frame interval of **7.0ms**. The largest interval was **41.7ms** during the surface-to-space approach; no measured interval exceeded 50ms. The 144-tracer interaction scenario had a maximum of 7.2ms. Procedural streaming and light/gravity peaked at 20.8ms and 20.9ms respectively. The record includes water, forest stillness, clouds, the anomaly, both new planetary approaches and orbital detail, streaming, and active gravitational interaction.

These are independent `requestAnimationFrame` intervals under headless browser automation, not GPU timestamp measurements or a guarantee of physical-device frame rate. The observation covers approximately 192 seconds of timed scenes, not a long thermal soak. [`production-performance.json`](evidence/vastness-2.1/production-performance.json) retains adapter details, exact per-scenario distributions, and renderer snapshots. Physical phones, Safari, Firefox, and a human navigation/usability study remain untested for this update.
