# VASTNESS 3.0 // PILGRIM — release verification

This release extends the 2.3 runtime at `9b0abf2`. The existing universe, planetary approaches, aurora coast, grounded walking, free cursor, Korean/English guide, black-hole observation and GPU ambient simulation are retained. The change adds one physical hovercraft and one shared perception/navigation stack, with instrumentation isolated at `/lab`.

## Verification environment

Windows desktop with an NVIDIA GeForce RTX 3090 Ti (driver 32.0.15.9174). Installed Chrome 152.0.7977.83 and installed Microsoft Edge were driven through Playwright using actual keyboard, pointer and CDP touch events. Viewports include 1600×1000, 1440×900, 1366×768, 1024×768, 390×844 and 844×390. These are browser viewport/touch emulations, not physical phone tests. Reports specify the actual backend, DPR and quality.

## Deterministic and numerical checks

All 34 Node tests pass. They cover the preserved orbital, GR, walking, language and streaming models plus:

- Fixed 120 Hz craft dynamics at different render cadences, terrain/water transitions, slopes, cliff glide, landing, finite lift, contact recovery and rest.
- Perception-route curvature converted to physical yaw rate, stale-observation braking and direct manual cancellation.
- Horn rigid alignment on known transforms, planar and degenerate configurations; deterministic RANSAC with mismatches.
- RGB-D motion estimated from independently generated images/depth, tracking loss and unbridged recovery segments.
- Unscaled SE(3) ATE, relative-pose error, scale drift and tracking gaps. Near-straight trajectories explicitly lack ATE when alignment is ill-conditioned.
- Unknown-space rejection and local route generation from depth rather than semantic/world truth.
- Raw sensor archive alignment, byte layout, signed floats, checksums, truncation and capture-ID synchronization.

Two actual 32-frame browser captures, one from WebGPU and one from WebGL2, were replayed by the same estimator in Node, with no renderer or truth input. All 31 relative estimates, tracking statuses and inlier counts matched within 1e-5; the observed maximum translation differences were 0 and approximately 1.1e-14 units. The first offline pose deliberately starts a fresh gauge. A retained eight-frame WebGPU clip is also replayed by CI. It is a reproducibility fixture, not a sufficiently long localization benchmark.

## Browser checks

The local WebGPU and forced-WebGL2 lab suites each passed 33 checks. They verify real GPU sensor outputs, independent depth/label calibration, manual RGB-D motion, observed-route travel, autonomous rests, bounded maps/contact caches, sequence export, synchronized pose/sensor export, immediate override, pause, all eight controlled conditions, tracking loss/recovery, responsive layouts and two-thumb control. WebGL2 retains the same calibrated sensor/VO/map pipeline. It reduces artistic particle/volume budgets rather than substituting truth for an estimate.

GPU depth was compared against independently ray-intersected shared geometry at twelve image samples. Local maximum differences were 0.0034 units on the recorded WebGPU pass and 0.0047 units on the final WebGL2 pass, with no label mismatches. This checks camera convention and raster/readback alignment at the fixture, not universal depth accuracy at every world position.

The normal PILGRIM smoke route passed nine checks. Existing free-flight controls passed 48 checks, Korean/English onboarding passed 19, and the touch guide/responsive route passed 18. The opening can now enter Carry directly without a mandatory tutorial. These scripts exercise actual input and inspect the renderer; they do not mutate camera poses through a testing API.

## Measured local runs

One approximately 75-second clear lab run contained 604 samples, including one startup sample. Tracking coverage was 99.83%, with no LOST frames. Over 190.92 truth units, its aligned ATE was 1.096 units, one-second translation RPE 0.147 units, and relative rotation RMSE 0.00925 radians (0.53°). Endpoint translation drift was 5.48% of path length. The corresponding forced-WebGL2 run had 605 samples, 99.83% coverage, ATE 1.331 units, translation RPE 0.139 units, relative rotation RMSE 0.00751 radians (0.43°), and 7.03% endpoint drift. These are separate actual runs, not bit-identical cross-backend experiments or a comparative algorithm benchmark.

Both short lab runs observed a 7.0 ms rAF frame-interval p95 on this desktop. WebGPU used High/DPR1; WebGL2 used Battery/DPR0.85. The rendered canvas occupies the viewport area left of the research panel. Worker-analysis p95 was 16.6 ms and 14.7 ms respectively, at up to eight observations per second. rAF cadence includes presentation scheduling; GPU timestamp readings are separate pass measurements and are not substituted for whole-frame time. These observations do not guarantee performance on other GPUs or phones.

## Corrections found by running and looking

- The original three-float-attachment sensor target exceeded WebGPU's baseline attachment limit. RGB/labels now use byte targets, keeping the combined target at 24 bytes/sample.
- Low linear RGB contrast, aliased texture detail and depth-edge feature selection caused unnecessary tracking fragmentation. Gamma-encoded, mip-filtered triplanar appearance and depth-valid feature selection improved continuity. The observation model remains explicitly simplified.
- A readback could be displayed beside the preceding analysis. Captures now publish only when the matching worker result arrives; dataset frames and truth/estimates share an ID.
- Nearly straight trajectories could produce misleading alignment rotations. Those ATE fits are now marked unavailable, while valid relative-motion errors remain visible.
- A development indicator intercepted the new Go button. The documented Next.js indicator option removes that overlap.
- Static preview `/lab` conflicted with Next's RSC directory of the same name. The preview server now resolves the exported HTML file correctly.
- A profiling-only WebGL timestamp pool was allocated without resolution. Unsupported profiling is disabled at backend initialization; the corrected fallback lab run has no warnings.
- Initial grass spikes and an oversized hull weakened the composition. Actual screenshots guided narrower, bounded grass detail and a smaller leaf-like craft.
- Scenic steering initially turned more tightly than the candidate arcs. It now follows the proposed curvature through the physical yaw response, and discourages views crowded by very close geometry.
- The old planetary description card covered the mobile driving view, and the expanded footer overflowed. Planet information now yields while aboard; touch controls and secondary buttons have separate room. Touch instructions replace keyboard copy on coarse-pointer devices.

