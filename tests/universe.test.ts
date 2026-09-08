import test from "node:test";
import assert from "node:assert/strict";
import { Vector3, Object3D } from "three/webgpu";
import {
  mappedDistance,
  placeRelative,
  LOCAL_DOMAIN,
} from "../universe/coordinates.ts";
import { seeded, sectorSeed } from "../universe/config.ts";
test("far distance mapping is continuous, monotonic, and preserves angular size", () => {
  assert.equal(mappedDistance(LOCAL_DOMAIN), LOCAL_DOMAIN);
  assert.ok(
    Math.abs(mappedDistance(LOCAL_DOMAIN + 1) - LOCAL_DOMAIN - 1) < 0.00001,
  );
  let previous = 0;
  for (const d of [1, 100, 250000, 1e6, 1e9, 1e13]) {
    const object = new Object3D(),
      radius = 40;
    placeRelative(object, new Vector3(d, 0, 0), new Vector3(), radius);
    assert.ok(object.position.length() > previous);
    previous = object.position.length();
    assert.ok(
      Math.abs(object.scale.x / object.position.length() - radius / d) < 1e-9,
    );
    assert.ok(Number.isFinite(object.matrixWorld.elements[0]));
  }
});
test("floating origin retains a meter of local detail trillions of units away", () => {
  const object = new Object3D(),
    observer = new Vector3(1e12, -1e12, 1e12);
  placeRelative(
    object,
    observer.clone().add(new Vector3(1, 2, 3)),
    observer,
    5,
  );
  assert.deepEqual(object.position.toArray(), [1, 2, 3]);
  assert.equal(object.scale.x, 5);
});
test("regenerated sectors reproduce deterministic distinct populations", () => {
  const samples = (x: number, y: number, z: number) => {
    const random = seeded(sectorSeed(x, y, z));
    return Array.from({ length: 12 }, () => random());
  };
  assert.deepEqual(samples(-41, 7, 220), samples(-41, 7, 220));
  assert.notDeepEqual(samples(-41, 7, 220), samples(-40, 7, 220));
  assert.notDeepEqual(samples(-41, 7, 220), samples(41, 7, 220));
});
