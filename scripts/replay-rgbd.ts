// Offline RGB-D replay gate: determinism against the recorded run, then accuracy.
// Thresholds (env override in brackets) — exceeding any of them exits non-zero:
//   lost frames / samples <= 0.1 [REPLAY_MAX_LOST]; the first STARTING frame is not a loss
//   segment endpoint drift / travelled distance <= 0.2 [REPLAY_MAX_DRIFT]
//   segment RMS relative translation error <= 0.5 [REPLAY_MAX_RPE], segments with rpePairs > 0 only
// Historical calibration at 9e02ad6: retained runs had maximum drift fraction 0.0703
// (0.067 on the eight-frame fixture), maximum RPE translation 0.179 m and no LOST frames.
// This gave roughly 2.8x margin for the 0.2 drift / 0.5 m RPE limits. These are original
// calibration observations, not maxima across newer clips. All defaults remain unchanged.
// A segment that travelled less than one unit reports no drift fraction (metrics.ts) and is
// gated by lost fraction alone. scripts/pilgrim-lab.mjs reads the same three variables with the
// same defaults, so one CI override moves the offline gate and the live lab gate together.
// The report goes to artifacts/replay/<basename>-replay.json unless --out <path> is given.
import fs from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { gunzipSync } from "node:zlib";
import { executionSource } from "./report-observations.ts";
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
const inputSha256 = createHash("sha256").update(raw).digest("hex");
const compressed = filename.endsWith(".gz");
const { captures, metadata } = decodeDataset(
  new Uint8Array(compressed ? gunzipSync(raw) : raw),
);
const captureMetadata = metadata && typeof metadata === "object"
  ? Object.fromEntries(Object.entries(metadata).filter(([key]) => ["version", "model", "seed", "condition"].includes(key)))
  : null;
const source = executionSource();
assert.ok(captures.length >= 2, "At least two frames are required");
const vo = new RGBDOdometry(),
  records: RecordPair[] = [];
let compared = 0,
  statusInlierFramesChecked = 0,
  maxTranslationDifference = 0,
  maxRotationDifference = 0;
let firstFailure: { id: number; check: string; message: string; expected: unknown; actual: unknown } | null = null;
const start = performance.now();
for (let i = 0; i < captures.length; i++) {
  const c = captures[i];
  // Only images, intrinsics and capture metadata reach the estimator.
  const estimate = vo.update(c.frame);
  records.push({ truth: c.truth, estimate });
  if (!i) continue; // The offline gauge starts at this recording's first image.
  const difference = estimate.delta && c.estimate.delta ? {
    translation: norm(sub(estimate.delta.p, c.estimate.delta.p)),
    rotation: rotationAngle(compose(inverse(estimate.delta), c.estimate.delta).q),
  } : null;
  let check = "status", expected: unknown = c.estimate.status, actual: unknown = estimate.status;
  // Only recorded-run comparison assertions become agreement failures.
  // Decode, minimum-frame and VO errors still throw normally.
  try {
    assert.equal(estimate.status, c.estimate.status, `Frame ${c.frame.id} tracking status`);
    check = "inliers"; expected = c.estimate.inliers; actual = estimate.inliers;
    assert.equal(estimate.inliers, c.estimate.inliers, `Frame ${c.frame.id} inlier count`);
    statusInlierFramesChecked++;
    if (difference) {
      const { translation, rotation } = difference;
      maxTranslationDifference = Math.max(maxTranslationDifference, translation);
      maxRotationDifference = Math.max(maxRotationDifference, rotation);
      check = "delta"; expected = { translationLessThan: 1e-5, rotationLessThan: 1e-5 }; actual = difference;
      assert.ok(translation < 1e-5 && rotation < 1e-5, `Frame ${c.frame.id} replay differs`);
      compared++;
    }
  } catch (error) {
    if (!(error instanceof assert.AssertionError)) throw error;
    firstFailure = { id: c.frame.id, check, message: error.message, expected, actual };
    break;
  }
}
const evaluation = firstFailure ? null : evaluateTrajectory(records),
  lostFraction = evaluation ? (evaluation.samples ? evaluation.lost / evaluation.samples : 0) : null,
  failures: string[] | null = evaluation ? [] : null,
  gatesEvaluated = { lostFraction: false, rpeSegments: 0, driftSegments: 0 };
if (evaluation && failures) {
  gatesEvaluated.lostFraction = true;
  if (!(lostFraction! <= maxLost))
    failures.push(
      `lost ${evaluation.lost}/${evaluation.samples} frames = ${lostFraction!.toFixed(3)} above REPLAY_MAX_LOST ${maxLost}`,
    );
  for (const s of evaluation.segments) {
    if (s.rpePairs > 0) {
      gatesEvaluated.rpeSegments++;
      if (!(s.rpeTranslation! <= maxRpe)) failures.push(
        `segment ${s.segment} RPE translation ${s.rpeTranslation} above REPLAY_MAX_RPE ${maxRpe}`,
      );
    }
    if (s.driftFraction !== null) {
      gatesEvaluated.driftSegments++;
      if (!(s.driftFraction <= maxDrift)) failures.push(
        `segment ${s.segment} drift fraction ${s.driftFraction} above REPLAY_MAX_DRIFT ${maxDrift}`,
      );
    }
  }
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
  inputSha256,
  hashedBytes: "archive-as-read", compressed, executionSource: source, captureMetadata,
  agreement: { passed: !firstFailure, statusInlierFramesChecked, deltaPairsCompared: compared, firstFailure },
  compared,
  maxTranslationDifference,
  maxRotationDifference,
  analysisMs: performance.now() - start,
  gates: { maxLost, maxDrift, maxRpe, lostFraction, failures, gatesEvaluated,
    evaluated: firstFailure ? "not-run-due-to-agreement-failure" : "completed" },
  evaluation,
  metricInterpretation: {
    rotation: "alignedRotationRms (rad), after positional SE3 alignment; not independent heading accuracy",
    distance: "Metres between successive TRACKING truth positions within each segment; omitted samples are not reconstructed",
  },
  metricAvailability: evaluation?.segments.map((s) => ({
    segment: s.segment, samples: s.samples, ateAvailable: s.ate !== null,
    rpeAvailable: s.rpePairs > 0, rpePairs: s.rpePairs,
    driftFractionAvailable: s.driftFraction !== null,
  })) ?? null,
};
console.log(JSON.stringify(result, null, 2));
await fs.mkdir(path.dirname(report), { recursive: true });
await fs.writeFile(report, JSON.stringify(result, null, 2));
if (firstFailure) {
  console.error("Replay agreement failed: " + firstFailure.message);
  process.exitCode = 1;
} else if (failures?.length) {
  console.error(
    "Replay accuracy gate failed:\n" + failures.map((f) => "  " + f).join("\n"),
  );
  process.exitCode = 1;
}
