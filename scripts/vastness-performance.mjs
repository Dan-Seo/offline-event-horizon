import { chromium, expect } from "@playwright/test";
import fs from "node:fs/promises";
const url = process.env.QA_URL || "http://localhost:4173",
  browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({
  viewport: { width: 2560, height: 1440 },
  deviceScaleFactor: 1,
});
const errors = [],
  runs = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});
await page.addInitScript(() => {
  window.__frames = [];
  let previous = 0;
  function tick(t) {
    if (previous && document.querySelector("main")?.dataset.ready === "true")
      window.__frames.push(t - previous);
    previous = t;
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
});
const start = Date.now();
await page.goto(url + "/?qa=1");
await page.locator("main[data-ready=true]").waitFor({ timeout: 90000 });
const readyMs = Date.now() - start;
const inspect = () => page.evaluate(() => window.__vastness.inspect());
const measure = async (name, ms = 8000) => {
  await page.evaluate(() => (window.__frames = []));
  await page.waitForTimeout(ms);
  const result = await page.evaluate(() => {
    const v = window.__frames.slice(1).sort((a, b) => a - b),
      p = (f) => v[Math.floor(v.length * f)];
    return {
      p50: p(0.5),
      p95: p(0.95),
      p99: p(0.99),
      max: Math.max(...v),
      over50: v.filter((x) => x > 50).length,
      mean: v.reduce((a, b) => a + b, 0) / v.length,
      frames: v.length,
    };
  });
  const state = await inspect();
  delete state.bodies;
  runs.push({ name, frameMs: result, state });
  console.log(name, JSON.stringify(result));
};
await measure("opening-cold", 8000);
await page.keyboard.press("Escape");
for (const name of ["The Wound", "The Cathedral", "The Bloom"]) {
  await page.getByRole("button", { name: "PLACES" }).click();
  await page.getByRole("button", { name: new RegExp(name) }).click();
  await measure("travel-to-" + name, 22000);
}
// Leave the initial stellar region using only real movement and wheel input.
await page.keyboard.press("r");
await page.mouse.move(1200, 680);
await page.keyboard.press("r");
await page.mouse.wheel(0, -4000);
await page.keyboard.down("w");
await page.keyboard.down("Shift");
await measure("procedural-streaming-flight", 18000);
await page.keyboard.up("w");
await page.keyboard.up("Shift");
const streamed = await inspect();
expect(streamed.position[2]).toBeLessThan(-600000);
expect(streamed.sectors).toBe(27);
await page.keyboard.press("r");
await page.keyboard.press("n");
await page.keyboard.down("g");
await measure("creation-and-gravity", 6000);
await page.keyboard.up("g");
const adapter = await page.evaluate(async () => {
  const a = await navigator.gpu?.requestAdapter();
  return a
    ? {
        vendor: a.info.vendor,
        architecture: a.info.architecture,
        description: a.info.description,
      }
    : null;
});
await browser.close();
await fs.mkdir("artifacts", { recursive: true });
const report = {
  url,
  viewport: "2560x1440",
  dpr: 1,
  readyMs,
  adapter,
  runs,
  streamedPosition: streamed.position,
  errors,
};
await fs.writeFile(
  "artifacts/vastness-performance.json",
  JSON.stringify(report, null, 2),
);
console.log(JSON.stringify({ readyMs, errors }, null, 2));
if (errors.length) process.exitCode = 1;
