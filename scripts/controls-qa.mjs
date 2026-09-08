import { chromium, expect } from "@playwright/test";
import fs from "node:fs/promises";

const url = process.env.QA_URL || "http://localhost:4173";
const browser = await chromium.launch({
  channel: process.env.QA_BROWSER || "chrome",
  headless: true,
});
const checks = [],
  errors = [];
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
});
const page = await context.newPage();
page.on("pageerror", (e) => errors.push(e.message));
const ready = async (p, query = "") => {
  await p.goto(url + query);
  await p.locator('main[data-ready="true"]').waitFor({ timeout: 60000 });
  await p.waitForTimeout(2200);
};
await ready(page, "/?t=78");
await page.mouse.move(950, 430);
await page.mouse.down();
await page.mouse.move(710, 430, { steps: 24 });
await page.mouse.up();
await expect(page.locator("main")).toHaveAttribute("data-released", "1");
checks.push("Raycast notification drag releases actual object");
await page.getByRole("button", { name: "Release a thought" }).click();
await expect(page.locator("main")).toHaveAttribute("data-released", "2");
await page.keyboard.press("r");
await expect(page.locator("main")).toHaveAttribute("data-released", "3");
checks.push("Accessible release button and R release separate objects");
await page.locator("main").click({ position: { x: 20, y: 400 } });
await page.keyboard.press("Space");
await expect(page.locator("main")).toHaveAttribute("data-paused", "false");
await page.keyboard.press("Space");
await expect(page.locator("main")).toHaveAttribute("data-paused", "true");
const paused = Number(await page.locator("main").getAttribute("data-time"));
await page.waitForTimeout(600);
expect(Number(await page.locator("main").getAttribute("data-time"))).toBe(
  paused,
);
checks.push("Space pauses and resumes; timeline stays still while paused");
await page
  .getByRole("button", { name: "Experience settings", exact: true })
  .click();
await page.getByLabel("Detail", { exact: true }).selectOption("BATTERY");
await page.getByLabel("Gentler motion").check();
await page.keyboard.press("Escape");
await expect(
  page.getByRole("button", { name: "Experience settings", exact: true }),
).toBeFocused();
await page.keyboard.press("f");
await expect(page.locator(".hud")).toContainText("BATTERY");
await page.getByLabel("Technical scenario").selectOption("STORM");
await expect(page.locator(".hud")).toContainText("180,000");
await page.getByLabel("Technical scenario").selectOption("GRAVITY");
await expect(page.locator("main")).toHaveAttribute("data-stage", "COSMOS");
await page.getByLabel("Technical scenario").selectOption("ECOSYSTEM");
await expect(page.locator("main")).toHaveAttribute("data-stage", "LIFE");
await page.getByLabel("Technical scenario").selectOption("TRANSFORMATION");
await page.waitForTimeout(500);
await expect(page.locator("main")).toHaveAttribute("data-stage", "DISTORTION");
await page.getByLabel("Technical scenario").selectOption("NONE");
await expect(page.locator("main")).toHaveAttribute("data-stage", "COLLAPSE");
await expect(page.locator(".hud")).toContainText("BATTERY");
checks.push(
  "Quality changes, reduced motion, benchmark scenarios, return to saved chapter/quality",
);
await page.getByRole("button", { name: "Close benchmark" }).click();
await page.getByRole("button", { name: "Go to creation", exact: true }).click();
await page.getByRole("button", { name: "Plant a possibility" }).click();
await page.mouse.click(600, 400);
await expect(page.locator("main")).toHaveAttribute("data-seeds", "2");
checks.push("Button and canvas seed the cosmic field");
await page.getByRole("button", { name: "Enable sound" }).click();
await expect(page.getByRole("button", { name: "Mute sound" })).toHaveAttribute(
  "aria-pressed",
  "true",
);
await page.getByRole("button", { name: "Mute sound" }).click();
checks.push("Sound opt-in and mute state");
await ready(page, "/?backend=webgl&t=260");
await expect(page.locator("main")).toHaveAttribute("data-backend", "WebGL2");
await page.evaluate(() =>
  document
    .querySelector("canvas")
    .getContext("webgl2")
    .getExtension("WEBGL_lose_context")
    .loseContext(),
);
await expect(page.locator(".error-state")).toBeVisible();
await page.getByRole("button", { name: "Stay in the quiet" }).click();
await expect(page.locator(".ending")).toContainText("Nothing needs you");
await expect(page.locator("main")).toHaveAttribute("data-paused", "true");
await page.waitForTimeout(500);
checks.push(
  "Context loss produces recovery UI; quiet fallback remains reachable",
);
await context.close();

const touch = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
  reducedMotion: "reduce",
});
const mobile = await touch.newPage();
mobile.on("pageerror", (e) => errors.push(e.message));
await ready(mobile, "/?t=65");
await mobile.getByRole("button", { name: "Release a thought" }).tap();
await expect(mobile.locator("main")).toHaveAttribute("data-released", "1");
await mobile
  .getByRole("button", { name: "Experience settings", exact: true })
  .tap();
await expect(mobile.getByLabel("Gentler motion")).toBeChecked();
await mobile.getByRole("button", { name: "Close settings" }).tap();
await mobile.setViewportSize({ width: 844, height: 390 });
await mobile
  .getByRole("button", { name: "Experience settings", exact: true })
  .tap();
await mobile.getByLabel("Detail", { exact: true }).selectOption("BALANCED");
await mobile.getByRole("button", { name: "Close settings" }).tap();
expect(
  await mobile.evaluate(
    () => document.documentElement.scrollWidth > innerWidth,
  ),
).toBe(false);
await fs.mkdir("artifacts", { recursive: true });
await mobile.screenshot({ path: "artifacts/touch-landscape.png" });
checks.push(
  "Touch portrait/landscape, reduced-motion preference and quality selector",
);
await touch.close();

const missing = await browser.newContext({
  viewport: { width: 1280, height: 800 },
});
await missing.route("**/assets/office.glb", (r) => r.abort("failed"));
const fallback = await missing.newPage();
fallback.on("pageerror", (e) => errors.push(e.message));
await ready(fallback);
await expect(fallback.locator("main")).toHaveAttribute(
  "data-asset-fallback",
  "true",
);
await fallback.getByRole("button", { name: "Go offline", exact: true }).click();
await expect(fallback.locator("main")).toHaveAttribute("data-paused", "false");
await fallback.screenshot({ path: "artifacts/missing-asset.png" });
checks.push("Missing GLB keeps procedural workspace and journey usable");
await missing.close();

// Simulate an unavailable WebGPU interface; Three must automatically choose WebGL2.
const noGPU = await browser.newContext();
await noGPU.addInitScript(() =>
  Object.defineProperty(navigator, "gpu", {
    get: () => undefined,
    configurable: true,
  }),
);
const autoFallback = await noGPU.newPage();
await ready(autoFallback, "/?t=165");
await expect(autoFallback.locator("main")).toHaveAttribute(
  "data-backend",
  "WebGL2",
);
checks.push("WebGPU unavailable automatically initializes WebGL2");
await noGPU.close();
await browser.close();
const report = {
  url,
  browser: process.env.QA_BROWSER || "chrome",
  checks,
  errors,
};
await fs.writeFile(
  "artifacts/controls-qa.json",
  JSON.stringify(report, null, 2),
);
console.log(JSON.stringify(report, null, 2));
if (errors.length) process.exitCode = 1;
