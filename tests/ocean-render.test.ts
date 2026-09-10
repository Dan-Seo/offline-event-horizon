import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";
import * as T from "three/webgpu";
import { uniform, vec3 } from "three/tsl";

// In-memory module loading only: actual constructors, no renderer, build or DOM.
const modules = new Map<string, string>();
async function moduleUrl(url: URL): Promise<string> {
  if (modules.has(url.href)) return modules.get(url.href)!;
  let source = ts.transpileModule(await readFile(url, "utf8"), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
  }).outputText;
  for (const match of [...source.matchAll(/from "([^"]+)"/g)]) {
    const specifier = match[1];
    const resolved = specifier.startsWith(".")
      ? await moduleUrl(new URL(specifier.endsWith(".ts") ? specifier : specifier + ".ts", url))
      : import.meta.resolve(specifier);
    source = source.replace(match[0], `from ${JSON.stringify(resolved)}`);
  }
  const result = "data:text/javascript;base64," + Buffer.from(source).toString("base64");
  modules.set(url.href, result); return result;
}
const owned = (name: string) => moduleUrl(new URL(`../universe/${name}.ts`, import.meta.url)).then(u => import(u));

test("MirrorSea actual Float32 triangles agree with recovery, including reported centroid and cap edge", async () => {
  const { MirrorSea } = await owned("sanctuary-water");
  const { renderedSeaFloor, oceanRadialFloor } = await owned("ocean-depth");
  const scene = new T.Scene();
  const air = { time: uniform(0), presence: uniform(1), underwater: uniform(0), radiance: () => vec3(0.1) };
  const sea = new MirrorSea(scene, air);
  scene.updateMatrixWorld(true);
  const mesh = scene.getObjectByName("MirrorSea seabed") as T.Mesh;
  assert.ok(mesh);
  const geometry = mesh.geometry, p = geometry.getAttribute("position"), index = geometry.index!;
  const point = new T.Vector3(), a = new T.Vector3(), b = new T.Vector3(), c = new T.Vector3();
  const origin = new T.Vector3(0, -48000, 0), direction = new T.Vector3();
  const raycaster = new T.Raycaster();
  const { FlightController } = await owned("flight");
  const flight = new FlightController();
  const input = { keys: new Set(), manual: false, wheel: 0, touchMove: new T.Vector2(), look: new T.Vector2(),
    orbit: new T.Vector2(), learning: { speed: 0, look: 0, move: 0 }, consume() {} };
  const body = { id: "orpheus", position: origin, radius: 48000, solid: true, surface: true };
  const indices = [(103 * 192 + 168) * 6, (103 * 192 + 168) * 6 + 3];
  // Both triangle orientations, across the whole northern recovery domain.
  for (let j = 2; j < 110; j += 7) for (let i = 0; i < 192; i += 13)
    indices.push((j * 192 + i) * 6, (j * 192 + i) * 6 + 3);
  for (const k of indices) {
    a.fromBufferAttribute(p, index.getX(k)); b.fromBufferAttribute(p, index.getX(k + 1)); c.fromBufferAttribute(p, index.getX(k + 2));
    point.copy(a).add(b).add(c).divideScalar(3);
    if (Math.hypot(point.x, point.z) > 30000) continue;
    assert.ok(Math.abs(renderedSeaFloor(point.x, point.z) - point.y) < 1e-6, `triangle ${k / 3}`);
    direction.copy(point).sub(origin).normalize();
    const recovery = oceanRadialFloor(direction.x, direction.y, direction.z, renderedSeaFloor, 48000, 3);
    assert.ok(Math.abs(recovery - point.distanceTo(origin) - 3) < 1e-6);
    if (k === indices[0]) {
      flight.position.copy(origin).addScaledVector(direction, point.distanceTo(origin) - 9.166);
      flight.update(1 / 60, input, [body]);
      assert.ok(Math.abs(flight.position.distanceTo(origin) - recovery) < 1e-6);
      console.log("Reported centroid repaired", { rendered: point.toArray(), recovered: flight.position.toArray(), radialClearance: 3 });
    }
  }
  // Independent Three ray/triangle intersections just inside every cap azimuth.
  for (let i = 0; i < 32; i++) {
    const angle = i * Math.PI * 2 / 32;
    point.set(29999.9 * Math.cos(angle), 0, 29999.9 * Math.sin(angle));
    raycaster.set(point, new T.Vector3(0, -1, 0));
    const hit = raycaster.intersectObject(mesh, false)[0]; assert.ok(hit);
    assert.ok(Math.abs(renderedSeaFloor(point.x, point.z) - hit.point.y) < 1e-6,
      `edge ${i}: sampler ${renderedSeaFloor(point.x, point.z)}, mesh ${hit.point.y}`);
    direction.copy(hit.point).sub(origin).normalize();
    const r = oceanRadialFloor(direction.x, direction.y, direction.z, renderedSeaFloor, 48000, 3);
    assert.ok(Math.abs(r - hit.point.distanceTo(origin) - 3) < 1e-6);
  }
  // Conservative global radial-depth bound: closest point over every triangle
  // whose projected disk intersects the recovery cap (includes outside pieces).
  const triangle = new T.Triangle(), closest = new T.Vector3(), projected = new T.Triangle();
  let deepest = 0, witness: number[] = [];
  for (let k = 0; k < index.count; k += 3) {
    a.fromBufferAttribute(p, index.getX(k)); b.fromBufferAttribute(p, index.getX(k + 1)); c.fromBufferAttribute(p, index.getX(k + 2));
    projected.set(new T.Vector3(a.x, 0, a.z), new T.Vector3(b.x, 0, b.z), new T.Vector3(c.x, 0, c.z));
    projected.closestPointToPoint(new T.Vector3(), closest);
    if (closest.length() > 30000) continue;
    triangle.set(a, b, c).closestPointToPoint(origin, closest);
    const depth = 48000 - closest.distanceTo(origin);
    if (depth > deepest) { deepest = depth; witness = closest.toArray(); }
  }
  console.log("Rendered seabed radial-depth upper bound", deepest, "witness", witness);
  assert.ok(deepest < 82, `Underlay needs more than ${deepest} radial units plus margin`);
  // Water/floor correspondence is taken from these exact mesh vertices.
  const water = sea.mesh.geometry;
  assert.equal(water.attributes.waterColumn.count, p.count);
  for (let i = 0; i < p.count; i += 29)
    assert.ok(Math.abs(water.attributes.waterColumn.getX(i) - (water.attributes.position.getY(i) - p.getY(i))) < 1e-5);
  sea.dispose();
});

