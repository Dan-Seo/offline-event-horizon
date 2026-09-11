import test from "node:test";
import assert from "node:assert/strict";
import {
  compose,
  identity,
  inverse,
  norm,
  rigidFit,
  robustFit,
  scale,
  sub,
  transform,
  rotationAngle,
  type Pose,
  type Q4,
  type V3,
} from "../universe/perception/math.ts";
import { evaluateTrajectory } from "../universe/perception/metrics.ts";
import { RGBDOdometry } from "../universe/perception/vo.ts";
import { LocalMap, SENSOR_PITCH } from "../universe/perception/map.ts";
import type {
  RecordPair,
  SensorFrame,
  SensorImage,
  VOResult,
} from "../universe/perception/types.ts";
const spin = (a: number): Q4 => [0, Math.sin(a / 2), 0, Math.cos(a / 2)];
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
test("RPE pairing carries its forward index and still makes exactly the same pairs", () => {
  // Fifty records; at a fixed 5 Hz cadence the 1 s partner of sample i is sample i + 5.
  const make = (stamp: (i: number) => number): RecordPair[] => Array.from({ length: 50 }, (_, i) => {
    const t = stamp(i),
      p: V3 = [Math.sin(t) * 3, t * 0.1, t * 2];
    return {
      truth: {
        id: i,
        timestamp: t,
        pose: { p, q: spin(t * 0.11) },
        velocity: [0, 0, 0],
        imu: { acceleration: [0, 0, 0], gyro: [0, 0, 0] },
        condition: "CLEAR",
      },
      estimate: {
        pose: { p: scale(p, 1.03), q: spin(t * 0.13) },
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
    };
  });
  // The pairing the quadratic scan produced, restarting the search at i + 1 for every i.
  const reference = (records: RecordPair[]) => {
  const rpeT: number[] = [],
    rpeR: number[] = [];
  for (let i = 0; i < records.length; i++) {
    const a = records[i];
    let j = i + 1;
    while (
      j < records.length &&
      records[j].truth.timestamp - a.truth.timestamp < 1
    )
      j++;
    if (
      j >= records.length ||
      Math.abs(records[j].truth.timestamp - a.truth.timestamp - 1) > 0.26
    )
      continue;
    const b = records[j],
      error = compose(
        inverse(compose(inverse(a.truth.pose), b.truth.pose)),
        compose(inverse(a.estimate.pose), b.estimate.pose),
      );
    rpeT.push(norm(error.p));
    rpeR.push(rotationAngle(error.q));
  }
  return { rpeT, rpeR };
  };
  const rms = (v: number[]) =>
    Math.sqrt(v.reduce((s, x) => s + x * x, 0) / v.length);
  // A regular cadence, then one with 0.5 s jumps every 7th sample (partners outside the 0.26 s
  // tolerance) and 1.5 s gaps every 20th (the forward index must jump past several samples).
  const irregular = (i: number) => i * 0.2 + 0.5 * Math.floor(i / 7) + 1.5 * Math.floor(i / 20);
  for (const [records, pairs] of [[make((i) => i * 0.2), 45], [make(irregular), 0]] as const) {
    const { rpeT, rpeR } = reference(records);
    const segment = evaluateTrajectory(records).segments[0];
    if (pairs) assert.equal(segment.rpePairs, pairs);
    else assert.ok(rpeT.length > 10 && rpeT.length < 45, `irregular pairs ${rpeT.length}`);
    assert.equal(segment.rpePairs, rpeT.length);
    assert.ok(Math.abs(segment.rpeTranslation! - rms(rpeT)) < 1e-12);
    assert.ok(Math.abs(segment.rpeRotation! - rms(rpeR)) < 1e-12);
    assert.ok(segment.rpeTranslation! > 0.01 && segment.rpeRotation! > 0.01);
  }
});
test("Rigid fit recovers one rotation across a million-fold change of units", () => {
  // The conditioning floors in rigidFit are absolute, so the base set is ~100 across: it still
  // has area at 1e-6, which leaves the Jacobi tolerance as the only scale-dependent term.
  const wide = cloud.map((p) => scale(p, 25));
  const angles = [1e-6, 1, 1e6].map((s) => {
    const source = wide.map((p) => scale(p, s));
    const fit = rigidFit(
      source,
      source.map((p) => transform(truth, p)),
    );
    assert.ok(fit, `no fit at ${s}`);
    return rotationAngle(compose(inverse(fit), truth).q);
  });
  for (const angle of angles) assert.ok(angle < 1e-9, JSON.stringify(angles));
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
test("Tracking rejects an image the pyramid cannot halve twice", () => {
  const width = 18,
    height = 12,
    base = frame(0);
  const odd: SensorFrame = {
    ...base,
    k: { ...base.k, width, height },
    rgb: new Uint8Array(width * height * 4),
    depth: new Float32Array(width * height).fill(12),
  };
  const vo = new RGBDOdometry();
  assert.equal(vo.update(odd).status, "STARTING");
  assert.throws(
    () => vo.update({ ...odd, id: 1, timestamp: 0.2 }),
    /18x12 needs a width and height divisible by 4/,
  );
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
const groundFrame = (id: number, timestamp: number): SensorImage => {
  const f = frame(id);
  for (let y = 0; y < f.k.height; y++)
    for (let x = 0; x < f.k.width; x++) {
      const ray = (y - f.k.cy) / f.k.fy,
        den = ray * Math.cos(SENSOR_PITCH) + Math.sin(SENSOR_PITCH);
      f.depth[y * f.k.width + x] = den > 0.02 ? 4 / den : 0;
    }
  return { ...f, timestamp };
};
const tracking = (p: V3, q: Q4): VOResult => ({
  pose: { p, q },
  delta: null,
  status: "TRACKING",
  segment: 0,
  features: 40,
  matched: 40,
  inliers: 40,
  ratio: 1,
  residual: 0,
  tracks: [],
});
test("Revisit reads the route endpoint in the VO world its history is written in", () => {
  const visited: V3[] = [0, 1, 2, 3, 4].map((i) => [0, 0, i * 10]);
  // Five straight steps 4 s apart, so every one of them reaches the revisit history, and then
  // one more frame from a pose that differs only in where it stands and which way it looks.
  const drive = (pose: Pose) => {
    const map = new LocalMap();
    visited.forEach((p, i) =>
      map.update(groundFrame(i + 1, (i + 1) * 4), tracking(p, spin(0))),
    );
    return map
      .update(groundFrame(6, 24), tracking(pose.p, pose.q))
      .routes.find((r) => r.turn === 0)!;
  };
  // Route points are body-frame; the same pitch takes the endpoint back to the camera frame
  // and vo.pose takes that to the VO world, which is the frame the history entries are in.
  const expected = (pose: Pose, end: V3) => {
    const world = transform(pose, [
      end[0],
      -end[1] * Math.cos(SENSOR_PITCH) - end[2] * Math.sin(SENSOR_PITCH),
      -end[1] * Math.sin(SENSOR_PITCH) + end[2] * Math.cos(SENSOR_PITCH),
    ]);
    return (
      visited.reduce(
        (s, p) =>
          s + Math.exp(-Math.hypot(world[0] - p[0], world[2] - p[2]) / 15),
        0,
      ) / visited.length
    );
  };
  const back: Pose = { p: [0, 0, 40], q: spin(Math.PI) },
    side: Pose = { p: [0, 0, 40], q: spin(Math.PI / 2) },
    away: Pose = { p: [0, 0, 5000], q: spin(Math.PI / 2) };
  const [turned, yawed, elsewhere] = [back, side, away].map(drive);
  const end = turned.points.at(-1)!;
  assert.deepEqual(yawed.points.at(-1), end);
  // Nothing within reach of the distant pose was ever visited, so its revisit term is the zero
  // the other two are read against: the scores then differ only by the -0.7 x revisit term.
  assert.ok(expected(away, end) < 1e-100);
  const revisit = (r: typeof turned) => (elsewhere.score - r.score) / 0.7;
  const detail = JSON.stringify({
    end,
    back: revisit(turned),
    side: revisit(yawed),
  });
  assert.ok(Math.abs(revisit(turned) - expected(back, end)) < 1e-9, detail);
  assert.ok(Math.abs(revisit(yawed) - expected(side, end)) < 1e-9, detail);
  // Turned around, the route runs back over ground the craft has already been over.
  assert.ok(revisit(turned) > 0.4, detail);
  // Yawed away from its own track, the route ahead leaves that corridor behind.
  assert.ok(revisit(yawed) < revisit(turned) / 3, detail);
});
