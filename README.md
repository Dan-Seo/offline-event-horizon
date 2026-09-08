# OFFLINE // EVENT HORIZON

A five-minute interactive exhale for exhausted developers. A late-night desk unravels into a singularity, its pixels become a galaxy, and that matter becomes a quiet living world.

**WORK → DISTORTION → COLLAPSE → ESCAPE → COSMOS → CREATION → LIFE → SILENCE**

No score, puzzle, account, analytics, or external media requests. Sound starts muted. The ending stays open.

## Run

Node 24 and npm are recommended. No environment variables or service credentials are needed to run the artwork.

```sh
npm ci
npm run dev
```

Development: `http://localhost:3000`. For the actual static production build:

```sh
npm run typecheck
npm test
npm run build
npm start
```

Production preview: `http://localhost:4173`. Deploy `out/` using the included Vercel configuration. The renderer must run on HTTPS or localhost for WebGPU.

## Experience

Move gently to influence the view and dust. Drag a floating notification away, or use **Release a thought**. In Creation, touch the dust or choose **Plant a possibility**. Everything also progresses without interaction.

| Control                    | Action                                |
| -------------------------- | ------------------------------------- |
| Space                      | Pause / continue the guided journey   |
| Right arrow                | Drift to the next chapter             |
| R                          | Release a thought / plant a seed      |
| F                          | Hidden technical observatory          |
| Settings                   | Quality, gentler motion, journey pace |
| Eight small progress marks | Revisit a chapter                     |

For deterministic inspection, `?t=165&quality=HIGH` pauses in the galaxy; `&play=1` resumes. `?backend=webgl` forces the fallback. The observatory includes 180k-particle storm, three attractors, galaxy, ecosystem, and repeated transformation scenarios. Returning to Journey restores the previous position and quality.

## Rendering

Next.js 16, TypeScript, React 19, and Three.js r183. React owns the small accessible interface; raw Three.js owns the render loop, scene, camera, and simulation. React Three Fiber is intentionally omitted to keep direct control over compute dispatch, resources, and postprocessing.

- `engine.ts`: lifecycle, renderer selection, timing, pointer raycasts, quality adaptation, camera, recovery.
- `office.ts`: original Blender workspace, procedural screens, rain, floating keycaps, notifications, physical fragmentation.
- `cosmos.ts`: TSL particle morphology, WebGPU storage-buffer simulation, singularity, galaxy, atmosphere, and growing planet.
- `debris.ts`: samples notification glyphs into transient shader-animated fragments.
- `journey.ts`: continuously choreographed camera and miniature city / planet / moon / orbital layers.
- `life.ts`: spherical-cap-to-terrain vertex morph, procedural water, instanced plants, wind, fireflies, sky, aurora.
- `audio.ts`: opt-in Web Audio noise and harmonic ambience. No recorded music or commercial samples.

The same scene stays alive throughout the journey. Monitor and desk particle origins morph through orbital matter into the galaxy. Office geometry separates and shrinks as the camera recedes. Nested visual scales avoid astronomical floating-point coordinates. The planet's near surface unfolds into a local landscape; light, fog, water, vegetation, and the camera continue the transformation.

TSL implements procedural materials, gravitational screen warp, restrained bloom, glyph breakup, atmosphere shells, terrain morphing, water ripples, vegetation wind, and aurora curtains. These compile for both WebGPU and WebGL2. See the [Three.js WebGPU guide](https://threejs.org/manual/en/webgpurenderer) and [TSL reference](https://threejs.org/docs/TSL.html).

## Simulation and scientific honesty

WebGPU integrates particle positions and velocities in persistent GPU storage buffers. Forces combine softened attractors, a spring toward the authored galaxy distribution, tangential drift, drag, and bounded reset. Pointer movement, seeds, and the three-field benchmark affect that integration. There is no per-frame particle readback. The HUD's compute number measures **CPU submission time**, not GPU execution time.

This is a physics-inspired artwork. The black hole uses screen-space lensing and an emissive disk; it does not trace general-relativistic light paths. Particle destinations, object collapse, cosmic scales, planet formation, and ecological growth are authored procedural transformations. This is not an N-body astrophysics, fluid, or biological simulation. A seed changes the dust field; it does not determine a scientifically emergent planet. Water and atmospheric reflections are shader approximations. The local terrain is not a geographically exact patch of the globe.

## Blender

`assets/source/office.blend` is the original source. `scripts/build_assets.py` rebuilds the beveled walnut desk, monitor housings and stands, laptop, keyboard base, mouse, mat, hollow mug, brass lamp, and source rock through Blender's Python API.

```sh
blender --background --python scripts/build_assets.py
```

Export: **25 objects, 3,232 vertices, 6,276 triangles, 8 materials, 196,552-byte GLB**. Applied bevels and weighted normals, meter units, glTF Y-up. No image textures or animation clips in the GLB. Runtime textures provide wood grain, screens, rain/city detail, and typography. Blender CLI was available; Blender MCP was not.

Reusable geometry stays in Blender; thousands of changing stars, blades, branches, and terrain vertices are generated at runtime. The small export does not need Draco or a large decoder download. Self-hosted DM Sans and Manrope fonts include OFL licenses in `public/fonts`.

## Quality and fallback

| Tier     | Cosmic particles | DPR cap |  Grass | Trees | Bloom |
| -------- | ---------------: | ------: | -----: | ----: | ----- |
| ULTRA    |          180,000 |    1.75 | 14,000 |   145 | Yes   |
| HIGH     |           90,000 |    1.50 |  8,000 |   145 | Yes   |
| BALANCED |           42,000 |    1.25 |  4,500 |   110 | Yes   |
| BATTERY  |           14,000 |    0.85 |  1,600 |    65 | No    |

Narrow viewports start in Battery. Sustained slow frames lower the quality tier; benchmarks disable automatic downgrades. The first usable office frame precedes initialization of later scene systems. The 192 KiB office GLB is the only model download.

Three automatically selects WebGL2 when WebGPU is unavailable. WebGL2 preserves the journey and shader morphs with analytic particle drift; it does not run the compute integrator. Missing Blender assets retain a simplified procedural workspace. Context/device loss offers a lightweight retry at the saved time and a static quiet ending. Reduced motion removes pointer parallax and animated environmental oscillations and disables the compute drift; the slow guided scale journey remains. Keyboard pause and chapter navigation remain available.

## Verification

```sh
npm run qa                 # Chapter screenshots + WebGPU / forced WebGL2
npm run qa:controls        # Drag, keys, touch, benchmark, sound state, fault injection
npm run qa:performance     # Warm 2560×1440 render-loop measurements
npm run qa:journey         # Entire normal-speed 300-second journey
```

These scripts use an installed Chrome through Playwright. Set `QA_URL` to test a deployed URL. Control tests also accept `QA_BROWSER=msedge`. They write actual screenshots and JSON to the ignored `artifacts/` directory. They do not mock the renderer or substitute screenshots for rendering.

See [QA evidence](docs/QA.md) for measured results and coverage limits. An optional feature-detected WebMCP registry is included; ordinary Chrome used for QA did not expose it, so live WebMCP execution remains unvalidated.

No Unreal Cinematic Edition was built. The web artwork is the primary edition.
