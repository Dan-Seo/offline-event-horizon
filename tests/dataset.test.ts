import test from "node:test";
import assert from "node:assert/strict";
import {
  decodeDataset,
  encodeDataset,
  decodeTar,
  encodeTar,
  type RecordedCapture,
} from "../universe/perception/dataset.ts";
import { identity } from "../universe/perception/math.ts";

test("Sensor dataset preserves synchronized planes, signed floats and camera metadata", () => {
  const frame: RecordedCapture = {
    frame: {
      id: 14,
      timestamp: 1.5,
      rgb: new Uint8Array([1, 23, 255, 255]),
      depth: new Float32Array([137.25]),
      k: {
        width: 1,
        height: 1,
        fx: 10,
        fy: 10,
        cx: 0,
        cy: 0,
        near: 0.2,
        far: 1800,
      },
      condition: "CLEAR",
      seed: 731,
    },
    normals: new Float32Array([-0.25, 0.5, -0.75]),
    labels: new Uint8Array([3]),
    truth: {
      id: 14,
      timestamp: 1.5,
      pose: identity(),
      velocity: [0, 0, 0],
      imu: { acceleration: [0, -9.81, 0], gyro: [0, 0, 0] },
      condition: "CLEAR",
    },
    estimate: {
      pose: identity(),
      delta: null,
      status: "STARTING",
      segment: 0,
      features: 0,
      matched: 0,
      inliers: 0,
      ratio: 0,
      residual: null,
      tracks: [],
    },
  };
  const restored = decodeDataset(encodeDataset([frame], { fixture: "test" }));
  assert.deepEqual(restored.captures, [frame]);
  assert.deepEqual(restored.metadata, { fixture: "test" });
  assert.throws(
    () =>
      decodeDataset(
        encodeDataset([{ ...frame, truth: { ...frame.truth, id: 15 } }], {}),
      ),
    /Unsynchronized/,
  );
});

test("Archive padding, checksum and truncation are checked before replay", () => {
  const entries = [
    { name: "a", bytes: new Uint8Array(513).fill(71) },
    { name: "b", bytes: new Uint8Array([3, 7]) },
  ];
  const tar = encodeTar(entries),
    files = decodeTar(tar);
  assert.equal(tar.length % 512, 0);
  assert.deepEqual(files.get("a"), entries[0].bytes);
  assert.deepEqual(files.get("b"), entries[1].bytes);
  assert.throws(() => decodeTar(tar.slice(0, 1000)), /Truncated/);
  tar[0] ^= 1;
  assert.throws(() => decodeTar(tar), /checksum/);
});
