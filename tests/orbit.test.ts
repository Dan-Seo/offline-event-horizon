import test from "node:test";
import assert from "node:assert/strict";
import { OrbitModel, ORBIT_MU } from "../universe/orbit-model.ts";
import { copy, preferredLanguage } from "../universe/language.ts";
function advance(model: OrbitModel, seconds: number, dt = 1 / 60) {
  for (let i = 0; i < Math.round(seconds / dt); i++) model.advance(dt);
}
function energy(model: OrbitModel) {
  const p = model.positions,
    v = model.velocities;
  return (
    (v[0] ** 2 + v[1] ** 2 + v[2] ** 2) / 2 -
    (ORBIT_MU * model.gravity) /
      Math.sqrt(p[0] ** 2 + p[1] ** 2 + p[2] ** 2 + 0.025)
  );
}
test("circular release remains bound with low energy drift for 90 simulated seconds", () => {
  const model = new OrbitModel();
  model.release("orbit");
  const initial = energy(model);
  advance(model, 90);
  assert.equal(model.snapshot().active, 48);
  assert.ok(Math.abs((energy(model) - initial) / initial) < 0.0001);
  assert.ok(Math.abs(Math.hypot(...model.positions.slice(0, 3)) - 3.25) < 0.15);
});
test("low angular momentum is captured while super-escape release leaves the domain", () => {
  const fall = new OrbitModel(),
    escape = new OrbitModel();
  fall.release("fall");
  escape.release("escape");
  advance(fall, 12);
  advance(escape, 35);
  assert.equal(fall.absorbed, 48);
  assert.equal(fall.snapshot().active, 0);
  assert.equal(escape.escaped, 48);
  assert.equal(escape.absorbed, 0);
});
test("fixed steps give the same trajectories at 30 and 120 render Hz", () => {
  const a = new OrbitModel(),
    b = new OrbitModel();
  a.release("orbit");
  b.release("orbit");
  advance(a, 8, 1 / 30);
  advance(b, 8, 1 / 120);
  assert.deepEqual(a.positions, b.positions);
  assert.deepEqual(a.velocities, b.velocities);
});
test("pause is exact, gravity changes existing trajectories, and input values remain finite", () => {
  const a = new OrbitModel(),
    b = new OrbitModel();
  a.release("orbit");
  b.release("orbit");
  const before = a.positions.slice();
  a.advance(0);
  a.advance(Number.NaN);
  assert.deepEqual(a.positions, before);
  a.setGravity(2);
  advance(a, 8);
  advance(b, 8);
  assert.ok(Math.abs(a.positions[0] - b.positions[0]) > 0.1);
  a.setGravity(Infinity);
  assert.equal(a.gravity, 2);
  a.setGravity(-100);
  assert.equal(a.gravity, 0.4);
  assert.ok(a.positions.every(Number.isFinite));
});
test("repeated releases have bounded state and clear removes every live tracer", () => {
  const model = new OrbitModel();
  for (let i = 0; i < 50; i++) model.release("orbit");
  assert.equal(model.snapshot().active, model.capacity);
  model.clear();
  assert.equal(model.snapshot().active, 0);
  assert.equal(model.launched, 0);
  model.release("fall");
  advance(model, 12);
  assert.equal(model.absorbed, 48);
});
test("saved language takes precedence, Korean browser variants work, unknown languages fall back", () => {
  assert.equal(preferredLanguage("en", ["ko-KR"]), "en");
  assert.equal(preferredLanguage(null, ["ko-KR", "en"]), "ko");
  assert.equal(preferredLanguage("invalid", ["fr-FR"]), "en");
  assert.equal(preferredLanguage(null, []), "en");
});

// Every string in the copy, addressed by its full path. Arrays contribute their indices, so a
// list that lost an entry in one language shows up as a missing path rather than a short read.
const strings = (value: unknown, path = ""): [string, unknown][] =>
  value && typeof value === "object"
    ? Object.entries(value).flatMap(([key, child]) =>
        strings(child, path ? `${path}.${key}` : key),
      )
    : [[path, value]];

test("Korean copy covers every English key that the overlay renders", () => {
  const en = strings(copy.en),
    ko = strings(copy.ko);
  assert.deepEqual(
    ko.map(([path]) => path).sort(),
    en.map(([path]) => path).sort(),
  );
  for (const [path, value] of [...en, ...ko])
    assert.ok(typeof value === "string" && value.trim().length > 0, path);
  assert.equal(copy.en.controls.length, copy.ko.controls.length);
  // Strings that moved out of components/*.tsx keep their exact wording.
  assert.equal(copy.en.carry, "Carry me somewhere");
  assert.equal(copy.ko.carry, "어디든 데려다줘");
  assert.equal(copy.ko.walkSeed, "빛 한 점 남기기");
  assert.notEqual(copy.ko.walkSeed, copy.ko.seed);
});
