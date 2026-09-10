# PILGRIM runtime hardening QA record

Baseline: `bd13e2a`. This record covers two verified runtime repairs only: stale captures could drive Carry, and reset could unlock an unresolved sensor transaction. No VO, math, map, or truth-boundary algorithm changed.

## Current verified local results

An Astra-low implementer completed the repair; a separate Astra-low reviewer returned **PASS**. Review and tests covered capture-clock freshness (maximum 0.85 seconds) and Carry-session boundaries, plus generation/request/capture ownership through reset, late success, late error, rejected capture, worker/post failure, and disposal. Reset clears cached director observations; one physical capture/worker owner remains retained until its own settlement. The focused perception/vehicle test selection passed 24 tests, including deterministic IMU gravity, acceleration and signed axis-rotation checks. Standalone typecheck passed.

Proportional local validation also passed: `npm test` 47/47; `npm run replay:rgbd -- docs/evidence/vastness-3.0/clear-eight-frames.tar.gz` compared seven relative poses with zero translation and rotation difference; and `npm run build` completed with `/` and `/lab` static. Actual local Chrome smoke at `http://localhost:4173` passed 9/9 with no runtime or shader errors. Evidence is retained in `artifacts/pilgrim-hardening/local/` (`npm-test.log`, `replay-rgbd.log`, `build.log`, and `pilgrim-smoke.json`).

## Production status: PENDING

No deployment, production measurement, or deployed-browser result is claimed here. Root owns integration and will record the deployed PILGRIM and `/lab` retest, production measurements, and acceptance decision after deployment.

## Remaining limitation

The single-flight ownership guard intentionally does not force-cancel an indefinitely non-settling platform operation. Such a hang can pause further analysis until settlement or disposal, but cannot release a newer transaction, create parallel capture work, or let stale observations steer Carry.

Existing scientific and experience limits remain unchanged: this is a bounded, ideal synthetic RGB-D baseline and local planner, not global SLAM, relocalization, or a therapeutic validation claim.
