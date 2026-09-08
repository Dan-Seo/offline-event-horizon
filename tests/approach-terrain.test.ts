import test from "node:test";
import assert from "node:assert/strict";
import {
  terrainHeight,
  terrainClearance,
} from "../universe/approach-terrain.ts";

test("regional collision rays stay above rendered terrain and liquid surfaces", () => {
  for (const kind of [1, 2, 6, 9, 10])
    for (let i = 0; i <= 40; i++)
      for (let j = 0; j <= 40; j++) {
        const x = (i / 40 - 0.5) * 0.58,
          z = (j / 40 - 0.5) * 0.58;
        const water =
          kind === 10 && Math.hypot(x, z) < 0.152
            ? 0.021
            : kind === 6 && Math.hypot(x, z) < 0.093
              ? 0.024
              : -1;
        const y =
          Math.sqrt(1 - x * x - z * z) +
          Math.max(terrainHeight(kind, x, z), water);
        const r = Math.hypot(x, y, z);
        const floor = terrainClearance(kind, x / r, y / r, z / r);
        assert.ok(
          Number.isFinite(floor) && floor > r,
          `${kind}: clearance penetrates cap at ${x},${z}`,
        );
      }
});
test("regional cap rims sink beneath the parent globe instead of exposing a square wall", () => {
  for (const kind of [1, 2, 6, 9, 10])
    for (let i = 0; i <= 20; i++) {
      const z = (i / 20 - 0.5) * 0.62;
      assert.ok(terrainHeight(kind, 0.31, z) < 0);
      assert.ok(terrainHeight(kind, -0.31, z) < 0);
    }
});
