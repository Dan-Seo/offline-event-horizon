# Verification record

Date: 2026-09-08. Windows workstation, NVIDIA Ampere adapter. Actual installed Chrome in headless mode through Playwright; no unsafe WebGPU flags. This is browser rendering evidence, not a claim of physical mobile-device testing.

## Build and assets

- Production Next.js static build passed; strict TypeScript passed.
- Three timeline/continuity/allocation tests passed.
- `npm audit`: 0 reported vulnerabilities in the application dependency tree.
- Original Blender CLI export: 196,552 bytes, 25 objects, 6,276 triangles. Source `.blend` and rebuild script included.
- Files and self-hosted fonts resolved during the full local journey. No runtime external media dependency.

## Functional and visual coverage

Local static production preview was rendered at 1440×900, 1280×800, and 390×844. Captures covered office, distortion, collapse, miniature city, receding planet/moon, galaxy, creation, terrain approach, life, and ending. WebGPU and forced WebGL2 both initialized without fatal errors or horizontal overflow. The full normal-speed eight-chapter local journey reached 300 seconds, with no console exceptions or failed requests.

Actual screenshots were inspected, and the following issues were corrected: excessive singularity brightness, edge-on galaxy framing, washed-out life lighting, repetitive tree silhouettes, water striping, a separate terrain slab behind the planet, and chapter text remaining over the final message. The planet's near hemisphere now unfolds into terrain, and the final message appears once.

Control and fault-injection checks passed:

- Raycast dragging removed an actual notification; button and R released two more.
- Space paused and resumed the clock. A paused clock stayed constant.
- Quality changes, reduced motion, all technical benchmark modes, and restoration of the saved journey worked.
- Both the Creation button and canvas input seeded the particle field.
- Sound opt-in and mute state worked. This is a functional audio-control test, not a subjective listening evaluation.
- Synthetic WebGL context loss produced recovery UI; the motionless ending remained reachable.
- Touch emulation at 390×844 / DPR 2 and 844×390 passed input, settings, reduced-motion preference, orientation, and overflow checks.
- A deliberately failed office GLB retained the procedural workspace and usable journey.
- With the browser WebGPU interface unavailable, Three automatically selected WebGL2.

## Warm rendering measurements

Dedicated Chrome process, 2560×1440 viewport, DPR 1, 6-second warm-up, then 12 seconds per scenario. No simultaneous browser QA during the measured intervals.

| Scenario       |          Particles | Observed cadence | Median / p95 / p99 | Largest sampled interval |
| -------------- | -----------------: | ---------------- | ------------------ | ------------------------ |
| Collapse, High |             90,000 | 143–144 fps      | 6.9 / 7.0 / 7.1 ms | 7.1 ms                   |
| Galaxy, High   |             90,000 | 144 fps          | 6.9 / 7.0 / 7.1 ms | 7.2 ms                   |
| Galaxy, Ultra  |            180,000 | 144 fps          | 6.9 / 7.0 / 7.1 ms | 7.1 ms                   |
| Life, High     | 0 cosmic particles | 144 fps          | 6.9 / 7.0 / 7.1 ms | 7.1 ms                   |

The HUD recorded 17 draw calls / 362,175 triangles for the Ultra galaxy and 27 draw calls / 348,127 triangles for High life. These are browser animation-frame intervals and renderer counters, not GPU timestamp queries. Display cadence limits the measured result. They do not establish equivalent performance on weaker hardware.

The first full journey also captured screenshots while another browser QA process ran. It recorded a 1.35-second maximum interval, so that run is useful for reachability but cannot establish hitch-free cold transitions. Warm-scenario numbers above deliberately exclude initialization and shader compilation. Production traversal evidence is recorded separately after deployment.

## Coverage limits

- Physical phones/tablets, Safari, Firefox, battery drain, thermal throttling, and long-duration GPU memory behavior have not been validated.
- The inspected forest is stylized procedural geometry. Water reflection, atmosphere, lensing, planet formation, and growth are artistic approximations.
- Reduced motion preserves the slow guided camera/scale transformation; it does not remove all visual change. Pause and the quiet fallback are available.
- Ordinary Chrome did not expose `document.modelContext`; the optional WebMCP registry has not been exercised live.
- No UE5 runtime or cross-engine benchmark was completed.

Scripts in `scripts/` reproduce the browser checks. Raw local warm-performance and interaction reports are in `docs/evidence/`.
