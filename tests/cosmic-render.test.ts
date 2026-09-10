import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";
import * as T from "three/webgpu";

// Transpile owned rendering modules and their imports in memory. No DOM/GPU or files.
const modules = new Map<string, string>();
async function moduleUrl(url: URL): Promise<string> {
  if (modules.has(url.href)) return modules.get(url.href)!;
  let source = ts.transpileModule(await readFile(url, "utf8"), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
  }).outputText;
  for (const match of [...source.matchAll(/from "([^"]+)"/g)]) {
    const specifier = match[1];
    const resolved = specifier.startsWith(".")
      ? await moduleUrl(new URL(specifier + ".ts", url)) : import.meta.resolve(specifier);
    source = source.replace(match[0], `from ${JSON.stringify(resolved)}`);
  }
  const result = "data:text/javascript;base64," + Buffer.from(source).toString("base64");
  modules.set(url.href, result);
  return result;
}

test("actual cosmic lifecycle freezes, bounds geometry, and leaves planet transforms alone", async () => {
  const { PlanetLibrary } = await import(await moduleUrl(new URL("../universe/planets.ts", import.meta.url)));
  const { GravitationalAnomaly } = await import(await moduleUrl(new URL("../universe/anomaly.ts", import.meta.url)));
  const library = new PlanetLibrary();
  const planet = library.create(10);
  const initial = planet.quaternion.toArray();
  library.time.value = 10;
  library.update(planet, 5);
  const moons = planet.userData.cosmicMoons;
  const positions = moons.children.map((m: T.Object3D) => m.position.toArray());
  library.update(planet, 5);
  assert.deepEqual(moons.children.map((m: T.Object3D) => m.position.toArray()), positions);
  assert.deepEqual(planet.quaternion.toArray(), initial);
  library.setQuality("BATTERY"); library.update(planet, 5);
  assert.equal(moons.children.filter((m: T.Object3D) => m.visible).length, 1);
  const anomaly = new GravitationalAnomaly();
  const arrivalDirection = new T.Vector3(-190000, -85000, -230000).normalize();
  const diskNormal = new T.Vector3(0, 0, 1).applyQuaternion(anomaly.diskRotation);
  const normalArrivalCosine = Math.abs(diskNormal.dot(arrivalDirection));
  assert.ok(normalArrivalCosine > 0.10 && normalArrivalCosine < 0.22,
    "normal arrival must show a thin, grazing disk rather than a face-on target");
  const camera = new T.PerspectiveCamera();
  camera.position.set(3, 2, 10); camera.lookAt(0, 0, 0);
  anomaly.update(10, camera); anomaly.simulate(1 / 60);
  const snapshot = anomaly.inspect();
  for (let i = 0; i < 20; i++) { anomaly.update(10, camera); anomaly.simulate(0); }
  assert.deepEqual(anomaly.inspect(), snapshot);
  for (let i = 0; i < 120; i++) {
    camera.position.set(Math.sin(i) * 10, Math.cos(i) * 10, 10); camera.lookAt(0, 0, 0);
    anomaly.update(i / 60, camera); anomaly.simulate(1 / 60);
    assert.ok(anomaly.inspect().stellarImages <= 192);
    anomaly.group.traverse((o: T.Object3D) => {
      assert.ok(o.position.toArray().every(Number.isFinite));
      if (o instanceof T.Points || o instanceof T.LineSegments)
        assert.ok(Array.from(o.geometry.attributes.position.array).every(Number.isFinite));
    });
  }
});
