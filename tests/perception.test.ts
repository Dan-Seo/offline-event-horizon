import test from "node:test";
import assert from "node:assert/strict";
import {
  compose,
  identity,
  inverse,
  norm,
  rigidFit,
  robustFit,
  sub,
  transform,
  rotationAngle,
  type V3,
} from "../universe/perception/math.ts";
import { evaluateTrajectory } from "../universe/perception/metrics.ts";
import { RGBDOdometry } from "../universe/perception/vo.ts";
import { LocalMap } from "../universe/perception/map.ts";
import type { RecordPair, SensorFrame } from "../universe/perception/types.ts";
const truth = {
  p: [0.42, -0.2, 0.3] as V3,
  q: [0.1, 0.2, 0.05, Math.sqrt(1 - 0.01 - 0.04 - 0.0025)] as [
    number,
    number,
    number,
    number,
  ],
};
const cloud: V3[] = Array.from({ length: 60 }, (_, i) => [
  Math.sin(i * 2.8) * 4,
  Math.cos(i * 0.83) * 2,
  2 + i * 0.13,
]);
test("Horn rigid fit recovers a known metric rotation/translation, including planar points", () => {
  for (const points of [cloud, cloud.map((p) => [p[0], p[1], 3] as V3)]) {
    const fit = rigidFit(
      points,
      points.map((p) => transform(truth, p)),
    )!;
    assert.ok(fit);
    assert.ok(norm(sub(fit.p, truth.p)) < 1e-10);
    assert.ok(rotationAngle(compose(inverse(fit), truth).q) < 1e-7);
  }
  assert.equal(
    rigidFit(
      [
        [0, 0, 0],
        [1, 0, 0],
        [2, 0, 0],
      ],
      [
        [0, 0, 0],
        [1, 0, 0],
        [2, 0, 0],
      ],
    ),
    null,
  );
});
test("RANSAC rejects 30% mismatches without ground-truth assistance", () => {
  const target = cloud.map((p, i) =>
    i % 3 === 0 ? ([90 + i, -12, 13] as V3) : transform(truth, p),
  );
  const fit = robustFit(cloud, target);
  assert.ok(fit.pose);
  assert.ok(fit.inliers.length >= 39);
  assert.ok(norm(sub(fit.pose.p, truth.p)) < 1e-9);
});
test("ATE uses SE3 without scale; RPE catches known drift and excludes tracking gaps", () => {
  const make = (s: number): RecordPair[] =>
    cloud.map((p, i) => ({
      truth: {
        id: i,
        timestamp: i * 0.2,
        pose: { p, q: identity().q },
        velocity: [0, 0, 0],
        imu: { acceleration: [0, 0, 0], gyro: [0, 0, 0] },
        condition: "CLEAR",
      },
      estimate: {
        pose: { p: p.map((v) => v * s) as V3, q: identity().q },
        delta: null,
        status: "TRACKING",
        segment: 0,
        features: 40,
        matched: 40,
        inliers: 40,
        ratio: 1,
        residual: 0,
        tracks: [],
      },
    }));
  assert.ok(evaluateTrajectory(make(1)).segments[0].ate! < 1e-10);
  const scaled = evaluateTrajectory(make(1.2));
  assert.ok(scaled.segments[0].ate! > 0.2);
  assert.ok(scaled.segments[0].rpeTranslation! > 0.1);
  const gaps = make(1);
  gaps[12].estimate.status = "LOST";
  gaps.slice(13).forEach((r) => (r.estimate.segment = 1));
  const m = evaluateTrajectory(gaps);
  assert.equal(m.lost, 1);
  assert.equal(m.segments.length, 2);
  const line = make(1);
  line.forEach((r, i) => {
    r.truth.pose.p = [i, 0.00001 * Math.sin(i), 0];
    r.estimate.pose.p = [i * 1.01, 0, 0];
  });
  const ambiguous = evaluateTrajectory(line).segments[0];
  assert.equal(
    ambiguous.ate,
    null,
    "Do not fit an arbitrary rotation to a nearly straight trajectory",
  );
  assert.ok(
    ambiguous.rpeTranslation! > 0,
    "Relative motion remains evaluable without a trajectory alignment",
  );
});
const frame = (id: number, shift = 0): SensorFrame => {
  const width = 128,
    height = 96,
    rgb = new Uint8Array(width * height * 4),
    depth = new Float32Array(width * height).fill(12);
  // A static textured plane translated by 2 pixels. Image generation knows truth; VO never receives it.
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const xx = x + shift;
      let seed =
        (Math.imul(Math.floor(xx / 3), 73856093) ^
          Math.imul(Math.floor(y / 3), 19349663)) >>>
        0;
      seed = Math.imul(seed ^ (seed >>> 13), 1274126177) >>> 0;
      const c = 30 + (seed % 190),
        i = (y * width + x) * 4;
      rgb.set([c, c, c, 255], i);
    }
  return {
    id,
    timestamp: id * 0.2,
    rgb,
    depth,
    k: {
      width,
      height,
      fx: 100,
      fy: 100,
      cx: 63.5,
      cy: 47.5,
      near: 0.1,
      far: 200,
    },
    condition: "CLEAR",
    seed: 1,
  };
};
test("RGB-D VO recovers image-generated lateral motion, reports loss and starts an unbridged segment", () => {
  const vo = new RGBDOdometry();
  assert.equal(vo.update(frame(0)).status, "STARTING");
  let r = vo.update(frame(1, 2));
  assert.equal(r.status, "TRACKING");
  assert.ok(Math.abs(r.pose.p[0] - 0.24) < 0.035, JSON.stringify(r.pose));
  assert.ok(r.inliers > 15);
  const blank = frame(2);
  blank.rgb.fill(0);
  r = vo.update(blank);
  assert.equal(r.status, "LOST");
  vo.update(frame(3, 4));
  r = vo.update(frame(4, 6));
  assert.equal(r.status, "TRACKING");
  assert.equal(r.segment, 1);
  assert.ok(Math.abs(r.pose.p[0] - 0.24) < 0.04);
});
test("Local planner refuses unobserved space and makes routes from depth, not labels or world coordinates", () => {
  const f = frame(0);
  f.depth.fill(0);
  const v = new RGBDOdometry().update(f),
    map = new LocalMap();
  assert.equal(map.update(f, v).chosen, null);
  for (let y = 0; y < f.k.height; y++)
    for (let x = 0; x < f.k.width; x++) {
      const ray = (y - f.k.cy) / f.k.fy,
        den = ray * Math.cos(0.22) + Math.sin(0.22);
      f.depth[y * f.k.width + x] = den > 0.02 ? 4 / den : 0;
    }
  const result = map.update(f, v);
  assert.ok(result.chosen?.safe);
  assert.ok(result.coverage > 50);
});
