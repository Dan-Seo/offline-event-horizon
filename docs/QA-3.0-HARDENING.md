# PILGRIM 3.0 hardening: production evidence

Carry could previously accept an old capture using its delivery time, and reset could unlock an unresolved sensor transaction. This release uses capture-time freshness and generation/request/capture ownership through settlement, with reset invalidating cached routes. A separate Astra-low worker implemented the repair, an Astra-low reviewer independently certified the critical contracts, and Terra medium handled documentation and QA evidence. The existing VO, map, world and vehicle models were preserved.

## Provenance and scope

Runtime commit `24c7e90c7794c6ab0a051fc077cf23cd90727701`; deployment `dpl_r7QhyNPNoWXv4HUFTZMoohmf3PY9`. Immutable deployment: `https://offline-event-horizon-i4i6n3qqq-sf-i455.vercel.app`; tested alias: `https://offline-vastness.vercel.app`. CI succeeded: https://github.com/Dan-Seo/offline-event-horizon/actions/runs/34424615272.

Previously verified locally: focused 24 tests, `npm test` 47/47, typecheck, build, saved eight-frame replay, and local Chrome smoke 9/9. An independent Astra-low review returned PASS. Production reports below were recorded in Chrome `152.0.7977.83` on Windows 11 / i7-12700K / RTX 3090 Ti / 31.7 GiB; they are single-machine browser observations, not device-wide performance guarantees.

An initial sandboxed WebGPU attempt was denied network access and yielded no application evidence. The same authorized suite was then run using an unrestricted browser-harness execution environment; that harness-environment change produced the successful reports below.

| Check | WebGPU (`2026-09-10T01:19:25.013Z`) | WebGL2 (`2026-09-10T01:21:56.400Z`) |
| --- | --- | --- |
| Lab checks / errors | 39/39 / 0 | 39/39 / 0 |
| Viewport, quality, DPR | 1600x1000, HIGH, 1 | 1600x1000, BATTERY, 0.85 |
| Frame interval p50 / p95 / p99 | 6.90 / 7.00 / not emitted ms | 6.90 / 7.00 / not emitted ms |
| Worker p50 / p95 | 9.10 / 15.00 ms | 8.60 / 13.90 ms |
| Calibration max / mean depth error | 0.001836 / 0.000705 (12 samples) | 0.004610 / 0.001370 (12 samples) |
| Clear tracking / ATE / RPE translation, rotation | 99.833%; 1.128; 0.153, 0.00971 rad | 99.835%; 1.620; 0.163, 0.00963 rad |
| 32-frame replay | 31/31 compared; zero translation/rotation difference | 31/31 compared; zero translation/rotation difference |

ATE is unscaled SE(3) alignment; RPE is approximately one-second relative motion. The short replay clips are near-collinear, so their ATE is unavailable; their replay RPE remains recorded in the JSON evidence.

Journey (`2026-09-10T01:26:25.056Z`): 16/16, zero errors; 1600x1000 HIGH/DPR 1, frame p50/p95/p99 6.90/7.00/7.10 ms. Quiet Carry ran 120 s, traveled 142.80 units, and held once. Keyboard W and two-thumb input immediately interrupted Carry; touch release, manual rest, planetary traversal, recovery, and bounded-state checks passed.

Ground-truth poses, renderer normals and semantic labels remain outside estimation and planning, used for evaluation, exports, QA and truth visualization. Documented actual terrain contact/recovery and a single artistic event-hold flag remain permitted physical/artistic inputs; neither truth pose nor privileged route coordinates inform pose estimation or route selection. A non-settling platform operation may pause analysis until settlement/disposal, while the ownership guard prevents stale steering or parallel capture work. The [existing model boundaries](PILGRIM.md) still apply: idealized RGB-D/IMU, local planning and mapping, no global relocalization or loop closure, and no therapeutic validation. The journey did not exercise cliff gliding; its deterministic dynamics checks are the evidence for that behavior in this pass.

Root accepted Gates D/E after all 94 production checks and personal inspection of the current water-stillness, coast, portrait, both sensor-panel, and trajectory captures. This is a rendered-evidence and automated-interaction judgment, not a human study or fresh audio test. The later docs-only commit does not change the deployed runtime.

Retained evidence: [summary](evidence/pilgrim-hardening/summary.json), [WebGPU report](evidence/pilgrim-hardening/pilgrim-lab-qa.json), [WebGL2 report](evidence/pilgrim-hardening/pilgrim-lab-qa-webgl.json), [journey report](evidence/pilgrim-hardening/pilgrim-journey.json), [WebGPU replay](evidence/pilgrim-hardening/lab-sequence-replay.json), [WebGL2 replay](evidence/pilgrim-hardening/lab-sequence-webgl-replay.json), [compressed WebGPU clip](evidence/pilgrim-hardening/clear-32-frames.tar.gz), [WebGPU lab](evidence/pilgrim-hardening/lab-webgpu.jpg), [WebGL2 lab](evidence/pilgrim-hardening/lab-webgl.jpg), [healing stillness](evidence/pilgrim-hardening/healing-stillness.jpg), and [healing portrait](evidence/pilgrim-hardening/healing-portrait.jpg).

Replay the retained current production capture with `npm run replay:rgbd -- docs/evidence/pilgrim-hardening/clear-32-frames.tar.gz`. Compression round-trip matched the original TAR SHA-256 `fc16dfae918260c4e6f8db96383358677dccd1748d5b233acf5a832cd6da3018`.

Horn's absolute-orientation solve now stops its Jacobi sweeps at a tolerance relative to the matrix's own Frobenius norm rather than a fixed absolute one, which ends the sweeps at a slightly different point. Replaying `tests/fixtures/clear-eight-frames.tar.gz` against the current tree reports a maximum translation difference of about 1.3e-10 instead of exactly 0, and its drift fraction moves in the eleventh decimal, from 0.06660124275924947 to 0.06660124274743297. The reports recorded above, including the zero replay differences, were produced before that change and ran through the same solver, so they are no longer bit-exact against the current tree; the 32-frame clips were not re-run in this pass. Every gate, tracking figure and accepted verdict above is unaffected — the shift is nine orders below the tightest gate.