test("actual Nacre approach rejects southern observer and clears stale regional water", async () => {
  const { PlanetApproaches } = await owned("approaches");
  const scene = new T.Scene(), object = new T.Group(); scene.add(object);
  const body = { id: "nacre", archetype: 10, radius: 21000, position: new T.Vector3(500, 800, -1200), object, approachUp: undefined as T.Vector3 | undefined };
  const approaches = new PlanetApproaches(scene, [body], { create: () => new T.Group() });
  const up = body.approachUp as T.Vector3;
  assert.ok(up);
  approaches.update(body.position.clone().addScaledVector(up, 1.01 * body.radius), 0, 0);
  assert.equal(approaches.active, "nacre");
  assert.ok(approaches.inspectOcean()?.signedDepth > 0);
  approaches.update(body.position.clone().addScaledVector(up, -1.05 * body.radius), 1, 0);
  assert.equal(approaches.active, "");
  assert.equal(approaches.inspectOcean(), undefined);
  const region = approaches.regions[0];
  assert.equal(region.root.visible, false);
  assert.equal(region.lagoon.inspect().signedDepth, 0);
  assert.equal(region.lagoon.inspect().submersion, 0);
  assert.equal(region.lagoon.inspect().ecosystem.visible, false);
  approaches.dispose();
});

test("ocean grass uses tapered curved blades and bounded clustered instances", async () => {
  const { OceanLife } = await owned("ocean-life");
  const life = new OceanLife(new T.Group(), uniform(0), () => -64, () => 0, 1600, 1, false);
  const grass = life.meshes[1] as T.InstancedMesh;
  const p = grass.geometry.attributes.position;
  const tip: number[] = [], base: number[] = [];
  for (let i = 0; i < p.count; i++) {
    if (p.getY(i) === 1) { tip.push(p.getX(i)); assert.ok(p.getZ(i) > 0.4); }
    if (p.getY(i) === 0) base.push(p.getX(i));
  }
  assert.ok(Math.max(...tip) - Math.min(...tip) < 1e-6);
  assert.ok(Math.max(...base) - Math.min(...base) > 0.9);
  assert.equal(grass.count, 700);
  life.setQuality("BATTERY"); assert.equal(grass.count, 210);
  life.dispose();
});
