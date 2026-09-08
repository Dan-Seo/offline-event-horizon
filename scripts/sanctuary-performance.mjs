import { chromium, expect } from "@playwright/test";
import fs from "node:fs/promises";
const url = process.env.QA_URL || "http://localhost:4173";
const browser = await chromium.launch({ channel: "chrome", headless: true });
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
  let last = 0;
  const tick = (t) => {
    if (last && document.querySelector("main")?.dataset.ready === "true")
      window.__frames.push(t - last);
    last = t;
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
});
const get = () => page.evaluate(() => window.__vastness.inspect());
const measure = async (name, ms) => {
  await page.evaluate(() => (window.__frames = []));
  await page.waitForTimeout(ms);
  const frameMs = await page.evaluate(() => {
    const v = window.__frames.slice(1).sort((a, b) => a - b),
      p = (q) => v[Math.floor(v.length * q)];
    return {
      p50: p(0.5),
      p95: p(0.95),
      p99: p(0.99),
      max: v.at(-1),
      over50: v.filter((x) => x > 50).length,
      mean: v.reduce((a, b) => a + b, 0) / v.length,
      frames: v.length,
    };
  });
  const s = await get();
  delete s.bodies;
  runs.push({ name, frameMs, state: s });
  console.log(name, JSON.stringify(frameMs));
};
const visit = async (name, further = false) => {
  await page.keyboard.press("Escape");
  await page
    .getByRole("button", { name: "Comfort settings", exact: true })
    .click();
  await page.getByRole("button", { name: /Find somewhere quiet/ }).click();
  if (further)
    await page
      .getByRole("button", { name: "Beyond this world", exact: true })
      .click();
  await page.getByRole("button", { name: new RegExp("^" + name) }).click();
};
let readyMs, adapter;
try {
  const start = Date.now();
  await page.goto(url + "/?qa=1");
  await page.locator("main[data-ready=true]").waitFor({ timeout: 120000 });
  readyMs = Date.now() - start;
  await measure("opening-cold", 8000);
  await visit("The Breathing Forest");
  await measure("water-to-forest-flight", 26000);
  await measure("forest-stillness", 12000);
  await page.screenshot({ path: "artifacts/sanctuary-performance-forest.png" });
  await visit("The Veil");
  await measure("cloud-garden-flight", 26000);
  await measure("inside-clouds", 8000);
  await page.screenshot({ path: "artifacts/sanctuary-performance-veil.png" });
  await visit("The Wound", true);
  await measure("surface-to-space-and-anomaly", 26000);
  await page.screenshot({ path: "artifacts/sanctuary-performance-wound.png" });
  await page.keyboard.press("r");
  await page.mouse.move(1200, 650);
  await page.mouse.wheel(0, -4000);
  await page.keyboard.down("w");
  await page.keyboard.down("Shift");
  await measure("procedural-streaming-flight", 16000);
  await page.keyboard.up("Shift");
  await page.keyboard.up("w");
  const s = await get();
  expect(Math.hypot(...s.position)).toBeGreaterThan(600000);
  expect(s.sectors).toBe(27);
  await page.keyboard.press("r");
  await page.keyboard.press("n");
  await page.keyboard.down("g");
  await measure("light-and-gravity", 6000);
  await page.keyboard.up("g");
  adapter = await page.evaluate(async () => {
    const a = await navigator.gpu?.requestAdapter();
    return a
      ? {
          vendor: a.info.vendor,
          architecture: a.info.architecture,
          description: a.info.description,
        }
      : null;
  });
  expect(errors).toEqual([]);
} finally {
  await fs.mkdir("artifacts", { recursive: true });
  await fs.writeFile(
    "artifacts/sanctuary-performance.json",
    JSON.stringify(
      {
        url,
        browser: browser.version(),
        viewport: "2560x1440",
        dpr: 1,
        readyMs,
        adapter,
        runs,
        errors,
      },
      null,
      2,
    ),
  );
  await browser.close();
}
