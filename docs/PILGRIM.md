# PILGRIM — release design and model boundary

One world, two lenses. The existing universe, free cursor, walking, planetary approaches, languages and black-hole observation stay in place. PILGRIM is a spring-supported hovercraft, not a replacement camera engine. The ordinary controls are Go, Rest and Carry me somewhere. Research instrumentation lives at `/lab`.

## Information boundary

The craft's dynamics may query the rendered terrain for contact and emergency collision recovery. That is simulated physical contact, not a perception claim. The local planner receives only calibrated RGB-D observations and the resulting local map. The message that crosses into the worker carries exactly the capture id, its timestamp, the RGB and depth planes and the camera intrinsics; the sensor condition and the seed stay behind on the capture and its truth record, so "RGB and depth only" is the literal payload rather than a summary of it. It receives no landmark coordinates, world height function, semantic ground truth or ground-truth pose. Renderer normals and semantic labels are exported for evaluation only. Ground truth is joined to estimates by capture ID outside the worker; it is never sent into VO.

The sensor camera shares the craft pose, terrain triangles and object instance transforms with the artwork. A bounded opaque sensor pass excludes bloom, atmospheric compositing and decorative translucent particles. Sensor RGB is a calibrated, explicitly simplified appearance model, rather than a screenshot of the artistic post-processing pipeline. Depth is axial camera depth. Transparent water is modeled as a visible surface in the clear configuration; reflective-water failure conditions invalidate its depth. This is an ideal synthetic RGB-D camera, not a faithful Kinect simulator.

```mermaid
flowchart LR
  W[Shared world geometry] --> C[Physical contact and recovery]
  C --> P[PILGRIM dynamics]
  P --> S[Synchronized sensor rig]
  W --> S
  S -->|RGB and depth only| V[Worker: visual odometry]
  V --> M[Observed local map]
  M --> D[Scenic Director]
  D -->|Throttle and steering| P
  S -->|Truth outputs| E[Lab evaluation and export]
  V -->|Estimated poses| E
  P --> H[Healing camera and environmental response]
```

The manual controls interrupt the director before its commands reach the dynamics. The evaluation branch has no return path into estimation or route choice. Sensor rendering runs during Carry and deliberate lab use; ordinary manual riding and flight do not keep it active.

## Baseline, not novel SLAM

The baseline detects Shi–Tomasi corners, tracks 7×7 image patches with three-level pyramidal Lucas–Kanade, checks forward/backward consistency and normalized patch error, associates interpolated inverse depth and estimates a rigid 3D transform with RANSAC and Horn's quaternion absolute-orientation solution. It composes relative estimates in its own initial frame. There is no pose copying, loop closure, global bundle adjustment or global relocalization. Tracking failure starts a new segment; no invented bridge is drawn across a missing interval. Runtime diagnostics hide the pose while tracking is lost or starting. Internal VO results retain the last pose for bookkeeping, including in recordings; only a `TRACKING` pose is a current estimate. The director ignores other poses for stall detection and resets its motion anchor when the tracked segment changes.

The implementation solves the 2×2 image-gradient system directly. It is not an OpenCV/WASM wrapper. Horn's symmetric 4×4 eigenproblem uses Jacobi rotations and the largest algebraic eigenvalue; the sweeps stop at an off-diagonal magnitude measured against the matrix's own Frobenius norm, so the same fit is reached whatever units the points carry. Degenerate point sets are rejected. RANSAC draws its triples from a generator seeded by the capture id, so the same clip replays identically, and discards a draw whose absolute-orientation fit is degenerate: collinear triples are rejected after they are drawn, not avoided in the draw. It requires at least eight inliers and a 40% inlier ratio, then refits those inliers. Depth discontinuities are rejected before interpolating inverse depth. Source-to-target point motion is inverted when composing camera motion.

The local map fuses depth points only across valid consecutive visual estimates. On tracking loss it falls back to the current body-relative depth scan and reduces speed. Scenic choices combine observed clearance, slopes, image color/visibility, recent estimated travel and a preference to rest. Appearance-based water/vegetation scores are heuristics, not semantic networks or therapeutic metrics.

ATE uses an unscaled SE(3) least-squares alignment within each tracked segment. RPE compares relative motions over a stated time interval. Never fit scale to hide RGB-D scale error. Degenerate alignment, insufficient pairs, lost tracking and dropped captures are explicit.

Stationary or nearly collinear trajectories do not reliably constrain an alignment rotation. The lab's manual route therefore steers as well as accelerating, so its segment can produce a conditioned SE(3) alignment instead of only reporting that it has none. ATE is unavailable when either trajectory has less than 0.05% transverse energy relative to its longest displacement axis; RPE remains available. The trajectory plot displays the latest segment relative to each trajectory's first pose, with no scale fitting. This evaluation-only alignment never feeds the estimator. RPE uses approximately one-second pairs with a maximum 0.26-second sampling tolerance; rotation values are radians in exports and degrees in the panel.

