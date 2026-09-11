# OFFLINE // VASTNESS 3.0.0 — Living Cosmos

A quiet, freely explorable sanctuary inside a persistent universe. **PILGRIM** opens over a mirror sea. Waterfalls, immense forests, clouds, and living skies share the same world. The stars beyond them remain reachable.

No chapters, timer, score, account, analytics, or mandatory route. Movement always takes over from automatic travel. Sound starts off. A small light you leave behind is saved on this device.

[Public edition](https://offline-vastness.vercel.app) · [Source](https://github.com/Dan-Seo/offline-event-horizon)

![Actual rendered mirror sea at The Last Light](public/poster.jpg)

[Run](#run) · [Go. Rest. Carry me somewhere.](#go-rest-carry-me-somewhere) · [Places to stay](#places-to-stay) · [Start comfortably](#start-comfortably) · [Fly](#fly) · [Rendering and scale](#rendering-and-scale) · [Blender](#blender) · [Quality and fallback](#quality-and-fallback) · [Scientific and practical limits](#scientific-and-practical-limits) · [Verification and deployment](#verification-and-deployment)

## Run

Node 24. No environment variables or service credentials are needed to run the artwork.

```sh
npm ci
npm run dev
```

Development runs at `http://localhost:3000`. To inspect the static production build:

```sh
npm run typecheck
npm run lint
npm test
npm run build
npm start
```

The production preview runs at `http://localhost:4173`. Vercel builds this Next.js static export directly; leave its output-directory override unset.

## Go. Rest. Carry me somewhere.

PILGRIM is a small, almost silent leaf-like craft. Choose **Go** to ride, **Rest** to settle, or **Carry me somewhere** to give up the next decision. It hovers over terrain and water, banks gently, glides from edges and settles back onto the surface. A fading wake and softly bending grass follow it. There is no fuel, destination requirement or vehicle menu. Go is offered only within a bounded clearance above contact, because a hand-over from higher up would be a long fall the craft could not settle from. WASD, a deliberate drag, or touch movement immediately takes over.

Carry observes local geometry through the craft's synthetic RGB-D camera. It chooses among short, visible routes using clearance, slope, water/vegetation color, motion restraint and recent estimated travel. It often rests for 30–60 seconds and holds still during a nearby beauty event. While the craft rests its sensors capture at a quarter of the moving rate, never slower than one frame every 0.8 seconds, and a tracker that has lost its track publishes no pose at all instead of repeating its last one. It does not cycle through landmark splines. Unknown or poorly observed ground may lead to a long rest. This is local scenic navigation, not a global route planner.

Normal visitors see none of the instrumentation. Deliberately open **[Research Lens](https://offline-vastness.vercel.app/lab)** for the other identity of the same engine and vehicle: synchronized synthetic sensors, an actual RGB-D visual-odometry baseline, a bounded local map, candidate routes, truth/estimate separation and trajectory evaluation. The baseline tracks image features and fits rigid motion; it never receives renderer ground-truth poses. It is not a novel SLAM algorithm or a therapeutic result. [Model and data boundaries](docs/PILGRIM.md).

Research Lens can record and download 32 synchronized raw sensor frames, camera calibration, synthetic IMU and paired trajectories. Replay the images outside the browser using `npm run replay:rgbd -- sequence.tar`; it writes its report to `artifacts/replay/` and exits non-zero when a segment loses more than 0.1 of its samples, drifts more than 0.2 of the distance travelled, or exceeds 0.5 relative translation error, each overridable with `REPLAY_MAX_LOST`, `REPLAY_MAX_DRIFT` and `REPLAY_MAX_RPE`. Everything stays on the device unless the user downloads a file. Research rendering is disabled during ordinary manual flight/riding; Carry loads the shared perception worker only when needed.

## Places to stay

- **The Last Light:** a curved mirror sea, long ripples, bioluminescent wakes, and a rare gossamer visitor reflected with the sky.
- **Moonfall:** a 760-unit descending water curtain, layered cliffs, wet haze, and an occasional quiet moonbow.
- **The Breathing Forest:** recursive trees, swaying leaves and grass, light that responds to stillness, and creatures that gather gently around a resting observer.
- **The Veil:** an enterable three-dimensional cloud field around a suspended garden. Density and openings change slowly.
- **The Living Sky:** thousands of stateful flow-following creatures, local avoidance, and a rare translucent form passing through them.

These places are spatial neighbors on one ocean world. **Explore** opens optional directions to nearby sanctuaries and distant planets. There is no required order. **Wander** glides briefly, rests often, and holds its composition during a nearby beauty event.

## Start comfortably

Choose **한국어 / English** on arrival; the initial choice follows the browser language, a saved choice takes precedence, and language remains available in Comfort settings. Choose **어디든 데려다줘 / Carry me somewhere** without learning controls, or use the optional movement guide, which responds to actual look, flight and speed input and carries separate touch instructions. Skip it or replay it from Help at any time.

Beyond the water, **Serein** has wind-shaped dunes and salt basins; **Nacre** has green oceans, pearl clouds, and luminous night coasts. Selene's ice basins and fractures, Ember's warm crustal seams, and the Silent Giant's slow storm bands distinguish the other worlds. Select a planet and use its orbit button or **O** to drift around it.

At **The Wound**, choose **Release a little matter** or press **T**. Three initial speeds produce falling, bound, and escaping trajectories. Changing gravity affects particles already in flight. This optional experiment preserves the quiet default scene.

Choose **Beyond the horizon · freefall observation** for a separate scientific observation. A radial infaller crosses an ideal Schwarzschild horizon while GPU-integrated null geodesics determine the visible disk and sky. Drag to look, P to pause, and WASD or Esc to restore the exterior flight position. The panel explains the proper-time clock, frequency transfer, and the chosen numerical stop. It makes no claim to show an observed interior or a physical escape. [Equations, references, and limits](docs/RELATIVITY.md).

The five distant hero planets now offer **Closer · into the landscape**. Existing smooth flight continues into Selene's ice canyon, Serein's dune ridges, Ember's cooling caldera, Nacre's reflective lagoon and luminous canopy, or the Silent Giant's cloud tops beneath its rings. These regions stay attached to their planets and remain freely navigable regional environments, not complete planet-wide landing systems; manual movement interrupts the approach immediately.

**The aurora coast**, in Explore, flies directly to Nacre's shoreline. Choose **Walk here** or press **J** to settle onto the actual terrain at eye height. WASD walks, drag looks, Space makes a small hop, and J takes flight again. Touch uses both thumbs. Curved aurora curtains reflect in the lagoon; small grass tiles stream underfoot, steps leave fading light in the moss, and delicate creatures gather when you rest. **Leave a little light** plants a miniature stellar keepsake. There are no scores or tasks. Grounded walking is currently specific to Nacre, with deep water and steep slopes limiting the route; vegetation is permeable.

The Wound now receives irregular streams of gas. **Release a stream of gas** adds persistent parcels that orbit, shear, heat and accrete. Their emission also changes the optional ray-traced observation. This uses simplified dissipative particle dynamics, not magnetic plasma simulation. The photon equations remain Schwarzschild; variable emission uses a shared scene clock rather than retarded source time. Plain-language descriptions appear first; numerical readings and model details are collapsed.

## Fly

| Input              | Action                                                        |
| ------------------ | ------------------------------------------------------------- |
| W / A / S / D      | Forward / left / backward / right                             |
| Left drag          | Look with damped angular motion; the cursor stays free        |
| Wheel              | Smoothly change the travel-speed multiplier                   |
| Shift / Ctrl       | Boost / precision                                             |
| Q / E              | Roll                                                          |
| Space / X          | Rise / descend                                                |
| Click / right drag | Select a visible celestial body / orbit the selection         |
| Double click / F   | Approach the selected body                                    |
| R / Esc            | Return to the water / cancel automation                       |
| P / H              | Pause simulation / controls help                              |
| M / O / T          | Explore / slow planetary orbit / nearby black-hole experiment |
| B / K              | Wander / quiet                                                |
| G / V              | Hold to attract / repel matter                                |
| N                  | Plant a star                                                  |
| J                  | Walk / take flight on Nacre's coast                           |
| Y / C / Z          | PILGRIM Go / Carry me somewhere / Rest                       |
| Backquote          | Technical observatory                                         |

Touch: left thumb moves, right thumb looks, pinch changes speed, tap selects, and double tap approaches. Wander, Quiet, sound, and Comfort settings support keyboard focus. All decorative overlays pass pointer events through to the canvas. The application never requests pointer lock. Hovering the free cursor leaves Wander undisturbed, and a bare click or tap only selects: control passes when a drag travels more than four pixels (five on touch), when the wheel turns, or when a movement key is pressed. That single threshold decides both, so no gesture now selects and steers at once.

These flight controls remain available when flying. Aboard PILGRIM, W/S move, A/D steer, drag looks and steers, Shift/Ctrl adjust pace, and Space gives a little lift. Its roll is a restrained response to steering; Q/E remain free-flight controls. **Fly** returns to the existing camera, and R recovers to the sea. On the craft, B also activates Carry. Touch uses the same movement/look zones.

Wander remains optional for free flight and stays with a place instead of cycling through a destination list. Reduced-motion preferences enable gentler camera response and remove CSS animation. Simulation can be paused independently of navigation. Quiet hides the interface and softens motion; Esc or the small restore control brings it back.

## Rendering and scale

Next.js 16, TypeScript, raw Three.js r183, `WebGPURenderer`, TSL, and Web Audio. React owns the small interface; the renderer, input state, camera, and simulation run outside React's render loop. Double-precision global positions, 27 streamed neighboring sectors, shared procedural materials, and GPU-resident matter hold one continuous world from the sea floor to the far field. [Module-by-module detail](docs/ARCHITECTURE.md).

## Blender

Original hero geometry is authored by `scripts/build_vastness_assets.py`; editable source is `assets/source/cathedral.blend`. The Cathedral is a broken orbital gate with two authored LODs, four materials, and no image textures. Reusable hero geometry belongs in Blender; stars, volumes, planets, asteroids, and changing matter are generated at runtime. [Build command, export settings, and the LOD table](docs/ARCHITECTURE.md#blender).

## Quality and fallback

| Tier     | GPU matter particles | Asteroids | Volume steps | DPR cap |
| -------- | -------------------: | --------: | -----------: | ------: |
| ULTRA    |              160,000 |     7,000 |           72 |    1.75 |
| HIGH     |               80,000 |     4,000 |           52 |    1.50 |
| BALANCED |               36,000 |     1,800 |           32 |    1.15 |
| BATTERY  |               12,000 |       650 |           18 |    0.85 |

Local sanctuary volumes use 40/28/20/12 steps and reflection resolution scales of .85/.65/.45/.30 across the four tiers. Living-particle budgets are 8,192/8,192/6,144/4,096. Leaf and grass density also scale. All of these per-tier budgets live in one table, `QUALITY` in `universe/config.ts`. Mobile starts in Battery. Sustained slow frame cadence lowers detail automatically, except that a tier chosen through `?quality=` or in the interface is pinned and is never downgraded for you. Battery removes the bloom contribution; the post-processing pass graph remains warm. The hidden technical observatory offers particle, nebula, asteroid, and gravity stress scenarios, with automatic downgrading suspended during intentional stress.

When WebGPU is unavailable, Three.js automatically uses WebGL2. Procedural shaders, reflection, local volumes, and navigation remain available; 5,000 matter particles and 1,200 living particles use reduced CPU force integrators. Missing hero downloads retain a procedural gate. Context/device loss shows a static view and an explicit lighter-graphics retry. Audio is synthesized locally and requires an opt-in gesture; air and tonal levels blend slowly with the local environment.

## Scientific and practical limits

The main universe is physics-inspired interactive art: released test particles and the Newtonian black-hole experiment integrate actual forces in artistic units, the separate freefall observation solves ideal Schwarzschild light geodesics, and ambient lensing, accretion appearance, waterfalls, and near-surface hero geometry remain artistic approximations. Procedurally streamed planets outside the hero regions support orbital inspection, not full terrain landing, and persistence is local to the browser. This is designed for a restful experience. No therapeutic benefit has been established, and no participant study or personally photographed reconstruction has been completed; [Portfolio framing](docs/PORTFOLIO.md), [a small formative-study protocol](docs/FORMATIVE-STUDY.md), and [a future image-reconstruction workflow](docs/RECONSTRUCTION.md) make the next personal contributions concrete without inventing results, and [the full list of model boundaries](docs/ARCHITECTURE.md#scientific-and-practical-limits) stays with the architecture notes.

## Verification and deployment

```sh
npm run qa:controls
npm run qa:onboarding
npm run qa:touch-guide
npm run qa:encounters
npm run qa:approaches
npm run qa:walk
npm run qa:pilgrim
npm run qa:journey
npm run qa:lab
npm run qa:devices
npm run qa:resilience
npm run qa:performance
npm run qa
npm run qa:place
npm run qa:living-cosmos
npm run replay:rgbd -- tests/fixtures/clear-eight-frames.tar.gz
npm run test:reconstruction
```

The eight-frame fixture replay now reports a maximum translation difference of about 1.3e-10 and a drift fraction of 0.06660124274743297, where it reported exactly 0 and 0.06660124275924947 before the Jacobi stopping tolerance became relative to the matrix it solves; both stay far inside the gates. PILGRIM's model boundaries, dataset formats, privileged physical contact and baseline limitations are described in [PILGRIM.md](docs/PILGRIM.md). The independent local map and sensor estimator are real; their RGB appearance, water sensing and IMU remain explicitly simplified synthetic models.

These scripts use installed Chrome through Playwright and real input events against the real renderer. Set `QA_URL` for the deployed site; every runner except `qa:performance`, which stays pinned to installed Chrome, reads `QA_BROWSER`, which accepts `chrome` (the default), `msedge`, or `chromium` for Playwright's own bundled build. `QA_PLACE=moonfall|forest|veil|living-sky` chooses a place for a continuous flight and stillness observation; default is the sea. The encounter suite travels through five planets and the anomaly without teleporting, tests automatic-orbit interruption, and exercises all three release outcomes. Set `QA_BACKEND=webgl` for its fallback pass or `QA_PLACES=serein,nacre` for a shorter route. Reports and actual screenshots go to ignored `artifacts/`. `QA_SOFTWARE_GPU=1` with `QA_BROWSER=chromium` runs the PILGRIM smoke on Chromium's SwiftShader WebGPU adapter, which is what CI does on its GPU-less runner: it proves the shaders compile and the world boots on real WebGPU, and records the four real-time checks without gating on them, because a software rasterizer takes seconds per frame. `?qa=1` exposes read-only diagnostics; it does not provide camera teleport or test-only simulation actions.

See [the 3.0 verification record](docs/QA-3.0.md), [the PILGRIM hardening record](docs/QA-3.0-HARDENING.md), [the Living Cosmos record](docs/QA-LIVING-COSMOS.md), [the living-ocean implementation record](docs/LIVING-OCEAN.md), [the exterior cosmic-motion record](docs/COSMIC-MOTION.md), [the 3.0 mission adoption and release plan](docs/RELEASE-PLAN-3.0.md), [the 2.3 verification record](docs/QA-2.3.md), [the 2.2 record](docs/QA-2.2.md), [the 2.1 record](docs/QA-2.1.md), and [the 2.0 record](docs/QA-2.0.md). Earlier performance numbers are browser frame intervals and renderer counters. The optional `?qa=1&profile=1` path adds GPU render/compute pass timestamps when supported; these exclude CPU and presentation time. Physical phones, Safari, Firefox, thermal behavior, and long-duration memory stability need additional coverage.

`vercel.json` ships a full Content-Security-Policy: `script-src` and `style-src` need `'unsafe-inline'` on a static export, and every other directive is `'self'` or tighter. `npm start` (`scripts/serve.mjs`) applies the same `vercel.json` headers, so local QA exercises them. The authenticated Vercel CLI deploys the project with `vercel deploy --prod`. Both `offline-vastness.vercel.app` and the previous address are registered production domains. GitHub source is available, but automatic Git-triggered Vercel deployment is not configured. The earlier timed Event Horizon edition is preserved in the `event-horizon-v1` tag; the current application has no forced progression.
