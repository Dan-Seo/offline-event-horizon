// Offline RGB-D replay gate: determinism against the recorded run, then accuracy.
// Thresholds (env override in brackets) — exceeding any of them exits non-zero:
//   lost frames / samples <= 0.1 [REPLAY_MAX_LOST]; the first STARTING frame is not a loss
//   segment endpoint drift / travelled distance <= 0.2 [REPLAY_MAX_DRIFT]
//   segment RMS relative translation error <= 0.5 [REPLAY_MAX_RPE], segments with rpePairs > 0 only
// Calibrated against every retained clear run rather than a subset. Worst observed drift fraction
// is 0.0703 across the retained lab bundles under docs/evidence/ and 0.067 on the CI fixture
// tests/fixtures/clear-eight-frames.tar.gz; worst RPE translation is 0.179, on
// docs/evidence/pilgrim-hardening/clear-32-frames.tar.gz, which reports drift 0.050. The defaults
// therefore keep a 2.8x margin on both, and none of the retained runs lost a single frame.
// A segment that travelled less than one unit reports no drift fraction (metrics.ts) and is
// gated by lost fraction alone. scripts/pilgrim-lab.mjs reads the same three variables with the
// same defaults, so one CI override moves the offline gate and the live lab gate together.
// The report goes to artifacts/replay/<basename>-replay.json unless --out <path> is given.
import fs from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
import { gunzipSync } from "node:zlib";
import { decodeDataset } from "../universe/perception/dataset.ts";
import { RGBDOdometry } from "../universe/perception/vo.ts";
import {
  compose,
  inverse,
  norm,
  rotationAngle,
  sub,
} from "../universe/perception/math.ts";
import { evaluateTrajectory } from "../universe/perception/metrics.ts";
import type { RecordPair } from "../universe/perception/types.ts";

const usage =
  "Usage: npm run replay:rgbd -- path/to/sequence.tar [--out report.json]";
const args = process.argv.slice(2);
let filename = "",
  out = "";
for (let i = 0; i < args.length; i++)
  if (args[i] === "--out") {
    out = args[++i] ?? "";
    if (!out) throw new Error(usage);
  } else filename ||= args[i];
if (!filename) throw new Error(usage);
const limit = (name: string, fallback: number) => {
  const raw = process.env[name];
  if (raw === undefined) return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value)) throw new Error(`${name} must be a number`);
  return value;
};
const maxLost = limit("REPLAY_MAX_LOST", 0.1),
  maxDrift = limit("REPLAY_MAX_DRIFT", 0.2),
  maxRpe = limit("REPLAY_MAX_RPE", 0.5);
const raw = await fs.readFile(filename);
const { captures } = decodeDataset(
  new Uint8Array(filename.endsWith(".gz") ? gunzipSync(raw) : raw),
);
assert.ok(captures.length >= 2, "At least two frames are required");
const vo = new RGBDOdometry(),
  records: RecordPair[] = [];
let compared = 0,
  maxTranslationDifference = 0,
  maxRotationDifference = 0;
const start = performance.now();
for (let i = 0; i < captures.length; i++) {
  const c = captures[i];
  // Only images, intrinsics and capture metadata reach the estimator.
  const estimate = vo.update(c.frame);
  records.push({ truth: c.truth, estimate });
  if (!i) continue; // The offline gauge starts at this recording's first image.
  assert.equal(
    estimate.status,
    c.estimate.status,
    `Frame ${c.frame.id} tracking status`,
  );
  assert.equal(
    estimate.inliers,
    c.estimate.inliers,
    `Frame ${c.frame.id} inlier count`,
  );
  if (estimate.delta && c.estimate.delta) {
    const translation = norm(sub(estimate.delta.p, c.estimate.delta.p));
    const rotation = rotationAngle(
      compose(inverse(estimate.delta), c.estimate.delta).q,
    );
    maxTranslationDifference = Math.max(maxTranslationDifference, translation);
    maxRotationDifference = Math.max(maxRotationDifference, rotation);
    assert.ok(
      translation < 1e-5 && rotation < 1e-5,
      `Frame ${c.frame.id} replay differs`,
    );
    compared++;
  }
}
const evaluation = evaluateTrajectory(records),
  lostFraction = evaluation.samples ? evaluation.lost / evaluation.samples : 0,
  failures: string[] = [];
if (!(lostFraction <= maxLost))
  failures.push(
    `lost ${evaluation.lost}/${evaluation.samples} frames = ${lostFraction.toFixed(3)} above REPLAY_MAX_LOST ${maxLost}`,
  );
for (const s of evaluation.segments) {
  if (s.rpePairs > 0 && !(s.rpeTranslation! <= maxRpe))
    failures.push(
      `segment ${s.segment} RPE translation ${s.rpeTranslation} above REPLAY_MAX_RPE ${maxRpe}`,
    );
  if (s.driftFraction !== null && !(s.driftFraction <= maxDrift))
    failures.push(
      `segment ${s.segment} drift fraction ${s.driftFraction} above REPLAY_MAX_DRIFT ${maxDrift}`,
    );
}
const report =
  out ||
  path.join(
    "artifacts",
    "replay",
    path.basename(filename).replace(/\.tar(?:\.gz)?$/i, "") + "-replay.json",
  );
const result = {
  file: filename,
  report,
  frames: captures.length,
  compared,
  maxTranslationDifference,
  maxRotationDifference,
  analysisMs: performance.now() - start,
  gates: { maxLost, maxDrift, maxRpe, lostFraction, failures },
  evaluation,
};
console.log(JSON.stringify(result, null, 2));
await fs.mkdir(path.dirname(report), { recursive: true });
await fs.writeFile(report, JSON.stringify(result, null, 2));
if (failures.length) {
  console.error(
    "Replay accuracy gate failed:\n" + failures.map((f) => "  " + f).join("\n"),
  );
  process.exitCode = 1;
}
