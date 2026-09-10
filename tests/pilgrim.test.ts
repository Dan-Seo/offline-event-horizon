import test from "node:test";
import assert from "node:assert/strict";
import { Vector3 } from "three";
import {
  PilgrimDynamics,
  type Drive,
  type ContactWorld,
} from "../universe/pilgrim/model.ts";
import { ScenicDirector } from "../universe/pilgrim/director.ts";
import type { Analysis } from "../universe/perception/types.ts";
import { identity } from "../universe/perception/math.ts";
const input: Drive = {
  throttle: 1,
  steer: 0,
  lift: false,
  precision: false,
  boost: false,
};
const flat: ContactWorld = {
  sample: () => ({ height: 0, water: false, normal: new Vector3(0, 1, 0) }),
};
test("PILGRIM hovers, accelerates gently and settles after release independent of frame cadence", () => {
  const run = (hz: number) => {
    const m = new PilgrimDynamics();
    m.reset(new Vector3(0, 2.8, 0), 0);
    for (let i = 0; i < hz * 6; i++) m.advance(1 / hz, input, flat);
    return m;
  };
  const a = run(60),
    b = run(144);
  assert.ok(a.position.distanceTo(b.position) < 0.002);
  assert.ok(a.position.z < -50);
  assert.ok(Math.abs(a.position.y - 2.8) < 0.02);
  for (let i = 0; i < 360; i++)
    a.advance(1 / 60, { ...input, throttle: 0 }, flat);
  assert.ok(a.velocity.length() < 0.001);
});
test("One hull crosses land, water, a slope and a cliff, then lands without tunneling", () => {
  const m = new PilgrimDynamics();
  m.reset(new Vector3(0, 2.8, 0), 0);
  let water = false,
    glide = false,
    maxDrop = 0,
    previous = m.position.y;
  const world: ContactWorld = {
    sample: (_x, z) => ({
      height: z > -30 ? 0 : z > -60 ? (-z - 30) * 0.35 : z > -100 ? 10.5 : -8,
      water: z < -100,
      normal: new Vector3(0, 1, z < -30 && z > -60 ? 0.35 : 0).normalize(),
    }),
  };
  for (let i = 0; i < 60 * 24; i++) {
    m.advance(1 / 60, input, world);
    water ||= m.water;
    glide ||= m.gliding;
    maxDrop = Math.max(maxDrop, previous - m.position.y);
    previous = m.position.y;
    assert.ok(m.position.y >= world.sample(0, m.position.z).height + 0.99);
  }
  assert.ok(water && glide);
  assert.ok(maxDrop < 0.1);
  assert.ok(Math.abs(m.position.y - (-8 + 2.8)) < 0.3);
});
test("Finite lift, collision recovery, pause, and manual scenic interruption", () => {
  const m = new PilgrimDynamics();
  m.reset(new Vector3(0, 2.8, 0), 0);
  const wall: ContactWorld = {
    sample: (_x, z) => ({
      height: z < -15 ? 20 : 0,
      water: false,
      normal: new Vector3(0, 1, 0),
    }),
  };
  for (let i = 0; i < 600; i++) m.advance(1 / 60, input, wall);
  assert.ok(m.position.z > -15.1);
  const before = m.position.clone();
  m.advance(0, input, wall);
  assert.deepEqual(m.position, before);
  const lift = new PilgrimDynamics();
  lift.reset(new Vector3(0, 2.8, 0), 0);
  let highest = 0;
  for (let i = 0; i < 1200; i++) {
    lift.advance(1 / 120, { ...input, throttle: 0, lift: true }, flat);
    highest = Math.max(highest, lift.position.y);
  }
  assert.ok(
    highest < 14 && lift.liftReserve < 0.05,
    "Holding lift cannot sustain unlimited ascent",
  );
  for (let i = 0; i < 600; i++)
    lift.advance(1 / 120, { ...input, throttle: 0 }, flat);
  assert.ok(Math.abs(lift.position.y - 2.8) < 0.05);
  lift.position.y = -4;
  lift.advance(1 / 120, { ...input, throttle: 0 }, flat);
  assert.ok(
    lift.position.y >= 1 && lift.recoveries > 0,
    "Invalid contact penetration recovers above the surface",
  );
  const director = new ScenicDirector();
  director.start(0);
  director.cancel();
  assert.equal(director.active, false);
  assert.equal(director.update(1, 0.1, false).throttle, 0);
});

test("Scenic steering follows the perceived arc and brakes when observations become stale", () => {
  const director = new ScenicDirector();
  director.start(0);
  const analysis: Analysis = {
    id: 1,
    timestamp: 2,
    vo: {
      pose: identity(),
      delta: null,
      status: "TRACKING",
      segment: 0,
      features: 40,
      matched: 30,
      inliers: 28,
      ratio: 28 / 30,
      residual: 0,
      tracks: [],
    },
    cells: [],
    routes: [],
    chosen: {
      turn: 0.65,
      curvature: 0.65 / 32,
      speed: 10,
      score: 1,
      length: 32,
      safe: true,
      points: [],
    },
    coverage: 100,
    water: 0.3,
    green: 0.2,
    sky: 0.2,
    ms: 5,
    points: 100,
  };
  director.observe(analysis, 2);
  const drive = director.update(2.01, 1 / 60, false);
  assert.ok(
    Math.abs(
      (drive.steer * 0.52) / (drive.throttle * 12) - analysis.chosen!.curvature,
    ) < 1e-10,
  );
  assert.equal(director.update(3, 1 / 60, false).throttle, 0);
  director.observe(analysis, 3);
  assert.equal(director.update(3, 1 / 60, true).throttle, 0);
  director.cancel();
  assert.equal(director.active, false);
});
test("Scenic observations reject late delivery, future clocks and previous Carry history", () => {
  const director = new ScenicDirector();
  const view = (timestamp: number) => ({
    timestamp, chosen: { speed: 5, curvature: .02 }, green: 0,
  }) as Analysis;
  director.start(0);
  director.observe(view(.2), 10);
  assert.equal(director.update(10, .016, false).throttle, 0);
  director.observe(view(11), 10);
  assert.equal(director.update(11, .016, false).throttle, 0, "future view must not become valid later");
  for (const timestamp of [NaN, Infinity, -Infinity]) {
    director.observe(view(timestamp), 11);
    assert.equal(director.update(11, .016, false).throttle, 0);
  }
  director.observe(view(11), 11);
  assert.ok(director.update(11, .016, false).throttle > 0);
  assert.equal(director.update(10.9, .016, false).throttle, 0, "clock rollback brakes");
  director.cancel();
  director.observe(view(11.1), 11.1);
  assert.equal(director.update(11.1, .016, false).throttle, 0);
  director.start(11.2);
  assert.equal(director.update(13.2, .016, false).throttle, 0);
  director.observe(view(11.1), 11.2);
  assert.equal(director.update(13.2, .016, false).throttle, 0);
  director.observe(view(13.2), 13.2);
  assert.ok(director.update(13.2, .016, false).throttle > 0);
  director.clearObservation();
  assert.equal(director.update(13.21, .016, false).throttle, 0);
});
