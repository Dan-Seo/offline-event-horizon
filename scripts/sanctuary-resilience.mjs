import { chromium, expect } from "@playwright/test";
import fs from "node:fs/promises";
import { enterEnglishExperience } from "./qa-entry.mjs";
const url = process.env.QA_URL || "http://localhost:4173";
const browser = await chromium.launch({
  channel: process.env.QA_BROWSER || "chrome",
  headless: true,
});
const checks = [],
  errors = [],
  expectedErrors = [];
const inspect = (p) => p.evaluate(() => window.__vastness.inspect());
const check = (name, value) => {
  expect(value, name).toBeTruthy();
  checks.push(name);
  console.log("PASS", name);
};
async function ready(context, expectedAssetFailure = false) {
  const page = await context.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") {
      if (expectedAssetFailure && m.text().includes("net::ERR_FAILED"))
        expectedErrors.push(m.text());
      else errors.push(m.text());
    }
  });
  await page.goto(url + "/?qa=1");
  await page.locator("main[data-ready=true]").waitFor({ timeout: 90000 });
  await enterEnglishExperience(page);
  await page.waitForTimeout(700);
  await page.keyboard.press("Escape");
  return page;
}
await fs.mkdir("artifacts", { recursive: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
});
const page = await ready(context);
await page.keyboard.press("Backquote");
await expect(
  page.getByRole("region", { name: "Technical benchmark" }),
).toBeVisible();
for (const scenario of [
  "PARTICLES",
  "NEBULA",
  "ASTEROIDS",
  "GRAVITY",
  "NONE",
]) {
  await page.getByLabel("Technical scenario").selectOption(scenario);
  await page.waitForTimeout(1100);
  const s = await inspect(page);
  check(
    "Technical " + scenario + " remains live",
    s.benchmark === scenario && s.fps > 0 && s.drawCalls > 0,
  );
  if (scenario === "PARTICLES")
    check(
      "Particle stress enables 160,000 simulated particles",
      s.particles === 160000,
    );
  if (scenario === "GRAVITY")
    check("Gravity stress activates the force field", s.field);
  if (scenario === "NONE")
    check(
      "Leaving stress restores the original particle budget",
      s.particles === 80000 && !s.field,
    );
}
await page.keyboard.press("Escape");
await page
  .getByRole("button", { name: "Comfort settings", exact: true })
  .click();
for (const [tier, count] of [
  ["ULTRA", 160000],
  ["HIGH", 80000],
  ["BALANCED", 36000],
  ["BATTERY", 12000],
]) {
  await page.getByLabel("Detail", { exact: true }).selectOption(tier);
  await page.waitForTimeout(400);
  const s = await inspect(page);
  check(
    tier + " changes the live simulation budget",
    s.quality === tier && s.particles === count,
  );
}
await context.close();
const missing = await browser.newContext({
  viewport: { width: 1440, height: 900 },
});
await missing.route("**/assets/cathedral*.glb", (route) =>
  route.abort("failed"),
);
const fallback = await ready(missing, true);
await expect
  .poll(async () => (await inspect(fallback)).assetFallback)
  .toBe(true);
await fallback.keyboard.down("w");
await fallback.waitForTimeout(400);
await fallback.keyboard.up("w");
check(
  "Failed hero GLBs retain a navigable procedural universe",
  (await inspect(fallback)).position[2] < 459.5,
);
await fallback.screenshot({ path: "artifacts/vastness-missing-asset.png" });
await missing.close();
const slowed = await browser.newContext({
  viewport: { width: 1280, height: 800 },
});
// Deliberately constrain frame scheduling to exercise adaptation, not to benchmark hardware.
await slowed.addInitScript(() => {
  const request = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = (callback) =>
    request(() => setTimeout(() => callback(performance.now()), 40));
});
const slow = await ready(slowed);
await expect
  .poll(
    async () => {
      const state = await inspect(slow);
      return [state.quality, state.particles];
    },
    {
      timeout: 26000,
      intervals: [1000],
    },
  )
  .toEqual(["BALANCED", 36000]);
check(
  "Sustained slow frames automatically lower detail",
  (await inspect(slow)).particles === 36000,
);
await slow.keyboard.down("w");
await slow.waitForTimeout(600);
await slow.keyboard.up("w");
check(
  "Navigation continues after adaptive downgrade",
  (await inspect(slow)).position[2] < 459.5,
);
await slowed.close();
await browser.close();
const report = {
  url,
  browser: process.env.QA_BROWSER || "chrome",
  checks,
  errors,
  expectedErrors,
};
await fs.writeFile(
  "artifacts/sanctuary-resilience.json",
  JSON.stringify(report, null, 2),
);
console.log(JSON.stringify(report, null, 2));
if (errors.length) process.exitCode = 1;