## Scheduling

Rendering and the 120 Hz vehicle integrator are independent of sensor/analysis frequency. Sensors request at most 8 Hz on desktop or 4 Hz on the initial small viewport. Deliberate rest, scenic watching and bounded retry holds use a quarter rate, never slower than one capture every 0.8 seconds; initial observation, stale-view recovery and recording keep the full rate. Physical stillness, sensing cadence and the visitor's rest message are separate: a failed search or missing observation does not display the scenic-rest whisper. Only one capture/worker transaction may be in flight. No stale queue is accumulated; missed capture slots are counted. Maps keep at most 14,000 recent depth points, contact interpolation at most 18,000 nodes, and lab recording at most 3,600 pose pairs. Disabled research and manual flight do not render sensors. Carry uses the same perception worker as the lab; the lab adds visualizations and bounded local recording, not a substitute navigation stack.

Each transaction has one retained physical capture/worker owner and is identified by its generation, request, and capture IDs. Carry accepts an observation only from its current session when the capture timestamp is no more than 0.85 seconds old; reset clears cached director observations and invalidates prior generations. Late successes, transport failures, and errors may settle only their own owner, so they cannot unlock or publish into newer work. A request that arrives at the worker without a sensor frame settles immediately as an error carrying the same generation, request and capture identity, closing its own transaction and nothing else. There is deliberately no forced timeout that overlaps an indefinitely non-settling platform operation: it can pause analysis until settlement or disposal, but cannot create parallel work or revive stale Carry input.

Sensor RGB and labels use RGBA8 targets; depth and normals use RGBA32F. The combined 24 attachment bytes per sample stay within WebGPU's baseline attachment limit. A capture ID and simulation timestamp identify the simultaneous GPU outputs. RGB uses a seeded mip-filtered triplanar texture and approximate gamma encoding. Depth has no quantization/noise model in CLEAR. Sparse flow is measured feature displacement, not dense ground-truth flow. Camera coordinates for export are x right, y down, z forward; quaternion storage is x/y/z/w and poses map camera to world. Normals use the same camera axes. The IMU is an ideal sensor-rate finite-difference approximation with a local 9.81-unit gravity field, not a high-rate biased hardware model.

The deliberate lab reset is a fixed forest-edge starting fixture. It is the only lab positioning action. Normal Carry does not call it. FOG, LOW_LIGHT, REPETITIVE and REFLECTIVE_WATER change the synthetic observation model; RAIN and DYNAMIC are explicitly image-space corruptions/occlusions. FAST_MOTION increases manual drive speed in the lab. These conditions do not silently change a normal healing session. The map's water/vegetation preferences come from RGB appearance, not the exported semantic truth.

The simulation's contact oracle samples visible terrain triangles through a bounded 3-unit interpolation atlas in the original sanctuaries; in planetary regions it evaluates the same deterministic terrain generator function the region's geometry was built from, which is arithmetic rather than a triangle query. Conservative trunk bounds provide contact rejection. Those privileged queries are isolated in `pilgrim/contact.ts`. They model physical contact, not sensor-based obstacle prediction. A single artistic beauty-event flag can hold a composition; it carries no destination or route coordinates.

Candidate routes are local constant-curvature arcs, not world-space splines between attractions. Their selected curvature is converted to the craft's physical yaw rate at the chosen speed. The planner does not perform global search, guaranteed collision avoidance, learned aesthetic scoring or semantic recognition. Unknown near-field cells are rejected. One stationary scan turns for up to 3.5 seconds at 0.8 of the shared steering constant, about 79 degrees; retained heading opens a new sector on the next scan. An unsuccessful scan starts a 30–60 second retry hold, counted as `holds`, not a successful scenic rest. Two distinct consecutive fresh safe captures may end a no-route hold early. A held-hull scan preserves its cause through tracking loss and cannot use this shortcut. A route followed for more than 18 seconds, extended by observed greenery, ends in a protected 32–58 second scenic rest, counted as `stops`; scenic watching has its own reason. Estimated motion below 0.6 units for 4 seconds of commanded travel indicates a held hull only while tracking is valid in one segment. Current-depth fallback remains limited to 4 units/s and is reported separately from tracked travel. During LOST, held-hull detection is unavailable; fallback safety relies on observed near-field rejection and physical contact/recovery, not a known current pose. No truth pose, contact query or world coordinate enters the director. The craft can still remain in one area for a long time; a safe stop is not evidence of successful travel. Contact recovery is a separate last line of defense.

## Reproducible sensor clips

