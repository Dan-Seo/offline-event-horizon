import test from "node:test";
import assert from "node:assert/strict";
import {
  CHAPTERS,
  DURATION,
  chapterAt,
  phases,
  seeded,
  QUALITY,
  smooth,
} from "../experience/timeline.ts";

test("the five-minute journey has no unreachable or empty chapters", () => {
  assert.equal(CHAPTERS[0].start, 0);
  assert.equal(CHAPTERS.at(-1)?.end, DURATION);
  for (let i = 0; i < CHAPTERS.length; i++) {
    const c = CHAPTERS[i];
    assert.ok(c.end > c.start);
    assert.equal(chapterAt(c.start), i);
    assert.equal(chapterAt(c.end - 0.001), i);
    if (i) assert.equal(CHAPTERS[i - 1].end, c.start);
  }
  assert.equal(chapterAt(DURATION), 7);
});
test("all morphs remain bounded and continuous across every chapter boundary", () => {
  for (let t = -10; t <= 310; t += 0.125)
    for (const value of Object.values(phases(t)))
      assert.ok(Number.isFinite(value) && value >= 0 && value <= 1);
  for (const c of CHAPTERS) {
    const a = phases(c.start - 0.001),
      b = phases(c.start + 0.001);
    for (const key of Object.keys(a) as (keyof typeof a)[])
      assert.ok(Math.abs(a[key] - b[key]) < 0.001);
  }
  assert.equal(smooth(10, 20, -100), 0);
  assert.equal(smooth(10, 20, 100), 1);
});
test("seeded geometry is reproducible and stays within allocated quality capacity", () => {
  const a = seeded(817),
    b = seeded(817);
  for (let i = 0; i < 1000; i++) {
    const x = a();
    assert.equal(x, b());
    assert.ok(x >= 0 && x < 1);
  }
  let previous = Infinity;
  for (const tier of Object.values(QUALITY)) {
    assert.ok(tier.particles < previous);
    assert.ok(tier.particles <= 180000);
    assert.ok(tier.grass <= 14000);
    previous = tier.particles;
  }
});
