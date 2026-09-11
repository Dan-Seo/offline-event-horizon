# VASTNESS architecture

Reference material that used to sit in the README: how the renderer is put together, how the hero geometry is authored, and what the simulation does and does not claim. [Back to the README](../README.md).

## Rendering and scale

Next.js 16, TypeScript, raw Three.js r183, `WebGPURenderer`, TSL, and Web Audio. React owns the small interface; the renderer, input state, camera, and simulation run outside React's render loop. Raw Three.js gives direct control over GPU buffers, compilation, render passes, and streaming without another scene reconciler.

- `universe/input.ts` centralizes keys, temporary drag capture, touch, wheel, blur, and cancellation.
- `pilgrim/model.ts` integrates the actual craft at 120 Hz; `contact.ts` confines privileged terrain/trunk queries to physical contact. `system.ts` connects the craft to the existing flight camera. The renderer still uses the established floating origin and planetary surface frames.
- `perception/rig.ts` renders synchronized 192×128 opaque RGB/depth/normals/semantic attachments from shared world geometry. `vo.ts`, `map.ts`, and `worker.ts` run image-based pose estimation and local mapping independently of rendering. `pilgrim/director.ts` converts observed local routes to physical steering and intentional rests. The worker receives no truth pose, semantic IDs or world destination.
- `perception/metrics.ts` evaluates segment-local unscaled SE(3) ATE and approximately one-second RPE. Near-collinear alignment and tracking loss are explicit. `dataset.ts` exports bounded raw sensor clips; `scripts/replay-rgbd.ts` verifies the same estimator against saved images. `/lab` and its UI are separately loaded.
- `flight.ts` handles damped velocity and angular input, distance-aware speed, focus, orbit, forgiving surface clearance, and optional Wander.
- `coordinates.ts` retains double-precision global positions on CPU, subtracts the observer, then compresses the far field logarithmically while preserving angular size.
- `world.ts` maintains 27 neighboring seeded sectors. New sectors arrive as the observer travels; distant sector resources are released. Landmark bodies coexist in the same spatial system.
- `planets.ts` shares procedural terrain, ocean, cloud, atmosphere, aurora, night-light, and ring materials across mesh LODs.
- `nebula.ts` raymarches spatial volumes through a seamless procedural 96³ density texture, with extinction and locally varying color. The camera can enter the volume.
- `stars.ts` combines a distant clustered stellar population with sector stars and local matter for parallax.
- `anomaly.ts` builds the accretion disk and lensed arcs; `engine.ts` adds bounded screen-space distortion and restrained bloom.
- `orbit-model.ts` integrates up to 144 interactive test particles on CPU with fixed 1/120-second velocity-Verlet steps and softened inverse-square gravity. `orbit-experiment.ts` renders their measured position histories. Dense ambient matter remains on GPU; the small experiment uses the same force model on both render backends.
- `relativity-model.ts` contains the Schwarzschild observer and null-ray reference model. The lazy-loaded `relativity.ts` traces the same equations per fragment through TSL, with a capped render target on both WebGPU and WebGL2. `RelativityPanel.tsx` keeps explanatory controls in English and Korean.
- `approaches.ts`, `approach-terrain.ts`, and `approach-water.ts` attach deterministic regional geometry, collision clearance, reflective water, instanced organic forms, and three-dimensional cloud volumes to the existing planetary bodies. They reuse the current flight controller, materials, and floating origin.
- `walk.ts` and `walk-ground.ts` add damped, grounded movement with height sampled from the rendered terrain triangles, slope/water limits, one-hop input, and a smooth departure into flight. `nacre-garden.ts` attaches reflected 3D aurora, nine recycled grass tiles, world-space footprint history, and 72 stateful ambient creatures. A tile rebuild is limited to one per frame.
- `accretion-model.ts` and `accretion.ts` keep a bounded, fixed-step gas experiment separate from the exact null-ray equations; small source moments reach the GPU as uniforms. This modest simulation runs on CPU on both backends; the existing dense matter/creature fields remain on GPU.
- `language.ts` holds every English and Korean string the interface renders, apart from the language button's own name; `ArrivalGuide.tsx` provides actual-input onboarding and `GravityExperiment.tsx` the optional experiment. Opening keyboard-driven panels clears held input. Drag capture lasts only for the gesture and is also released on blur or cancellation; the cursor remains visible and unrestricted.
- `matter.ts` maintains positions and velocities in GPU storage buffers, integrating softened fields, tangential motion, damping, and local-domain rebasing without per-frame readback.
- `creation.ts` keeps user-planted stellar seeds in world coordinates and saves the latest 24 in local storage.
- `sanctuaries.ts` coordinates local presence, stillness, and unannounced environmental events. It never changes scenes or takes camera control.
- `sanctuary-water.ts` combines a radially graded spherical ocean cap, a real planar scene reflection, procedural waves, and a small wake history.
- `sanctuary-atmosphere.ts` shares directional high-cloud radiance, local terrain haze, and bounded 3D raymarched mist. Per-view opaque-depth copies stop each ray at visible terrain; integrating the clipped interval avoids bands on nearby trunks. `sanctuary-nature.ts` instances recursive trees, leaves, rocks, grass, and noise-advected waterfall curtains.
- `sanctuary-life.ts` integrates position/velocity storage buffers for a damped shared flow and observer attraction/avoidance. The large translucent visitor is a procedural animated mesh.

High-frequency procedural detail is evaluated on the GPU. Planets have three geometry LODs; the Cathedral has two authored LODs. Material and light topology is shared to reduce shader compilation during streaming. The actual opening is shown as a static poster while the first shader set warms. The hero model loads progressively after flight becomes available. Reflection is warmed after async shader compilation to avoid the r183 nested-render/pending-pipeline race.

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

## Scientific and practical limits

The main universe is physics-inspired interactive art. Dust and released test particles respond to actual force integration. The Newtonian black-hole experiment uses a prescribed absorbing sphere and a finite escape boundary; its gravity slider and starting speeds use artistic units. Its ambient lensing, accretion appearance, atmosphere, clouds, star growth, and companion orbits are artistic approximations. The separate **freefall observation** solves ideal Schwarzschild light geodesics and frequency transfer; its sources, exposure, and color remain illustrative. It omits spin, collapse history, plasma dynamics, and quantum gravity. See the [model document](RELATIVITY.md) for numerical boundaries and validation. Neither mode is an N-body or planet-formation simulation.

The five original sanctuaries and five added planetary regions contain near-surface geometry or cloud volumes and forgiving collision envelopes; free flight and walking remain permissive, while PILGRIM uses conservative trunk contacts. Procedurally streamed planets outside those hero regions support orbital inspection, not full terrain landing. Mirrors use tangent-plane reflection on curved caps, not physically exact curved-water reflection. Sanctuary volumes clip against opaque scene depth, while transparent foliage and water use approximate compositing; the planetary cloud volumes are cheaper box ray marches. There is no multiple-scattering solution. Waterfalls are animated geometric curtains rather than fluid simulation. The large visitor and rare-event timing are authored approximations; small creatures have integrated dynamic state. The distant galactic star field is an angular background population. Persistence is local to the browser and retains up to 24 created lights. Reduced motion softens navigation rather than eliminating all motion; P pauses the simulation. No UE5 edition was built.

This is designed for a restful experience. No therapeutic benefit has been established. No participant study or personally photographed reconstruction has been completed. [Portfolio framing](PORTFOLIO.md), [a small formative-study protocol](FORMATIVE-STUDY.md), and [a future image-reconstruction workflow](RECONSTRUCTION.md) make the next personal contributions concrete without inventing results.
