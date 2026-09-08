import test from "node:test";
import assert from "node:assert/strict";
import {
  GR,
  freefallRadius,
  remainingProperTime,
  radialLightSlopes,
  tidalEigenvalues,
  infallerRay,
  rayInvariant,
  stepNullRay,
  traceNullRay,
  diskFrequencyShift,
  length3,
  type NullRay,
} from "../universe/relativity-model.ts";

test("E=1 radial infall crosses the horizon in finite, continuous proper time", () => {
  const start = 6,
    horizonTime = remainingProperTime(start) - remainingProperTime(1);
  assert.ok(Math.abs(freefallRadius(start, horizonTime) - 1) < 1e-12);
  assert.ok(freefallRadius(start, horizonTime - 0.001) > 1);
  assert.ok(freefallRadius(start, horizonTime + 0.001) < 1);
  assert.ok(Math.abs(remainingProperTime(1) - 2 / 3) < 1e-12);
  for (const r of [6, 1.1, 1, 0.8, 0.2]) {
    const epsilon = 1e-6;
    const derivative = (freefallRadius(r, epsilon) - r) / epsilon;
    assert.ok(Math.abs(derivative + 1 / Math.sqrt(r)) < 2e-5);
  }
});
test("future outgoing light becomes inward inside; tides are trace-free", () => {
  assert.ok(radialLightSlopes(2).outward > 0);
  assert.equal(radialLightSlopes(1).outward, 0);
  assert.ok(radialLightSlopes(0.8).outward < 0);
  for (const r of [2, 1, 0.2]) {
    const tides = tidalEigenvalues(r);
    assert.equal(
      tides.reduce((a, b) => a + b, 0),
      0,
    );
    assert.ok(tides[0] > 0 && tides[1] < 0);
  }
});
test("infalling tetrad initializes null rays on both sides of the horizon", () => {
  for (const r of [10, 1.001, 1, 0.999, 0.2])
    for (let i = 0; i < 37; i++) {
      const a = (i / 36) * Math.PI;
      const ray = infallerRay(r, [0, 0, 1], [Math.sin(a), 0, Math.cos(a)]);
      assert.ok(Math.abs(rayInvariant(ray) - ray.energy ** 2) < 1e-12);
      if (r < 1)
        assert.ok(
          ray.v[2] > 0,
          "past-directed rays initially move outward inside",
        );
    }
});
test("photon sphere remains a circular null orbit and critical b=3sqrt(3)/2", () => {
  const ray: NullRay = {
    p: [1.5, 0, 0],
    v: [0, 1, 0],
    energy: -Math.sqrt(1 / 3),
    angular: [0, 0, 1.5],
    l2: 2.25,
  };
  assert.ok(
    Math.abs(Math.sqrt(ray.l2) / Math.abs(ray.energy) - GR.criticalImpact) <
      1e-12,
  );
  for (let i = 0; i < 1600; i++) stepNullRay(ray, 0.004);
  assert.ok(Math.abs(length3(ray.p) - 1.5) < 2e-9);
});
test("escaped rays conserve Killing energy at display resolution and converge with refinement", () => {
  let cases = 0;
  for (const r of [6, 1.001, 1, 0.999, 0.8, 0.2])
    for (let i = 0; i < 61; i++) {
      const a = (i / 60) * Math.PI;
      const ray = infallerRay(r, [0, 0, 1], [Math.sin(a), 0, Math.cos(a)]);
      const fine = infallerRay(r, [0, 0, 1], [Math.sin(a), 0, Math.cos(a)]);
      const result = traceNullRay(ray),
        reference = traceNullRay(fine, GR.step / 4, 2400);
      assert.equal(result.escaped, reference.escaped);
      if (!result.escaped) continue;
      cases++;
      const error =
        Math.abs(rayInvariant(ray) - ray.energy ** 2) /
        Math.max(1, ray.energy ** 2);
      assert.ok(error < 0.00025, `${r} ${a}: invariant error ${error}`);
      const alignment =
        ray.v.reduce((s, v, axis) => s + v * fine.v[axis], 0) /
        (length3(ray.v) * length3(fine.v));
      assert.ok(
        alignment > Math.cos(0.002),
        `ray direction converges within 0.12 degrees: ${alignment}`,
      );
    }
  assert.ok(cases > 240);
});
test("outside light remains visible inside; horizon does not extinguish the sky", () => {
  for (const r of [1.001, 1, 0.999, 0.8, 0.2]) {
    const outward = traceNullRay(infallerRay(r, [0, 0, 1], [0, 0, 1]));
    assert.ok(outward.escaped);
    assert.ok(Math.abs(outward.ray.energy + 1 + Math.sqrt(1 / r)) < 1e-12);
  }
});
test("Keplerian disk frequency combines gravitational and kinematic shift", () => {
  assert.equal(diskFrequencyShift(6, -1, 0), Math.sqrt(0.75));
  assert.ok(diskFrequencyShift(6, -1, -2) > diskFrequencyShift(6, -1, 2));
});
