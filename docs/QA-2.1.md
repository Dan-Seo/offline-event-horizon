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

Final deployment and performance results are appended after verification of the corrected runtime.

The final local free-cursor check passed 48 desktop controls, 19 onboarding checks, and 18 touch-guide checks. New acceptance checks cover unlocked canvas clicks and L, hover without camera steering, simultaneous left-drag/W input, immediate menu access after release, uninterrupted Wander on hover, synchronous drag takeover, and cancellation during an active drag. The production export compiled successfully with TypeScript; all nine numerical/language tests passed.
