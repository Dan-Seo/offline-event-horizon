import test from "node:test";
import assert from "node:assert/strict";
import { Vector3 } from "three";
import {
  PilgrimDynamics,
  BOARD_CLEARANCE,
  CRUISE_SPEED,
  HOVER_HEIGHT,
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
const observation: Analysis = {
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
/** A fresh view whose only difference is the estimated position the director may see. */
const estimated = (timestamp: number, x: number): Analysis => ({
  ...observation,
  timestamp,
  vo: { ...observation.vo, pose: { p: [x, 0, 0], q: [0, 0, 0, 1] } },
});
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
  const before = a.position.clone();
  a.advance(NaN, input, flat);
  a.advance(1 / 60, input, flat);
  assert.ok(
    a.position.distanceTo(before) > 0,
    "a single non-finite frame time cannot freeze the accumulator",
  );
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
  director.observe(observation, 2);
  const drive = director.update(2.01, 1 / 60, false);
  const curvature = observation.chosen!.curvature;
  // The commanded drive must produce that curvature in the model, not merely restate the constants.
  const m = new PilgrimDynamics();
  m.reset(new Vector3(0, HOVER_HEIGHT, 0), 0);
  for (let i = 0; i < 60 * 8; i++) m.advance(1 / 60, drive, flat);
  const from = m.position.clone(),
    yaw = m.yaw,
    travelled = m.distance;
  let middle = from;
  for (let i = 0; i < 60 * 6; i++) {
    m.advance(1 / 60, drive, flat);
    if (i === 60 * 3 - 1) middle = m.position.clone();
  }
  const path = m.distance - travelled,
    realised = Math.abs(m.yaw - yaw) / path;
  assert.ok(
    Math.abs(path / 6 - drive.throttle * CRUISE_SPEED) < 0.05,
    "throttle is expressed in the shared cruise speed",
  );
  assert.ok(
    Math.abs(realised - curvature) < curvature * 0.02,
    `realised curvature ${realised} matches the observed ${curvature}`,
  );
  const a = Math.hypot(middle.x - from.x, middle.z - from.z),
    b = Math.hypot(m.position.x - middle.x, m.position.z - middle.z),
    c = Math.hypot(m.position.x - from.x, m.position.z - from.z),
    area =
      Math.abs(
        (middle.x - from.x) * (m.position.z - from.z) -
          (m.position.x - from.x) * (middle.z - from.z),
      ) / 2;
  assert.ok(
    Math.abs((a * b * c) / (4 * area) - 1 / curvature) < 1.5,
    "the traced arc radius matches the observed route",
  );
  assert.equal(director.update(3, 1 / 60, false).throttle, 0);
  director.observe(observation, 3);
  assert.equal(director.update(3, 1 / 60, true).throttle, 0);
  director.cancel();
  assert.equal(director.active, false);
});
test("A held hull is read from its own estimate alone, a travelling one is not", () => {
  const held = new ScenicDirector();
  held.start(0);
  let stopped = 0;
  for (let i = 181; i <= 60 * 16 && !stopped; i++) {
    const time = i / 60;
    held.observe(estimated(time, 0), time);
    if (held.update(time, 1 / 60, false).throttle === 0) stopped = time;
  }
  assert.ok(
    stopped > 3 + 4 && stopped < 3 + 5,
    `commanded motion without estimated travel stops after about 4 s (${stopped})`,
  );
  assert.equal(held.reason, "looking for an opening");
  assert.equal(held.resting, false, "a turning hull is not resting");
  const going = new ScenicDirector();
  going.start(0);
  for (let i = 181; i <= 60 * 13; i++) {
    const time = i / 60;
    going.observe(estimated(time, (i - 181) / 12), time);
    assert.ok(
      going.update(time, 1 / 60, false).throttle > 0,
      `an estimate that keeps moving must keep travelling (${time})`,
    );
  }
});
test("A blocked scan sweeps a new sector, holds 30-60 s, and continues around", () => {
  const director = new ScenicDirector(),
    m = new PilgrimDynamics();
  m.reset(new Vector3(0, HOVER_HEIGHT, 0), 0);
  director.start(0);
  const scans: { began: number; ended: number; yaw: number; steer: number }[] =
    [];
  let open: { began: number; yaw: number; steer: number } | undefined;
  for (let i = 1; i <= 60 * 100; i++) {
    const time = i / 60;
    director.observe({ ...observation, timestamp: time, chosen: null }, time);
    const drive = director.update(time, 1 / 60, false);
    assert.equal(drive.throttle, 0, "a scan never drives");
    m.advance(1 / 60, drive, flat);
    if (drive.steer !== 0 && !open)
      open = { began: time, yaw: m.yaw, steer: drive.steer };
    if (drive.steer === 0 && open) {
      scans.push({ ...open, ended: time, yaw: m.yaw - open.yaw });
      open = undefined;
    }
  }
  assert.ok(scans.length >= 2, `the craft scans repeatedly (${scans.length})`);
  for (const scan of scans.slice(0, 2)) {
    const degrees = Math.abs(scan.yaw) * (180 / Math.PI);
    assert.ok(
      degrees > 60 && degrees < 90,
      `one scan sweeps materially (${degrees} degrees)`,
    );
  }
  assert.equal(
    Math.sign(scans[0].steer),
    Math.sign(scans[1].steer),
    "successive scans continue around instead of retracing the same sector",
  );
  const hold = scans[1].began - scans[0].ended;
  assert.ok(hold >= 30 && hold <= 60, `the blocked hold is 30-60 s (${hold})`);
  assert.ok(
    Math.hypot(m.position.x, m.position.z) < 1,
    "scanning turns in place",
  );
});
test("Boarding is limited to a clearance the craft can actually settle from", () => {
  const near = new PilgrimDynamics();
  near.reset(new Vector3(0, HOVER_HEIGHT + BOARD_CLEARANCE, 0), 0);
  let settled = 0;
  for (let i = 1; i <= 60 * 30; i++) {
    near.advance(1 / 60, { ...input, throttle: 0 }, flat);
    if (!settled && Math.abs(near.position.y - HOVER_HEIGHT) < 0.2)
      settled = i / 60;
  }
  assert.ok(
    settled > 0 && settled < 25,
    `a hand-over at the boarding limit settles (${settled} s)`,
  );
  assert.equal(near.recoveries, 0, "without striking the surface");
  // MOONFALL hands the craft over at a clearance of about 130.
  const moonfall = new PilgrimDynamics();
  moonfall.reset(new Vector3(0, 130, 0), 0);
  let sprung = 0;
  for (let i = 1; i <= 60 * 30; i++) {
    moonfall.advance(1 / 60, { ...input, throttle: 0 }, flat);
    if (!sprung && moonfall.position.y <= 14) sprung = i / 60;
  }
  assert.ok(
    sprung > 0 && sprung < 18,
    `a hand-over at MOONFALL's clearance reaches the spring zone (${sprung} s)`,
  );
  assert.ok(
    Math.abs(moonfall.position.y - HOVER_HEIGHT) < 0.2,
    "and comes to rest at hover height",
  );
  assert.equal(moonfall.recoveries, 0, "without tunnelling through the ground");
  // Scaling the descent with clearance must not disturb the fall near contact.
  const gentle = new PilgrimDynamics();
  gentle.reset(new Vector3(0, 20, 0), 0);
  let fastest = 0;
  for (let i = 0; i < 60 * 10; i++) {
    gentle.advance(1 / 60, { ...input, throttle: 0 }, flat);
    fastest = Math.max(fastest, -gentle.velocity.y);
  }
  assert.ok(
    fastest <= 5.5,
    `a release at clearance 20 never falls faster than 5.5 u/s (${fastest})`,
  );
  const far = new PilgrimDynamics();
  far.reset(new Vector3(0, 2000, 0), 0);
  for (let i = 0; i < 60 * 30; i++)
    far.advance(1 / 60, { ...input, throttle: 0 }, flat);
  assert.ok(
    far.position.y > 1500,
    "while a hand-over from altitude would be a multi-minute fall",
  );
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
