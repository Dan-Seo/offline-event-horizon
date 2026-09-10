# Living Cosmos release QA — RELEASED / VERIFIED

**Root Gate E accepts production.** Runtime/test/harness commit
`aa96fe0` (`aa96fe0af5a5eff2ba0d7833554db97818259d84`) is verified at
https://offline-vastness.vercel.app after public-browser and visual review.
Local visual quality was also approved for the reflective surface, underwater
garden, and Wound; local evidence below is retained as a historical snapshot.

Feature contracts, physical-model limits, and manual routes remain in
[COSMIC-MOTION.md](COSMIC-MOTION.md) and [LIVING-OCEAN.md](LIVING-OCEAN.md).
The compact, durable local record is
[evidence/living-cosmos/local-evidence.json](evidence/living-cosmos/local-evidence.json).

## Local source and build gates

| Gate | Result | Scope |
| --- | --- | --- |
| CPU tests | PASS | 59 tests in `artifacts/living-cosmos/local-repaired/`. |
| Typecheck and build | PASS | Latest repair validation is in `artifacts/living-cosmos/gl-diagnostic/`; this is the relevant post-repair build evidence. |
| Ocean clearance | PASS | Float32 actual-triangle maximum depth 76.833637 m; 89.144 m cosmic underlay minimum; 12.310363 m clearance. |
| Independent repair review | PASS WITH ISSUES | Private Three 0.183.2 framebuffer restoration needs revalidation on a Three upgrade; no current consequential defect. |

The before/after mutation guard matched for the listed QA entry points and
inspection entry files: `engine.ts` `956392b`, `world.ts` `278b191`, smoke
`69f72d7`, lab `9a0a0b1`, approaches `3b7bd7c`, and living-cosmos
`1d2ff1e`. This is an entry-point guard, not a complete runtime manifest.

## Browser and visual evidence

All reports use `http://localhost:4173` and Chrome 152.0.7977.83; each has an
empty errors array.

| Scope | Backend | Result | Source report |
| --- | --- | --- | --- |
| PILGRIM smoke | Report schema does not state backend | 9/9 PASS | `artifacts/living-cosmos/regression/pilgrim-smoke/pilgrim-smoke.json` |
| PILGRIM lab | WebGPU | 39/39 PASS | `artifacts/living-cosmos/regression/pilgrim-lab-normal/pilgrim-lab-qa.json` |
| PILGRIM lab fallback | WebGL2 | 39/39 PASS | `artifacts/living-cosmos/regression/pilgrim-lab-webgl/pilgrim-lab-qa-webgl.json` |
| Last Light + Nacre ocean | WebGPU | 28/28 PASS | `artifacts/living-cosmos/gl-diagnostic/after-webgpu/report.json` |
| Last Light + Nacre ocean | WebGL2 | 28/28 PASS | `artifacts/living-cosmos/gl-diagnostic/after-webgl/report.json` |
| Coast + Wound follow-up | WebGPU | 22/22 PASS | `artifacts/living-cosmos/local-final/followup-gpu/report.json` |
| GR/orbit observation | WebGPU | 18/18 PASS | `artifacts/living-cosmos/regression/gr-normal/approaches-qa.json` |
| Giant + Wound | WebGL2 | 17/17 PASS | `artifacts/living-cosmos/regression/webgl-cosmic/report.json` |

The report bundle records bounded frame samples (180 per named scene) and
actual quality/backend. The focused WebGPU coast/Wound samples were 6.9 ms p50,
7.0 ms p95, and 7.0–7.1 ms p99 at HIGH; the WebGL Giant/Wound samples were
6.9 ms p50, 7.0 ms p95, and 7.1 ms p99 at BATTERY. See the durable JSON for
per-report performance provenance and every test result.

Representative approved local captures:

- [Last Light underwater](evidence/living-cosmos/last-light-underwater.jpg)
- [Wound before evolution](evidence/living-cosmos/wound-before.jpg)

## Delivered architecture and user-facing scope

- Planet presentation advances cloud/band phases and satellite motion around
  fixed approach anchors; the Wound couples released gas to accretion/model and
  shader clocks, with pause and manual takeover exercised in browser evidence.
- The ocean adds composited depth attenuation/Fresnel, a bounded garden/life
  presentation, and actual-triangle floor clearance. Users retain the existing
  manual route: enter at Last Light or Nacre, **X** descends, **Space** ascends,
  and normal flight/look controls remain available.
- Real RGB-D, VO, mapping, and Carry boundaries are unchanged. Privileged
  geometry inspection is limited to physical safety, evaluation, and QA; see
  [PILGRIM.md](PILGRIM.md) for those truth/estimate boundaries. This release
  does not claim a new SLAM system.

Actual Herdr orchestration roles were scoped: root owned release/Gate E and deployment;
the ocean owner held engine/water integration; cosmic-motion held cosmic
motion and remaining browser focus; this Terra QA pass archived local evidence
and documentation. Independent ocean re-review passed, and narrow graphics
review passed with the Three 0.183.2 restoration upgrade-revalidation issue.

The black-hole image remains qualitative: the repeated image is not geodesic
tracing, and there is no Kerr or GRMHD claim. The ocean life is a bounded visual
ecosystem, not a biological simulation. The private Three 0.183.2 framebuffer
restoration remains an upgrade revalidation requirement.

## Verified production browser evidence

Root accepted deployed underwater, Wound, Giant, PILGRIM front, and new-world
visual/experience continuity. The [production evidence](evidence/living-cosmos/production-evidence.json)
records WebGPU 43/43, WebGL2 25/25, smoke 9/9, and WebGPU lab 39/39: **116/116
checks passed with zero errors**.

- [Production WebGPU Last Light underwater](evidence/living-cosmos/production-webgpu-last-light-underwater.jpg)
- [Production WebGPU Wound before evolution](evidence/living-cosmos/production-webgpu-wound-before.jpg)

## Audit qualifications

Deployment `dpl_32E7S7VNqbF1fKjuPp7LcE1WHxaK` is READY at
https://offline-event-horizon-oanwbcxq3-sf-i455.vercel.app, with
https://offline-vastness.vercel.app as an alias; its Vercel metadata matches
the candidate SHA. GitHub Verify completed on that SHA at
2026-09-10T04:05:34Z (`npm ci`, typecheck, 59 tests, historical 8-frame replay,
and build). `artifacts/living-cosmos/production/deployment-inspect.json`
preserves the deployment/alias inspection.

The captured 32-frame replay is a reproducibility check: 31 comparisons, max
replay/runtime translation difference `3.469446951953614e-18`, rotation
difference `0`, and analysis `272.5462 ms`. It is **not** a ground-truth
accuracy claim. The same clip has RPE translation `0.167641 m`, RPE rotation
`0.00815664 rad` over 23 one-second pairs, and drift fraction `0.04690145`;
ATE is correctly unavailable for near-collinear motion. The durable 798-byte
record is [production-lab-sequence-replay.json](evidence/living-cosmos/production-lab-sequence-replay.json).

The final p6 evidence audit passed with issues and found no consequential
mismatch. Smoke’s schema does not report actual backend, quality, or timestamp;
its freshness rests on archived file metadata and root command provenance.
WebGL GPU timings are unavailable. Production lab frame p95 is 7 ms, but its
236.1 ms maximum means this record does not claim uniformly hitch-free research
operation. The fresh 15/15 production encounter baseline in
`artifacts/living-cosmos/baseline/root-fresh/` remains supplemental historical
evidence.
