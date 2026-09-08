import fs from "node:fs/promises";
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

const filename = process.argv[2];
if (!filename)
  throw new Error("Usage: npm run replay:rgbd -- path/to/sequence.tar");
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
const result = {
  file: filename,
  frames: captures.length,
  compared,
  maxTranslationDifference,
  maxRotationDifference,
  analysisMs: performance.now() - start,
  evaluation: evaluateTrajectory(records),
};
console.log(JSON.stringify(result, null, 2));
await fs.writeFile(
  filename.replace(/\.tar(?:\.gz)?$/i, "") + "-replay.json",
  JSON.stringify(result, null, 2),
);
