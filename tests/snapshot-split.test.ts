import test from "node:test";
import assert from "node:assert/strict";
import {
  changedOutsideLive,
  initialSnapshot,
  LIVE_KEYS,
} from "../universe/state.ts";

// Every report carries the same shape, so a snapshot is the initial one with fields replaced.
const next = (over: Partial<typeof initialSnapshot>) => ({
  ...initialSnapshot,
  ...over,
});

test("Only a change outside the live keys is news to anything but the readouts", () => {
  assert.equal(changedOutsideLive(initialSnapshot, next({})), false);
  // Every live key at once, including the two objects the engine rebuilds each snapshot.
  const readouts = next({
    fps: 61,
    frameMs: 16.4,
    drawCalls: 812,
    triangles: 1_240_000,
    particles: 40,
    velocity: 12.5,
    distance: 88,
    sectors: 9,
    selectionX: 40,
    selectionY: 55,
    selectionVisible: true,
    time: 91.2,
    learning: { look: 3, move: 12, speed: 0.5 },
    gas: { active: 2, released: 1, absorbed: 4, time: 77 },
  });
  assert.equal(changedOutsideLive(initialSnapshot, readouts), false);
  assert.equal(changedOutsideLive(initialSnapshot, next({ paused: true })), true);
  assert.equal(
    changedOutsideLive(initialSnapshot, next({ nearest: "THE SILENT GIANT" })),
    true,
  );
  // A live change riding along with a real one is still a real one.
  assert.equal(
    changedOutsideLive(initialSnapshot, next({ fps: 30, quality: "BATTERY" })),
    true,
  );
});

test("Rebuilt nested snapshots count as a change only when a number inside them moved", () => {
  for (const key of ["experiment", "relativity"] as const) {
    const same = next({ [key]: { ...initialSnapshot[key] } });
    assert.notEqual(same[key], initialSnapshot[key]);
    assert.equal(
      changedOutsideLive(initialSnapshot, same),
      false,
      `${key} rebuilt with the same values`,
    );
  }
  assert.equal(
    changedOutsideLive(
      initialSnapshot,
      next({ experiment: { ...initialSnapshot.experiment, active: 1 } }),
    ),
    true,
  );
  assert.equal(
    changedOutsideLive(
      initialSnapshot,
      next({ relativity: { ...initialSnapshot.relativity, properTime: 4 } }),
    ),
    true,
  );
});

test("The live list names real keys and keeps the ones components read out of it", () => {
  for (const key of LIVE_KEYS) assert.ok(key in initialSnapshot, key);
  assert.equal(new Set(LIVE_KEYS).size, LIVE_KEYS.length);
  // Fields a component reads for something other than a readout have to reach the full state.
  for (const key of [
    "ready",
    "paused",
    "mode",
    "encounter",
    "pilgrimAvailable",
    "relativity",
    "experiment",
  ])
    assert.ok(!(LIVE_KEYS as readonly string[]).includes(key), key);
});
