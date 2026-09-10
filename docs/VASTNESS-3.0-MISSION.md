# VASTNESS 3.0: PILGRIM mission

## Status and scope

This is the durable direction for this and subsequent VASTNESS 3.0 work, not a release-acceptance record. Current capabilities, measurements, and limits must be established from source and QA evidence, especially [PILGRIM.md](PILGRIM.md), rather than inferred from this mission. The target repository is `Dan-Seo/offline-event-horizon` and the production destination is `https://offline-vastness.vercel.app`. A listed URL is not proof of a verified deployment.

Preserve the mapped world and sanctuaries; terrain, reflective water, vegetation, creatures and environmental events; free input and flight; floating-origin planetary frames; WebGPU matter and WebGL2 fallback; quality tiers; gravity/relativity experiments; and portfolio documentation. The root architecture remains world/sanctuaries, PILGRIM contact/model/system/director, perception rig/runtime/worker/VO/map/metrics/dataset, and a lazy lab.

## The visitor experience

PILGRIM is a quiet, gentle craft, not a vehicle game. Its terrain, grass, sand, shallow-water, open-water, slope, cliff, limited-glide, landing, descent, and recovery behavior must form one continuous experience—no explicit vehicle modes. It should feel believable and comfortable through restrained acceleration, inertia, damping, steering, banking, hover/suspension, terrain following, slope response, water response and wakes, lift, controlled descent, and collision recovery. Prioritize comfort over physical purity. Do not introduce racing, violent camera behavior, fuel, missions, quests, stats, upgrades, achievements, inventory, or technical UI.

The craft's primary healing-facing concepts are **Go**, **Rest**, and **Carry me somewhere**, alongside preserved optional exploration and comfort controls. Ordinary visitors must not see SLAM, VO, RGB-D, mapping, ATE/RPE, occupancy-grid, or planner terminology. Carry is perception-based, scenic local travel—not a destination carousel, secret waypoint system, or privileged route. Manual input immediately takes over. It may approach water/coasts, forest/fields, mist, large trees, creatures, and viewpoints, with deliberate 30–60 second holds.

Scenic selection considers observed traversability and openness; horizon, foreground, vegetation, water, atmosphere, landmarks, life, light, history, intensity, and beauty events; and foreground/midground/background composition. These are artistic heuristics, never a therapeutic validation claim. Stillness remains worthwhile through life, light, audio, reflections, and clouds, without inactivity penalty. Maintain a restraint/stimulation budget and quiet after large events; favor persistent migrations, weather, clouds, and traces over repeated spectacles.

Favor compositions such as water with vegetation, shelter with open horizon, mist with distant light, and small life against an enormous landscape. Hold viewpoints and observe creatures; avoid trapped or claustrophobic forest routes. Keep the experience worthwhile when the visitor makes no decisions.

## Research Lens: same system, honest boundary

`/lab` is a lazy Research Lens over the same craft/world system and must have low inactive overhead. It provides genuinely synchronized RGB, depth, normals, semantic IDs, measured feature flow, intrinsics, extrinsics, timestamps, truth 6DoF, and synthetic IMU where applicable. Maintain a real RGB-D baseline: feature correspondence, depth-to-3D association, RANSAC, rigid transform, and pose composition. Use Kabsch/Umeyama, PnP, or Horn only where the actual representation warrants it, and state coordinate conventions.

The perception-plus-map traversability and Scenic Director pipeline is: observed data → VO → small honest reconstructed local map → route → safety → motion → controller. Truth pose must never be copied into an estimate. Never substitute arbitrary depth gradients, fake optical flow, a world-geometry map marketed as reconstruction, undefined trajectory alignment, or secret waypoint autonomy. Privileged state is restricted to documented physical contact, emergency safety, evaluation/QA, and truth visualization; it never informs estimation or route selection.

Use reproducible seeded CLEAR, FOG, LOW_LIGHT, REPETITIVE_VEGETATION, REFLECTIVE_WATER, DYNAMIC_CREATURES, RAIN, and FAST_MOTION conditions. Record configurations, calibration, truth, estimates, and metrics; keep research stress distinct from healing sessions. Defend ATE, RPE, drift, orientation, loss, feature, and inlier reporting with deterministic coordinate, pose-composition, transform, alignment, metric, and IMU tests. Separate render, physics, sensor, VO, map, and planner frequencies; use bounded queues, backpressure, and stale-work dropping.

## Release evidence

The intended release cycle is audit → architecture → task graph → delegate → independent review → integrate → numerical/browser/visual/experience/performance QA → build → Vercel deployment → retest actual deployed PILGRIM and lab → repair → evidence. Reports stay concise: architecture, delegated work, visitor experience, real autonomy/perception, exact truth uses, measured performance/QA, production status, and limitations. Source evidence outranks “should work” claims.