## Local release regressions

Installed Edge 152.0.4191.66 passed all sixteen final PILGRIM journey checks, including ordinary arrival without sensor overhead, direct Carry entry, quiet-mode handover, native Ctrl+C, disabling sensors during manual rest, planetary coastal boarding, movement onto water, portrait layout and two-thumb takeover. A longer earlier water observation ran for two minutes; the corrected final route used one minute before the coast. The retained final walking regression also passed all 23 checks, including visible terrain, ground-level movement, mobile input, light placement, graceful takeoff and recovery.

## Public release verification

Runtime commit `fc0ed649a463982494bd806bc4592e0458cab22b` was pushed to GitHub and deployed to Vercel on September 9, 2026 (KST). [GitHub CI](https://github.com/Dan-Seo/offline-event-horizon/actions/runs/34292168234) passed type checking, all 34 numerical tests, the retained RGB-D replay and the production build. Vercel reported READY and assigned [the public domain](https://offline-vastness.vercel.app) to deployment `dpl_EFCX77Ycnm7HxVgBcaThAhcXqwfb`. The exact immutable address and observed deployment state are retained in `evidence/vastness-3.0/deployment.json`.

The actual public `/lab` passed all 38 WebGPU checks. The expanded suite also tests capture/analysis synchronization, actual increased vehicle speed in FAST_MOTION, and visible help bounds at laptop, tablet and portrait sizes. Public sensor calibration, tracking degradation/recovery, pause, manual takeover and two-thumb input passed without browser or shader errors. Captured production screenshots were opened and inspected, including the forest-edge composition, route rest, sensor/evaluation views and portrait layout.

The public clear WebGPU run retained 601 samples, including one startup frame, with no LOST frames (99.83% coverage). Over 171.70 truth units, ATE was 1.599 units, one-second translation RPE was 0.155 units, rotation RPE was 0.00832 radians (0.48°), and endpoint drift was 2.62%. At High/DPR1 on the desktop above, frame-interval p95 was 7.0 ms and worker-analysis p95 was 15.0 ms. The actual 32-frame public recording replayed all 31 relative estimates exactly in Node. These are observed results for this run and simplified sensor model, not real-world localization accuracy.

The public forced-WebGL2 lab passed **39 checks**, including the same 38 cases plus a pixel-level check that both moving truth and estimated trajectories actually appear in the plot. Its clear run had 604 samples, no LOST frames, 99.83% coverage, 1.371-unit ATE, 0.133-unit translation RPE, 0.00812-radian rotation RPE and 3.12% endpoint drift over 173.99 truth units. Sensor depth differed from the twelve independent ray intersections by at most 0.00295 units, with no label mismatch. At Battery/DPR0.85, frame-interval p95 was 7.0 ms and worker p95 was 13.9 ms. GPU timestamps were deliberately unavailable on this fallback. All 31 relative estimates from its public 32-frame archive also replayed exactly. The moving-trajectory and portrait screenshots were inspected; the earlier nearly stationary evaluation image intentionally has no meaningful fitted ATE.

The normal public journey passed all sixteen checks, including an uninterrupted **eight-minute quiet Carry observation**, planetary coastal boarding, movement onto water, manual rest, native Ctrl+C, flight, portrait controls and two-thumb takeover. During the eight-minute segment the craft traveled 741.27 units and made five intentional stops. No browser or shader errors were reported. Across all 531 state samples, the contact cache peaked at 7,967 entries, the local point map stayed at or below 14,000 points and the streamed-sector count remained 27. These check bounded application structures, not a full heap or GPU-memory leak analysis.

The eight-minute frame trace contained 69,633 intervals at High/DPR1 and 1600×1000. p95 was 7.0 ms, p99 was 7.1 ms, the maximum was 69.4 ms, and three intervals exceeded 50 ms. Screenshots at four and eight minutes and at the aurora coast were opened and inspected: water/sky reflections, restrained craft scale, open sightlines, portrait composition and clear control hit areas remained intact. The repository retains every twentieth state sample plus the last one, while all checks and maxima use the full trace. This is a sustained desktop observation, not evidence of multi-hour or thermally constrained mobile stability.

The public Korean/English onboarding suite passed all nineteen checks: browser-language arrival, immediate language switching, persistent preference, optional lessons driven by real drag/W/wheel input, direct welcome-to-Carry entry, immediate manual override, accessible help/menu controls and an unrestricted cursor. No runtime or shader errors occurred.

Local and public reports retain their source URL in `evidence/vastness-3.0/`. Additional public journey and fallback results are recorded with the same runtime commit; later documentation-only commits do not imply a different deployed runtime.

## Boundaries

This is a real baseline RGB-D odometry and observed local-navigation implementation, not novel SLAM, global navigation, dense flow or hardware-accurate RGB-D/IMU simulation. Contact recovery reads privileged geometry; the planner does not. The local controller may stop for a long time when it cannot observe a safe opening. Normals/semantic labels are truth outputs and never estimator inputs. No loop closure or absolute relocalization bridges tracking loss. No human participants, therapeutic evidence, physical-phone results, Safari/Firefox coverage or UE5 edition are claimed. [Full model boundaries](PILGRIM.md).