In `/lab`, **Record 32 sensor frames** captures a bounded, device-local RGB-D sequence. Each image, depth plane, normal plane, semantic plane, IMU sample, truth pose and estimate is paired by the same capture ID before publication. A full clip is about 16 MB uncompressed. Recording stops at 32 frames; reset or a condition change clears the clip. Nothing is uploaded.

**Download RGB-D sequence** exports an ordinary uncompressed TAR containing `manifest.json` and per-frame binary planes. RGB is row-major RGBA8, depth is little-endian Float32 axial z, normals are three little-endian Float32 components, and semantic labels are Uint8. The manifest includes camera intrinsics, fixed body-relative extrinsics, timestamps, seed, conditions, and paired truth/estimated poses. The separate JSON export includes the latest synchronized sensor frame and up to 3,600 trajectory samples.

```sh
npm run replay:rgbd -- path/to/vastness-rgbd-clear.tar
```

The replay is also an accuracy gate. It exits non-zero when LOST frames exceed 0.1 of **all** captured samples, when a tracked segment's endpoint drift exceeds 0.2 of its travelled distance, or when its available RMS relative translation error exceeds 0.5. The initial STARTING frame is counted in the denominator but is not a LOST frame; tracking fraction and sample counts are also reported. `REPLAY_MAX_LOST`, `REPLAY_MAX_DRIFT` and `REPLAY_MAX_RPE` control the same limits in offline replay and live lab QA. A segment below one unit has no drift fraction; RPE is checked whenever suitable pairs exist. Missing ATE/RPE is not zero error. Earlier retained clips were near-collinear; the September 22 turning capture produces a conditioned unscaled SE(3) alignment (see the appended pass in `QA-3.0-HARDENING.md`). Reports go to `artifacts/replay/` unless `--out` names a path.

This command runs the same RGB-D estimator directly on saved images and depth, outside Three.js. It checks relative pose estimates, tracking status and inlier counts against the captured runtime results. Its first pose starts a fresh gauge; it does not copy the recorded initial estimate. Truth is only joined afterward for evaluation. The dataset is an idealized synthetic observation of shared geometry, not real-world sensor evidence.

A small actual WebGPU capture is retained as `tests/fixtures/clear-eight-frames.tar.gz`. The replay command also accepts this gzip-compressed TAR. CI checks its seven relative estimates, inlier counts and tracking states; the clip is too short and nearly straight for meaningful aligned ATE or one-second RPE. The longer downloaded sequence and complete run report are the appropriate evaluation sources.

## Vehicle and experience boundaries

The leaf-like craft uses a 120 Hz damped hover spring, bounded horizontal acceleration, steering inertia, surface-normal pitch and slight banking. Land/water contact is continuous. Cliff departures use controlled descent and a small finite lift reserve; there is no infinite flight mode or fuel UI. It rides the original sanctuaries and four solid planetary regions. Planet-scale free flight and Nacre walking remain separate user-controlled ways to travel; selecting an explicit distant approach leaves the craft. Boarding is limited to 150 units of clearance, symmetrically: a hand-over from further above would be a long uncontrollable fall, and one from further below is refused too. Above the hover spring zone the descent is capped at clearance × 0.12 units per second, held between 5.5 and 14, so a hand-over at the limit reaches the spring zone in roughly eighteen seconds of simulated time and settles at hover height a few seconds later, while a release close to the surface still falls no faster than the original 5.5. The Veil's arrival point is about a thousand units above the sea and outside the island's contact footprint, so it stays unboardable by design; Carry appears there only after the visitor descends toward the island or the water.

Grass bends around a short fading world-space trail, the existing water reflection receives the hull and wake, and local creatures respond to the shared moving observer. These are restrained artistic responses, not fluid/vegetation biomechanical simulations. Existing rare-event scheduling is preserved; a beauty event can pause scenic motion without stacking a new event. PILGRIM is procedurally authored in Three.js; the existing Cathedral remains the Blender-authored hero asset.

No full global SLAM, loop closure, absolute relocalization, dense optical flow, hardware-calibrated IMU noise, fully reconstructed translucent foliage, global scenic route planning or validated restorative score is implemented. The local map and perception-only route selection are deliberately modest and inspectable.

## Primary references

- [Horn, 1987 — absolute orientation](https://people.csail.mit.edu/bkph/papers/Absolute_Orientation_Scanned.pdf).
- [TUM RGB-D benchmark tools — ATE and RPE](https://cvg.cit.tum.de/data/datasets/rgbd-dataset/tools).
- [OpenCV optical-flow documentation — pyramidal Lucas–Kanade and its assumptions](https://docs.opencv.org/4.13.0/d4/dee/tutorial_optical_flow.html).

Implementation, measured results and remaining limits are recorded separately in the release QA record. No participant results or clinical benefit are claimed.
