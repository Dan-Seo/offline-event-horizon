# VASTNESS 2.3 — the aurora coast

This change extends the existing persistent universe. It adds grounded exploration on Nacre and irregular, interactive gas around The Wound. The free cursor, language selection, movement guide, five original sanctuaries, other planetary regions, GPU matter field and optional Schwarzschild observation remain.

## Experience and implementation

**Explore → The aurora coast** uses the existing continuous approach flight. **Walk here / J** settles the observer onto the rendered terrain at a 1.8-unit eye height. WASD or the left thumb moves; drag or the right thumb looks. Space makes one small hop per press. Shift and Ctrl adjust pace; J returns to free flight through a three-second clearance transition. The camera has no head bob. Steep uphill movement and water deeper than 0.7 units constrain walking; this is a regional coastal walk, not complete planet-wide landing. Trees and decorative rocks remain permeable.

`walk-ground.ts` samples the actual two triangles in each terrain cell, including the parent sphere where the regional cap is buried. `walk.ts` owns grounded input and velocity, while `flight.ts` retains orbital/free flight and automation. Nine deterministic 20-unit grass tiles are recycled with at most one rebuild per frame. Each instance contains five tapered blades, animated on the GPU. Quality tiers use 900 / 650 / 420 / 230 tufts per tile. Ten world-space footstep records decay into emissive moss. Seventy-two nearby motes retain position/velocity state, gather during stillness and disperse when the observer moves. Miniature created lights use the existing bounded device-local save system.

Three curved aurora curtains are attached to the planetary region. Their folds and luminous rays animate in TSL, and the existing curved lagoon reflects the actual scene. This is an artistic aurora, not magnetospheric simulation. Nacre's reflection resolution is 1 / 0.65 / 0.45 / 0.3 of the render resolution for Ultra / High / Balanced / Battery.

At The Wound, **Release a stream of gas** injects a stream into bounded persistent particle state. Softened gravity, drag and a small disturbance advect at most 384 parcels with fixed 1/120-second updates. Position histories draw trails; source moments change disk brightness in the ordinary exterior and the optional ray-traced observation. The gas model runs on CPU on both backends. The dense pre-existing ambient simulation remains on GPU.

The Schwarzschild photon/observer equations are unchanged. Dynamic emission uses a shared scene clock, not retarded emission time, and the frequency calculation still assumes circular emitters. This is not GRMHD, Kerr rotation or a physically consistent variable-source plasma movie. The default Korean/English panel describes what is visible in plain language; readings and model details are collapsed. [Scientific assumptions and primary references](RELATIVITY.md).

## Corrections from browser inspection

- Moved the walking arrival from behind a rise to the lake-facing shore, so ground-level visitors can see the reflection immediately.
- Moved an obstructing trunk away from the arrival composition.
- Replaced dark, broad grass spikes with slender tufts and added wet-stone/moss detail.
- Refined nearby living motes from conspicuous faceted shapes into soft lights.
- Increased Nacre reflection resolution to reduce blocky canopy edges.
- Added a gradual takeoff so switching to flight does not snap the camera to its higher safety envelope.
- Hid empty gas trail geometry, eliminating a WebGPU zero-vertex draw warning.
- Removed the redundant pause hint beneath the observation/walking panel and added thumb-specific walking instructions.
- Visual inspection caught a black WebGL2 walking frame even though input checks and console checks passed. Isolating render layers traced it to the thin grass geometry's shader. UVs are now clamped and its fractional color power replaced with a bounded polynomial. The fallback renders correctly after this change. The walking suite now measures actual screenshot luminance, so an otherwise silent black canvas fails acceptance.

## Verification record

`npm run typecheck`, `npm test`, and production compilation passed during local development. The 23 unit tests include three new walking checks and two new accretion checks. Terrain heights are compared with 300 independent Three.js ray intersections, walking verifies eye height and diagonal speed, and a three-minute fixture checks water limits. Holding Space produces one hop and returns to ground. Gas fixtures check fixed-step render-rate independence, exact pause, bounded state, capture, and finite values after repeated injections. Existing coordinate, language, terrain, Newtonian and Schwarzschild tests remain passing.

The browser scripts operate installed Chrome/Edge through actual keyboard, pointer and CDP touch events. They inspect state but never teleport the camera or inject simulation results. Screenshots are opened for visual inspection. These are automated browser acceptance tests with agent visual review, not a human usability study or evidence of therapeutic benefit.

The complete local WebGPU approach/observation route passed 39 checks across all five planetary regions. Initial WebGPU walking passed 18 input/life checks. After the final shader and departure corrections, the expanded WebGL2/Battery walking route passed 23 checks, including two-thumb motion/look, relanding, gentle Wander departure and immediate manual takeover. The actual ground-level and stillness screenshots had mean RGB luminance 39.46 and 38.22 (0–255), respectively; about 93% and 91% of sampled pixels exceeded the black-frame threshold. These broad image sanity checks complement visual inspection; they do not measure aesthetic quality.

Local Chrome controls passed 48 checks, and device/fallback testing passed 34 checks with no unexpected errors. The deliberate context-loss test recorded its expected diagnostic and verified recovery. The separate WebGL2 gas/GR/Nacre route passed 23 checks. These wider routes preceded only the final grass clamp and shared gentle departure helper; the final expanded walking route exercises both changes. All screenshots described here were opened and inspected, including the corrected WebGL2 shoreline and portrait view. Reports are retained in [evidence/vastness-2.3](evidence/vastness-2.3/).

Production deployment and public verification are recorded below after those runs finish.
