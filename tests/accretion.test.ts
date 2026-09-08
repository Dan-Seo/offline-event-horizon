import test from "node:test";
import assert from "node:assert/strict";
import { AccretionModel } from "../universe/accretion-model.ts";
test("gas uses fixed-step persistent state independent of render rate", () => {
  const a = new AccretionModel(),
    b = new AccretionModel();
  for (let i = 0; i < 1200; i++) a.update(1 / 60);
  for (let i = 0; i < 600; i++) b.update(1 / 30);
  assert.deepEqual(a.snapshot(), b.snapshot());
  assert.deepEqual(a.streams, b.streams);
  const before = structuredClone(a.streams);
  a.update(0);
  assert.deepEqual(before, a.streams);
});
test("gas shears, changes heat, accretes and remains bounded through repeated disturbances", () => {
  const m = new AccretionModel(),
    initial = m.streams[0].parcels.map((p) => [p.x, p.y]);
  for (let i = 0; i < 60 * 120; i++) m.update(1 / 60);
  assert.ok(m.absorbed > 0);
  assert.ok(m.released >= 5);
  assert.notDeepEqual(
    m.streams[0].parcels.map((p) => [p.x, p.y]),
    initial,
  );
  for (let i = 0; i < 40; i++) m.release(i * 0.8);
  m.update(1 / 30);
  assert.ok(m.snapshot().active <= 384);
  for (const stream of m.streams)
    for (const p of stream.parcels) {
      assert.ok(
        [p.x, p.y, p.vx, p.vy, p.heat, ...p.trail].every(Number.isFinite),
      );
      assert.ok(p.heat >= 0 && p.heat < 5);
    }
});
