import test from "node:test";
import assert from "node:assert/strict";
import { seaHeight, seaFloor, signedSeaDepth, submersion, oceanRadialFloor, OCEAN_RADIUS, surfaceTransmission, regionalDomain } from "../universe/ocean-depth.ts";
import { groundHeight, lagoonHeight } from "../universe/walk-ground.ts";

test("curved sea signed depth and continuous immersion", () => {
  for (const [x, z] of [[0, 0], [1000, -2400], [22000, 12000]]) {
    const y = seaHeight(x, z);
    assert.equal(signedSeaDepth(x, y, z), 0);
    assert.equal(signedSeaDepth(x, y - 10, z), 10);
    assert.ok(y - seaFloor(x, z) >= 51 && y - seaFloor(x, z) <= 77);
  }
  assert.equal(submersion(-1), 0); assert.equal(submersion(2), 1);
  assert.equal(submersion(0.75), 0.5);
  assert.ok(submersion(0.001) < 0.00001);
});
test("radial recovery clears sanctuary seabed without blocking water", () => {
  for (const x of [0, 0.05, 0.3, 0.6]) {
    const y = Math.sqrt(1 - x * x);
    const r = oceanRadialFloor(x, y, 0, seaFloor, OCEAN_RADIUS, 3);
    const px = x * (r - 3), py = y * (r - 3) - OCEAN_RADIUS;
    assert.ok(Math.abs(py - seaFloor(px, 0)) < 0.00001);
    assert.ok(py < seaHeight(px, 0) - 40);
  }
});
test("surface transmission hides deep floor but permits shallow sand", () => {
  assert.ok(surfaceTransmission(51, 1) < 0.014);
  assert.ok(surfaceTransmission(77, 1) < 0.002);
  assert.ok(surfaceTransmission(1, 1) > 0.91);
  assert.ok(surfaceTransmission(51, 0.2) < surfaceTransmission(51, 1));
});
test("regional domain excludes the opposite hemisphere and outside lagoon", () => {
  assert.equal(regionalDomain({ x: 0, y: -2.05, z: 0 }), false);
  assert.equal(regionalDomain({ x: 0, y: 0.05, z: 0 }), true);
  assert.equal(regionalDomain({ x: 0.153, y: 0, z: 0 }, 0.152), false);
});
test("Nacre regional floor follows terrain triangles rather than water", () => {
  const r = oceanRadialFloor(0, 1, 0, (x, z) => groundHeight(10, x, z), 1, 0.0001);
  assert.ok(Math.abs(r - 1 - groundHeight(10, 0, 0) - 0.0001) < 1e-12);
  assert.ok(r - 1 < lagoonHeight(0, 0));
});
