import test from "node:test";
import assert from "node:assert/strict";
import * as T from "three/webgpu";
import { moduleUrl } from "./helpers/load.ts";

const load = async () =>
  (await import(
    await moduleUrl(new URL("../universe/snapshot.ts", import.meta.url))
  )) as typeof import("../universe/snapshot.ts");
/** A body is only its identity, its place and its size to this module. */
const mk = (id: string, archetype: number, x: number, radius: number) => ({
  id,
  name: id.toUpperCase(),
  position: new T.Vector3(x, 0, 0),
  radius,
  archetype,
});
const at = (x: number) => new T.Vector3(x, 0, 0);

test("an encounter is the body close enough to be met, and never one being travelled to", async () => {
  const { encounterFor } = await load();
  const harbour = mk("harbour", 0, 0, 10);
  // A chosen destination is met from 7.5 radii out; anything else has to be within 1.5.
  assert.equal(encounterFor([harbour], "harbour", at(74), "FREE"), "harbour");
  assert.equal(encounterFor([harbour], "harbour", at(75), "FREE"), "");
  assert.equal(encounterFor([harbour], "other", at(74), "FREE"), "");
  assert.equal(encounterFor([harbour], "other", at(14), "FREE"), "harbour");
  assert.equal(encounterFor([harbour], "other", at(15), "FREE"), "");
  assert.equal(encounterFor([harbour], undefined, at(14), "FREE"), "harbour");
  // The anomaly reaches much further than it is drawn, so both limits widen for it.
  const wound = mk("wound", 3, 0, 10);
  assert.equal(encounterFor([wound], "wound", at(119), "FREE"), "wound");
  assert.equal(encounterFor([wound], "wound", at(120), "FREE"), "");
  assert.equal(encounterFor([wound], "other", at(39), "FREE"), "wound");
  assert.equal(encounterFor([wound], "other", at(40), "FREE"), "");
  // Rings, clouds and sanctuaries are never met, however close the pilot comes.
  for (const archetype of [4, 5, 7])
    assert.equal(
      encounterFor([mk("edge", archetype, 0, 10)], "edge", at(1), "FREE"),
      "",
      `archetype ${archetype} is not an encounter`,
    );
  // ORPHEUS is only met on purpose: it is a walk, not a fly-past.
  const orpheus = mk("orpheus", 0, 0, 10);
  assert.equal(encounterFor([orpheus], "other", at(1), "FREE"), "");
  assert.equal(encounterFor([orpheus], "orpheus", at(1), "FREE"), "orpheus");
  // The selected body wins even when another one is nearer.
  const bodies = [mk("near", 0, 0, 10), mk("far", 0, 200, 10)];
  assert.equal(encounterFor(bodies, "far", at(199), "FREE"), "far");
  assert.equal(encounterFor(bodies, undefined, at(199), "FREE"), "far");
  // Both in range under their own rule: only the selected-first order can answer "far".
  assert.equal(
    encounterFor([mk("near", 0, 0, 10), mk("far", 0, 20, 10)], "far", at(5), "FREE"),
    "far",
  );
  // Travelling is a passage: nothing is met until the flight settles.
  assert.equal(encounterFor([harbour], "harbour", at(0), "TRAVEL"), "");
  assert.equal(encounterFor([harbour], "harbour", at(0), "FREE"), "harbour");
});

test("the nearest reading measures to the surface and ignores the sanctuaries", async () => {
  const { nearestBody } = await load();
  const bodies = [mk("a", 0, 0, 10), mk("b", 0, 100, 20), mk("c", 7, 50, 1)];
  const near = nearestBody(bodies, at(50));
  assert.equal(near.name, "B", "the sanctuary at the observer is skipped");
  assert.equal(near.distance, 30);
  // Inside a body the distance is negative, which is what the HUD wants to say.
  assert.equal(nearestBody(bodies, at(0)).distance, -10);
  assert.equal(nearestBody(bodies, at(0)).name, "A");
  // A tie keeps the first body, so the reading does not flicker between two equals.
  assert.equal(
    nearestBody([mk("first", 0, 0, 10), mk("second", 0, 0, 10)], at(50)).name,
    "FIRST",
  );
  // Nothing to measure leaves no name, so the caller keeps the last one it had.
  assert.deepEqual(nearestBody([], at(0)), { name: undefined, distance: Infinity });
  assert.deepEqual(nearestBody([mk("c", 7, 0, 1)], at(0)), {
    name: undefined,
    distance: Infinity,
  });
});

test("the selection marker stays inside the readable part of the window", async () => {
  const { hudPosition } = await load();
  const projected = (x: number, y: number, z = 0) => new T.Vector3(x, y, z);
  assert.deepEqual(hudPosition(projected(0, 0), 1.6), {
    x: 50,
    y: 50,
    visible: true,
  });
  // Left and right edges: the right-hand clamp is tighter on a portrait window.
  assert.equal(hudPosition(projected(-1, 0), 1.6).x, 10);
  assert.equal(hudPosition(projected(-1, 0), 0.6).x, 10);
  assert.equal(hudPosition(projected(1, 0), 1.6).x, 84);
  assert.equal(hudPosition(projected(1, 0), 0.6).x, 65);
  assert.equal(hudPosition(projected(1, 0), 1).x, 84, "a square window is landscape");
  // Top and bottom edges: the readout and the controls own those bands.
  assert.equal(hudPosition(projected(0, 1), 1.6).y, 14);
  assert.equal(hudPosition(projected(0, -1), 1.6).y, 73);
  // Behind the camera the marker is not shown.
  assert.equal(hudPosition(projected(0, 0, 0.999), 1.6).visible, true);
  assert.equal(hudPosition(projected(0, 0, 1), 1.6).visible, false);
  assert.equal(hudPosition(projected(0, 0, 1.2), 1.6).visible, false);
});
