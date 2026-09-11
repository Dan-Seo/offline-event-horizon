import test from "node:test";
import assert from "node:assert/strict";
import * as T from "three/webgpu";
import { groundHeight, lagoonHeight } from "../universe/walk-ground.ts";
import { terrainHeight } from "../universe/approach-terrain.ts";
import { SurfaceWalker, type WalkSurface } from "../universe/walk.ts";
import type { FlightController } from "../universe/flight.ts";
import type { InputManager } from "../universe/input.ts";

test("grounded height agrees with ray intersections of the actual terrain triangles", () => {
  const geometry = new T.PlaneGeometry(0.62, 0.62, 100, 100),
    p = geometry.getAttribute("position");
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i),
      z = p.getY(i);
    p.setXYZ(
      i,
      x,
      Math.sqrt(1 - x * x - z * z) - 1 + terrainHeight(10, x, z),
      z,
    );
  }
  geometry.setIndex(Array.from(geometry.index!.array).reverse());
  const mesh = new T.Mesh(
    geometry,
    new T.MeshBasicMaterial({ side: T.DoubleSide }),
  );
  mesh.updateMatrixWorld();
  const ray = new T.Raycaster(new T.Vector3(), new T.Vector3(0, -1, 0));
  for (let i = 1; i <= 300; i++) {
    const x = Math.sin(i * 17.19) * 0.5 * 0.58,
      z = Math.cos(i * 38.73) * 0.29;
    ray.ray.origin.set(x, 1, z);
    const hit = ray.intersectObject(mesh)[0];
    assert.ok(hit);
    const visible = Math.max(hit.point.y, Math.sqrt(1 - x * x - z * z) - 1);
    assert.ok(Math.abs(visible - groundHeight(10, x, z)) < 3e-8);
  }
  geometry.dispose();
  mesh.material.dispose();
});
function setup() {
  const surface: WalkSurface = {
    id: "nacre",
    radius: 21000,
    center: new T.Vector3(),
    frame: new T.Quaternion(),
    up: new T.Vector3(0, 1, 0),
    height: (x, z) => groundHeight(10, x, z),
    water: lagoonHeight,
  };
  const flight = {
    position: new T.Vector3(
      0,
      (1 + groundHeight(10, 0, 0.165)) * 21000 + 1.8,
      0.165 * 21000,
    ),
    velocity: new T.Vector3(),
    quaternion: new T.Quaternion(),
    sensitivity: 1,
    gentle: false,
    quiet: false,
    speed: 0,
    cancel() {},
  } as unknown as FlightController;
  const input = {
    keys: new Set<string>(),
    look: new T.Vector2(),
    touchMove: new T.Vector2(),
    wheel: 0,
    learning: { look: 0, move: 0, speed: 0 },
    consume(this: { look: T.Vector2; wheel: number }) {
      this.look.set(0, 0);
      this.wheel = 0;
    },
  } as unknown as InputManager;
  const walker = new SurfaceWalker();
  assert.ok(walker.start(surface, flight));
  return { walker, surface, flight, input };
}
test("walking follows ground, caps diagonal speed, and settles at human eye height", () => {
  const a = setup(),
    b = setup();
  a.input.keys.add("KeyW");
  b.input.keys.add("KeyW");
  b.input.keys.add("KeyD");
  for (let i = 0; i < 180; i++) {
    a.walker.update(1 / 60, a.input, a.flight);
    b.walker.update(1 / 60, b.input, b.flight);
  }
  assert.ok(Math.abs(a.walker.distance - b.walker.distance) < 0.01);
  b.input.keys.clear();
  for (let i = 0; i < 180; i++) b.walker.update(1 / 60, b.input, b.flight);
  const p = b.walker.localPosition(b.surface, b.flight.position);
  assert.ok(Math.abs((p.y - groundHeight(10, p.x, p.z)) * 21000 - 1.8) < 1e-7);
  assert.ok(b.flight.velocity.length() < 0.001);
});
test("holding jump produces one small hop and lands; deep water blocks walking", () => {
  const s = setup();
  s.input.keys.add("Space");
  let peak = 0;
  for (let i = 0; i < 180; i++) {
    s.walker.update(1 / 60, s.input, s.flight);
    const p = s.walker.localPosition(s.surface, s.flight.position);
    peak = Math.max(peak, (p.y - s.surface.height(p.x, p.z)) * 21000 - 1.8);
  }
  assert.ok(peak > 0.8 && peak < 1.2);
  assert.ok(s.flight.velocity.length() < 0.001);
  s.input.keys.clear();
  s.input.keys.add("KeyW");
  s.input.keys.add("ShiftLeft");
  for (let i = 0; i < 60 * 180; i++) s.walker.update(1 / 60, s.input, s.flight);
  const p = s.walker.localPosition(s.surface, s.flight.position);
  assert.ok(
    (lagoonHeight(p.x, p.z) - groundHeight(10, p.x, p.z)) * 21000 <= 0.701,
  );
  assert.ok(s.flight.position.toArray().every(Number.isFinite));
});
test("a zero-length frame leaves walking velocity and position finite", () => {
  const s = setup();
  s.input.keys.add("KeyW");
  for (let i = 0; i < 60; i++) s.walker.update(1 / 60, s.input, s.flight);
  const before = s.flight.position.toArray();
  // Two animation callbacks with the same timestamp: dt is zero.
  s.walker.update(0, s.input, s.flight);
  assert.deepEqual(s.flight.position.toArray(), before);
  assert.ok(s.flight.velocity.toArray().every(Number.isFinite));
  assert.equal(s.flight.velocity.length(), 0);
  s.walker.update(1 / 60, s.input, s.flight);
  assert.ok(s.flight.velocity.length() > 0);
  assert.ok(s.flight.position.toArray().every(Number.isFinite));
});
