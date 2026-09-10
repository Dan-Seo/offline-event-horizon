import test from "node:test";
import assert from "node:assert/strict";
import { OCEAN_CAP, satellitePosition, stellarImages } from "../universe/cosmic-motion.ts";

test("ocean recess covers the world-north seabed without rotating the contact frame", () => {
  const [, y, z] = OCEAN_CAP.localNorth;
  assert.ok(Math.abs(y * Math.cos(0.5) - z * Math.sin(0.5) - 1) < 1e-14);
  assert.ok(Math.abs(y * Math.sin(0.5) + z * Math.cos(0.5)) < 1e-14);
  const floorRadius = OCEAN_CAP.radius * OCEAN_CAP.scale * (1 - OCEAN_CAP.extraRecess / OCEAN_CAP.radius);
  assert.ok(OCEAN_CAP.radius - floorRadius >= 82);
  assert.ok(Math.abs(OCEAN_CAP.radius * Math.sqrt(1 - OCEAN_CAP.fullNorthCosine ** 2) - 30000) < 1e-9);
  assert.ok(OCEAN_CAP.outerNorthCosine < OCEAN_CAP.fullNorthCosine);
});

test("decorative satellites stay bounded, move visibly, and replay deterministically", () => {
  for (let i = 0; i < 3; i++) {
    const start = satellitePosition(0, i, { x: 0, y: 0, z: 0 });
    const moved = satellitePosition(10, i, { x: 0, y: 0, z: 0 });
    assert.ok(Math.hypot(moved.x - start.x, moved.y - start.y, moved.z - start.z) > 1);
    for (const t of [0, 10, 1e5, 1e9, NaN, Infinity]) {
      const a = satellitePosition(t, i, { x: 0, y: 0, z: 0 });
      assert.ok(Math.abs(Math.hypot(a.x, a.y, a.z) - (3.05 + i * 0.72)) < 1e-12);
      assert.deepEqual(a, satellitePosition(t, i, { x: 0, y: 0, z: 0 }));
    }
  }
});

test("thin-lens image roots have opposite parity and satisfy the lens equation", () => {
  for (const beta of [0, 1e-8, 0.1, 1, 5, 1e6]) {
    const { positive, negative } = stellarImages(beta);
    assert.ok(positive > 0 && negative < 0);
    assert.ok(Math.abs(positive * negative + 1) < 1e-14);
    for (const theta of [positive, negative])
      assert.ok(Math.abs(theta - 1 / theta - beta) < 1e-9);
  }
  assert.deepEqual(stellarImages(NaN), { positive: 1, negative: -1 });
});
