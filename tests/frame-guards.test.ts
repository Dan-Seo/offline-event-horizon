import test from "node:test";
import assert from "node:assert/strict";
import { moduleUrl } from "./helpers/load.ts";
import * as T from "three/webgpu";

const owned = (name: string) =>
  moduleUrl(new URL(`../universe/${name}.ts`, import.meta.url)).then((u) => import(u));

test("a repeated animation-frame timestamp never poisons flight orientation", async () => {
  const { FlightController } = await owned("flight");
  const flight = new FlightController();
  const input = {
    keys: new Set<string>(), manual: false, wheel: 0,
    touchMove: new T.Vector2(), look: new T.Vector2(), orbit: new T.Vector2(),
    learning: { speed: 0, look: 0, move: 0 },
    consume(this: { look: T.Vector2; wheel: number }) { this.look.set(0, 0); this.wheel = 0; },
  };
  input.look.set(40, -25);
  flight.update(1 / 60, input, []);
  const turned = flight.quaternion.toArray();
  // Two callbacks with the same timestamp: dt is zero, so nothing may divide by it.
  input.look.set(40, -25);
  flight.update(0, input, []);
  assert.ok(flight.angular.toArray().every(Number.isFinite));
  assert.ok(flight.quaternion.toArray().every(Number.isFinite));
  assert.deepEqual(flight.quaternion.toArray(), turned);
  // The next real frame still turns, from the look that the zero frame kept pending.
  input.look.set(0, 0);
  flight.update(1 / 60, input, []);
  assert.ok(flight.quaternion.toArray().every(Number.isFinite));
  assert.notDeepEqual(flight.quaternion.toArray(), turned);
});

test("evicting a sector never deletes a body that has already left the list", async () => {
  const { UniverseWorld } = await owned("world");
  const { SECTOR_SIZE } = await owned("coordinates");
  const scene = new T.Scene();
  const world = new UniverseWorld(scene, false);
  const observer = new T.Vector3();
  world.update(observer, 0);
  const named = (b: { id: string }) =>
    !b.id.startsWith("sector-") && !b.id.startsWith("cloud-");
  const streamed = world.bodies.filter((b: { id: string }) => !named(b));
  assert.ok(streamed.length > 0);
  const fixed = world.bodies.filter(named).map((b: { id: string }) => b.id);
  assert.ok(fixed.includes("wound"));
  // A streamed body that is no longer in the list: indexOf reports -1, which
  // splice reads as "the last one" and deletes a body nobody asked to evict.
  world.bodies.splice(world.bodies.indexOf(streamed[0]), 1);
  world.update(observer.set(SECTOR_SIZE * 9, 0, 0), 0);
  const live = [...world.sectorMap.values()].flatMap(
    (s: { bodies: unknown[] }) => s.bodies,
  );
  assert.deepEqual(world.bodies.filter(named).map((b: { id: string }) => b.id), fixed);
  assert.deepEqual(world.bodies.filter((b: { id: string }) => !named(b)), live);
});
