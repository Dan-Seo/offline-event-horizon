import { chromium, expect } from "@playwright/test";
import fs from "node:fs/promises";
const url = process.env.QA_URL || "http://localhost:4173";
const browser = await chromium.launch({ channel: "chrome", headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 1,
});
const page = await context.newPage(),
  errors = [],
  failedRequests = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});
page.on("response", (r) => {
  if (r.status() >= 400)
    failedRequests.push({ url: r.url(), status: r.status() });
});
await page.addInitScript(() => {
  window.__qa = { chapters: [], frames: [], longFrames: [], last: 0 };
  const collect = (t) => {
    const q = window.__qa,
      stage = document.querySelector("main")?.dataset.stage;
    if (stage && q.chapters.at(-1)?.stage !== stage)
      q.chapters.push({ stage, at: t });
    if (q.last) {
      q.frames.push(t - q.last);
      if (t - q.last > 50)
        q.longFrames.push({
          ms: t - q.last,
          stage,
          time: document.querySelector("main")?.dataset.time,
        });
    }
    q.last = t;
    requestAnimationFrame(collect);
  };
  requestAnimationFrame(collect);
});
await page.goto(url);
await page.locator('main[data-ready="true"]').waitFor({ timeout: 60000 });
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
await page.getByRole("button", { name: "Enable sound" }).click();
await expect(page.getByRole("button", { name: "Mute sound" })).toHaveAttribute(
  "aria-pressed",
  "true",
);
await page.getByRole("button", { name: "Mute sound" }).click();
await page.getByRole("button", { name: "Go offline", exact: true }).click();
const start = Date.now();
await fs.mkdir("artifacts", { recursive: true });
for (const t of [33, 65, 106, 152, 190, 226, 269, 300]) {
  await page.waitForFunction(
    (t) => Number(document.querySelector("main")?.dataset.time) >= t,
    t,
    { timeout: 70000 },
  );
  if (t === 65) {
    await page.getByRole("button", { name: "Release a thought" }).click();
    await page.keyboard.press("r");
  }
  if (t === 106) {
    await page.setViewportSize({ width: 1200, height: 800 });
    await page.waitForTimeout(400);
    await page.setViewportSize({ width: 1440, height: 900 });
  }
  if (t === 190) {
    await page.getByRole("button", { name: "Plant a possibility" }).click();
    await page.mouse.click(600, 380);
  }
  if (process.env.QA_CAPTURE === "1" || t === 300)
    await page.screenshot({ path: `artifacts/flow-${t}.png` });
  console.log(`Journey reached ${t}s`);
}
await expect(page.locator(".ending")).toContainText("Nothing needs you");
await expect(page.locator("main")).toHaveAttribute("data-paused", "true");
const result = await page.evaluate(() => ({
  chapters: window.__qa.chapters,
  frames: window.__qa.frames,
  longFrames: window.__qa.longFrames,
  ending: getComputedStyle(document.querySelector(".ending")).opacity,
  header: getComputedStyle(document.querySelector(".masthead")).opacity,
  caption: getComputedStyle(document.querySelector(".chapter-caption")).opacity,
  webmcp: !!document.modelContext,
}));
const sorted = result.frames.slice().sort((a, b) => a - b);
const p = (f) => sorted[Math.floor(sorted.length * f)];
const report = {
  url,
  elapsedSeconds: (Date.now() - start) / 1000,
  adapter,
  errors,
  failedRequests,
  chapters: result.chapters,
  endingOpacity: result.ending,
  headerOpacity: result.header,
  captionOpacity: result.caption,
  longFrames: result.longFrames,
  webmcpSupported: result.webmcp,
  frameMs: {
    p50: p(0.5),
    p95: p(0.95),
    p99: p(0.99),
    max: Math.max(...result.frames),
  },
  frames: result.frames.length,
};
await fs.writeFile(
  "artifacts/full-journey-qa.json",
  JSON.stringify(report, null, 2),
);
console.log(JSON.stringify(report, null, 2));
await browser.close();
if (
  errors.length ||
  failedRequests.length ||
  result.chapters.length !== 8 ||
  Number(result.caption) !== 0 ||
  Number(result.header) !== 0
)
  process.exitCode = 1;
