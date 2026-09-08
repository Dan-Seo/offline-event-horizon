import { chromium, expect } from "@playwright/test";
import fs from "node:fs/promises";

const url = process.env.QA_URL || "http://localhost:4173";
const reports = [];
for (const requestedBackend of ["webgpu", "webgl"]) {
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const page = await browser.newPage({
    viewport: { width: 2560, height: 1440 },
    deviceScaleFactor: 1,
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await page.addInitScript(() => {
    window.__startupFrames = [];
    let previous = 0;
    function frame(t) {
      if (document.querySelector("main")?.dataset.ready === "true") {
        if (previous) window.__startupFrames.push(t - previous);
        previous = t;
      } else {
        previous = 0;
      }
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  });
  const start = Date.now();
  await page.goto(
    url + "/?qa=1" + (requestedBackend === "webgl" ? "&backend=webgl" : ""),
  );
  await page.locator("main[data-ready=true]").waitFor({ timeout: 90000 });
  const readyMs = Date.now() - start;
  await page.keyboard.down("w");
  await page.waitForTimeout(400);
  await page.keyboard.up("w");
  const state = await page.evaluate(() => window.__vastness.inspect());
  expect(state.position[2]).toBeLessThan(8950);
  if (requestedBackend === "webgl") expect(state.backend).toBe("WebGL2");
  await page.waitForTimeout(7000);
  const frameMs = await page.evaluate(() => {
    const v = window.__startupFrames.sort((a, b) => a - b);
    return {
      frames: v.length,
      max: Math.max(...v),
      p95: v[Math.floor(v.length * 0.95)],
      over50: v.filter((x) => x > 50).length,
    };
  });
  reports.push({
    url,
    browser: browser.version(),
    requestedBackend,
    backend: state.backend,
    readyMs,
    immediateMovement: true,
    frameMs,
    errors,
  });
  await browser.close();
  console.log(reports.at(-1));
}
await fs.mkdir("artifacts", { recursive: true });
await fs.writeFile(
  "artifacts/vastness-startup.json",
  JSON.stringify(reports, null, 2),
);
if (reports.some((r) => r.errors.length)) process.exitCode = 1;
