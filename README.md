# OFFLINE // VASTNESS

A quiet, freely explorable universe. Start above Orpheus IV, follow a distant ring, enter a nebula, or stop moving entirely.

No chapters, timer, score, account, analytics, or mandatory route. Movement always takes over from automatic travel. Sound starts off. Created stars are saved on this device.

[Public edition](https://offline-event-horizon.vercel.app) · [Source](https://github.com/Dan-Seo/offline-event-horizon)

## Run

Node 24. No environment variables or service credentials are needed to run the artwork.

```sh
npm ci
npm run dev
```

Development runs at `http://localhost:3000`. To inspect the static production build:

```sh
npm run typecheck
npm test
npm run build
npm start
```

The production preview runs at `http://localhost:4173`. Vercel builds this Next.js static export directly; leave its output-directory override unset.

## Fly

| Input             | Action                                                                    |
| ----------------- | ------------------------------------------------------------------------- |
| W / A / S / D     | Forward / left / backward / right                                         |
| Mouse movement    | Look, with damped angular motion                                          |
| Wheel             | Smoothly change the travel-speed multiplier                               |
| Shift / Ctrl      | Boost / precision                                                         |
| Q / E             | Roll                                                                      |
| Space / X         | Rise / descend                                                            |
| Click / left drag | Select a body / orbit the selection                                       |
| Double click / F  | Approach the selected body                                                |
| R / Esc           | Recover to the opening orbit / cancel automation and release pointer lock |
| L                 | Optional pointer lock                                                     |
| P / H             | Pause simulation / controls help                                          |
| B / K             | Drift / quiet                                                             |
| G / V             | Hold to attract / repel matter                                            |
| N                 | Plant a star                                                              |
| Backquote         | Technical observatory                                                     |

Touch: left thumb moves, right thumb looks, pinch changes speed, tap selects, and double tap approaches. The visible Places, Create, Drift, Quiet, sound, and settings controls also support keyboard focus. All decorative overlays pass pointer events through to the canvas.

Drift is optional. Manual flight or look input immediately cancels automation. Reduced-motion preferences enable gentler camera response and remove CSS animation. Simulation can be paused independently of navigation. Quiet hides the interface and softens motion; Esc or the small restore control brings it back.

## Rendering and scale

Next.js 16, TypeScript, raw Three.js r183, `WebGPURenderer`, TSL, and Web Audio. React owns the small interface; the renderer, input state, camera, and simulation run outside React's render loop. Raw Three.js gives direct control over GPU buffers, compilation, render passes, and streaming without another scene reconciler.

- `universe/input.ts` centralizes keys, pointer capture/lock, touch, wheel, blur, and cancellation.
- `flight.ts` handles damped velocity and angular input, distance-aware speed, focus, orbit, collision clearance, and optional drift.
- `coordinates.ts` retains double-precision global positions on CPU, subtracts the observer, then compresses the far field logarithmically while preserving angular size.
- `world.ts` maintains 27 neighboring seeded sectors. New sectors arrive as the observer travels; distant sector resources are released. Landmark bodies coexist in the same spatial system.
- `planets.ts` shares procedural terrain, ocean, cloud, atmosphere, aurora, night-light, and ring materials across mesh LODs.
- `nebula.ts` raymarches spatial volumes through a seamless procedural 96³ density texture, with extinction and locally varying color. The camera can enter the volume.
- `stars.ts` combines a distant clustered stellar population with sector stars and local matter for parallax.
- `anomaly.ts` builds the accretion disk and lensed arcs; `engine.ts` adds bounded screen-space distortion and restrained bloom.
- `matter.ts` maintains positions and velocities in GPU storage buffers, integrating softened fields, tangential motion, damping, and local-domain rebasing without per-frame readback.
- `creation.ts` keeps user-planted stellar seeds in world coordinates and saves the latest 24 in local storage.

High-frequency procedural detail is evaluated on the GPU. Planets have three geometry LODs; the Cathedral has two authored LODs. Material and light topology is shared to reduce shader compilation during streaming. The actual opening is shown as a static poster while the first shader set warms. The hero model loads progressively after flight becomes available.

## Blender

Original hero geometry is authored by `scripts/build_vastness_assets.py`; editable source is `assets/source/cathedral.blend`.

```sh
blender --background --python scripts/build_vastness_assets.py
```

The Cathedral is a broken orbital gate assembled from arcs, ribs, buttresses, suspended observatory geometry, fins, and faint circuit detail. Blender 5.2.1 CLI was available; Blender MCP was not. The export is normalized, uses glTF Y-up, and has normals and UVs on every primitive. Four materials, four primitives, no image textures.

| LOD  | Vertices | Triangles | GLB bytes |
| ---- | -------: | --------: | --------: |
| High |   20,974 |    31,308 |   863,452 |
| Low  |    7,345 |     8,125 |   288,196 |

See `public/assets/cathedral-report.json`. Reusable hero geometry belongs in Blender; stars, volumes, planets, asteroids, and changing matter are generated at runtime. DM Sans and Manrope are self-hosted with their OFL licenses.

## Quality and fallback

| Tier     | GPU matter particles | Asteroids | Volume steps | DPR cap |
| -------- | -------------------: | --------: | -----------: | ------: |
| ULTRA    |              160,000 |     7,000 |           72 |    1.75 |
| HIGH     |               80,000 |     4,000 |           52 |    1.50 |
| BALANCED |               36,000 |     1,800 |           32 |    1.15 |
| BATTERY  |               12,000 |       650 |           18 |    0.85 |

Mobile starts in Battery. Sustained slow frame cadence lowers detail automatically. Battery removes the bloom contribution; the post-processing pass graph remains warm. The hidden technical observatory offers particle, nebula, asteroid, and gravity stress scenarios, with automatic downgrading suspended during intentional stress.

When WebGPU is unavailable, Three.js automatically uses WebGL2. Procedural shaders and navigation remain available; 5,000 particles use a reduced CPU force integrator. Missing hero downloads retain a procedural gate. Context/device loss shows a static view and an explicit lighter-graphics retry. Audio is synthesized locally and requires an opt-in gesture.

## Scientific and practical limits

This is physics-inspired interactive art. Dust trajectories respond to actual force integration. Gravitational lensing, accretion appearance, atmosphere, clouds, star growth, and companion orbits are artistic approximations. This is not general relativity, an N-body simulation, or a planet-formation model.

Planets support close orbital inspection with procedural detail and collision clearance; full terrain landing and a ground-level ecosystem are not implemented. The distant galactic star field is an angular background population; nearby stars and nebulae occupy navigable space. Persistence is local to the browser and retains up to 24 created stars. Reduced motion softens navigation rather than eliminating all motion; P pauses the simulation. No UE5 edition was built.

## Verification and deployment

```sh
npm run qa:controls
npm run qa:devices
npm run qa:resilience
npm run qa:performance
npm run qa
```

These scripts use installed Chrome through Playwright and real input events against the real renderer. Set `QA_URL` for the deployed site; control, device, resilience, and visual scripts accept `QA_BROWSER=msedge`. `QA_TOUR=1` adds visits to the major landmarks. Reports and actual screenshots go to ignored `artifacts/`. `?qa=1` exposes read-only diagnostics; it does not provide camera teleport or test-only simulation actions.

See [the verification record](docs/QA.md) for measured results, corrected visual issues, and coverage limits. Performance numbers are browser frame intervals and renderer counters, not GPU timestamp queries. Physical phones, Safari, Firefox, thermal behavior, and long-duration memory stability need additional coverage.

The authenticated Vercel CLI deploys the project with `vercel deploy --prod`. GitHub source is available, but automatic Git-triggered Vercel deployment is not configured. The earlier timed Event Horizon edition is preserved in the `event-horizon-v1` tag; the current application has no forced progression.
