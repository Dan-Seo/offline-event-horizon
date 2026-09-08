import { chromium } from "@playwright/test";
import fs from "node:fs/promises";
const url = process.env.QA_URL || "http://localhost:4173";
const browser = await chromium.launch({ channel: "chrome", headless: true });
const context = await browser.newContext({
  viewport: { width: 2560, height: 1440 },
  deviceScaleFactor: 1,
});
const page = await context.newPage(),
  errors = [],
  scenarios = [];
page.on("pageerror", (e) => errors.push(e.message));
for (const spec of [
  { t: 78, quality: "HIGH" },
  { t: 165, quality: "HIGH" },
  { t: 165, quality: "ULTRA" },
  { t: 260, quality: "HIGH" },
]) {
  await page.goto(`${url}/?t=${spec.t}&quality=${spec.quality}`);
  await page.locator('main[data-ready="true"]').waitFor({ timeout: 60000 });
  await page.waitForTimeout(6000);
  const frameMs = await page.evaluate(
    () =>
      new Promise((resolve) => {
        const frames = [];
        let previous = performance.now(),
          start = previous;
        const tick = (t) => {
          frames.push(t - previous);
          previous = t;
          if (t - start < 12000) requestAnimationFrame(tick);
          else {
            const s = frames.slice(1).sort((a, b) => a - b),
              p = (f) => s[Math.floor(s.length * f)];
            resolve({
              p50: p(0.5),
              p95: p(0.95),
              p99: p(0.99),
              max: Math.max(...s),
              mean: s.reduce((a, b) => a + b, 0) / s.length,
              frames: s.length,
            });
          }
        };
        requestAnimationFrame(tick);
      }),
  );
  await page.keyboard.press("f");
  await page.waitForTimeout(500);
  const metrics = await page.locator(".hud").innerText();
  scenarios.push({ ...spec, frameMs, metrics });
  console.log(`${spec.quality} at ${spec.t}: ${JSON.stringify(frameMs)}`);
}
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
  deviceScaleFactor: 1,
  adapter,
  scenarios,
  errors,
};
await fs.writeFile(
  "artifacts/performance-qa.json",
  JSON.stringify(report, null, 2),
);
console.log(JSON.stringify(report, null, 2));
if (errors.length) process.exitCode = 1;
