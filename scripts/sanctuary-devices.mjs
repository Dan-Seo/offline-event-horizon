import { chromium, expect } from "@playwright/test";
import fs from "node:fs/promises";
import { enterEnglishExperience } from "./qa-entry.mjs";
const url = process.env.QA_URL || "http://localhost:4173",
  browser = await chromium.launch({
    channel: process.env.QA_BROWSER || "chrome",
    headless: true,
  }),
  checks = [],
  errors = [],
  expectedErrors = [];
let testingContextLoss = false;
await fs.mkdir("artifacts", { recursive: true });
async function ready(page, query = "") {
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error" && !m.text().includes("net::ERR_FAILED")) {
      if (testingContextLoss && m.text().includes("WebGL Device Lost"))
        expectedErrors.push(m.text());
      else errors.push(m.text());
    }
  });
  await page.goto(url + "/?qa=1" + query);
  await page.locator("main[data-ready=true]").waitFor({ timeout: 90000 });
  await enterEnglishExperience(page);
  await page.waitForTimeout(1500);
  await page.keyboard.press("Escape");
}
const inspect = (p) => p.evaluate(() => window.__vastness.inspect());
const check = (name, ok) => {
  expect(ok, name).toBeTruthy();
  checks.push(name);
  console.log("PASS", name);
};
for (const spec of [
  { name: "laptop", width: 1366, height: 768 },
  { name: "tablet", width: 1024, height: 768 },
  { name: "mobile", width: 390, height: 844 },
]) {
  const context = await browser.newContext({
    viewport: { width: spec.width, height: spec.height },
    deviceScaleFactor: spec.name === "laptop" ? 1 : 2,
    hasTouch: spec.name !== "laptop",
    isMobile: spec.name === "mobile",
    reducedMotion: spec.name === "mobile" ? "reduce" : "no-preference",
  });
  const page = await context.newPage();
  await ready(page);
  check(
    spec.name + " has no overflow",
    await page.evaluate(
      () => document.documentElement.scrollWidth === innerWidth,
    ),
  );
  check(
    spec.name + " canvas receives central input",
    await page.evaluate(
      () =>
        document.elementFromPoint(innerWidth / 2, innerHeight / 2)?.tagName ===
        "CANVAS",
    ),
  );
  const dims = await page.locator(".universe-canvas canvas").evaluate((c) => ({
      width: c.width,
      height: c.height,
      cssWidth: c.clientWidth,
      cssHeight: c.clientHeight,
    })),
    s = await inspect(page);
  check(
    spec.name + " drawing buffer follows DPR",
    Math.abs(dims.width - dims.cssWidth * s.dpr) < 2 &&
      Math.abs(dims.height - dims.cssHeight * s.dpr) < 2,
  );
  if (spec.name !== "laptop") {
    const cdp = await context.newCDPSession(page),
      leftX = Math.round(spec.width * 0.2),
      rightX = Math.round(spec.width * 0.75),
      y = Math.round(spec.height * 0.55);
    const touch = async (type, pts) =>
      cdp.send("Input.dispatchTouchEvent", {
        type,
        touchPoints: pts.map(([id, x, y]) => ({
          id,
          x,
          y,
          radiusX: 5,
          radiusY: 5,
          force: 1,
        })),
      });
    const a = await inspect(page);
    await touch("touchStart", [[1, leftX, y]]);
    await touch("touchMove", [[1, leftX + 24, y - 55]]);
    await page.waitForTimeout(650);
    const b = await inspect(page);
    check(
      spec.name + " left thumb moves diagonally",
      b.position[0] > a.position[0] + 0.5 &&
        b.position[2] < a.position[2] - 0.5,
    );
    await touch("touchStart", [
      [1, leftX + 24, y - 55],
      [2, rightX, y],
    ]);
    await touch("touchMove", [
      [1, leftX + 24, y - 55],
      [2, rightX + 35, y - 15],
    ]);
    await page.waitForTimeout(180);
    check(
      spec.name + " second thumb looks while moving",
      Math.abs((await inspect(page)).quaternion[1] - b.quaternion[1]) > 0.005,
    );
    const dial = (await inspect(page)).speedDial;
    await touch("touchMove", [
      [1, leftX - 25, y - 55],
      [2, rightX + 60, y - 15],
    ]);
    // The lightweight UI snapshot is published every 120 ms; wait on the change,
    // rather than racing it with a shorter fixed sleep.
    await expect
      .poll(async () => (await inspect(page)).speedDial)
      .toBeGreaterThan(dial);
    check(
      spec.name + " pinch changes speed",
      (await inspect(page)).speedDial > dial,
    );
    await touch("touchEnd", []);
    await page.waitForTimeout(2000);
    check(
      spec.name + " touch release settles",
      (await inspect(page)).velocity < 8,
    );
    await page.keyboard.press("r");
    await page.waitForTimeout(200);
    const planet = (await inspect(page)).bodies.find((b) => b.id === "giant");
    await page.touchscreen.tap(planet.x, planet.y);
    await page.waitForTimeout(200);
    check(
      spec.name + " tap selects planet",
      (await inspect(page)).selected === "THE SILENT GIANT",
    );
    await page
      .getByRole("button", { name: "Comfort settings", exact: true })
      .tap();
    if (spec.name === "mobile")
      await expect(page.getByLabel("Gentler movement")).toBeChecked();
    await page.getByLabel("Detail", { exact: true }).selectOption("BATTERY");
    await page.getByRole("button", { name: "Close panel" }).tap();
    await page.screenshot({ path: `artifacts/vastness-${spec.name}.png` });
    await page.setViewportSize({ width: 844, height: 390 });
    await page.waitForTimeout(300);
    await page.screenshot({
      path: `artifacts/vastness-${spec.name}-landscape.png`,
    });
    check(
      spec.name + " orientation change preserves layout",
      await page.evaluate(
        () => document.documentElement.scrollWidth === innerWidth,
      ),
    );
  } else await page.screenshot({ path: "artifacts/vastness-laptop.png" });
  await context.close();
}
const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  }),
  page = await context.newPage();
await ready(page);
await page.keyboard.press("g");
await page.keyboard.down("g");
await page.waitForTimeout(500);
check("G enables an actual matter field", (await inspect(page)).field);
await page.keyboard.up("g");
await page.waitForTimeout(250);
check("Releasing G dissipates the field", !(await inspect(page)).field);
await page.keyboard.press("n");
await page.waitForTimeout(700);
check("N creates a persistent star", (await inspect(page)).seeds === 1);
check(
  "Created star is visibly present in the scene",
  (await inspect(page)).createdVisible === 1,
);
await page.waitForTimeout(8000);
await page.screenshot({ path: "artifacts/vastness-created-star.png" });
await page.reload();
await page.locator("main[data-ready=true]").waitFor({ timeout: 90000 });
await page.waitForTimeout(300);
check("Created star survives reload", (await inspect(page)).seeds === 1);
await page.keyboard.press("Escape");
await page
  .getByRole("button", { name: "Comfort settings", exact: true })
  .click();
await page.getByRole("button", { name: "Leave a little light" }).click();
await page.waitForTimeout(300);
check(
  "Visible creation control plants another star",
  (await inspect(page)).seeds === 2,
);
await page.keyboard.press("k");
await expect(page.locator("main")).toHaveClass(/quiet/);
check(
  "Quiet hides interface",
  await page
    .locator(".masthead")
    .evaluate((e) => getComputedStyle(e).visibility === "hidden"),
);
await page.getByRole("button", { name: "Leave quiet mode" }).click();
await page.getByRole("button", { name: "Enable sound" }).click();
await expect(page.getByRole("button", { name: "Mute sound" })).toHaveAttribute(
  "aria-pressed",
  "true",
);
await page.getByRole("button", { name: "Mute sound" }).click();
checks.push("Audio is opt-in and mute is available");
await context.close();
const fallback = await browser.newContext({
  viewport: { width: 1280, height: 800 },
});
await fallback.addInitScript(() =>
  Object.defineProperty(navigator, "gpu", {
    get: () => undefined,
    configurable: true,
  }),
);
const gl = await fallback.newPage();
await ready(gl);
check(
  "Missing WebGPU automatically selects WebGL2",
  (await inspect(gl)).backend === "WebGL2",
);
const glBefore = (await inspect(gl)).position;
await gl.keyboard.down("w");
await gl.waitForTimeout(450);
await gl.keyboard.up("w");
check(
  "WebGL2 remains navigable",
  (await inspect(gl)).position[2] < glBefore[2] - 0.5,
);
await gl.keyboard.down("g");
await gl.waitForTimeout(200);
check(
  "WebGL2 runs reduced CPU gravity",
  (await inspect(gl)).field && (await inspect(gl)).particles === 5000,
);
await gl.keyboard.up("g");
await gl.screenshot({ path: "artifacts/vastness-webgl.png" });
testingContextLoss = true;
await gl.evaluate(() =>
  document
    .querySelector("canvas")
    .getContext("webgl2")
    .getExtension("WEBGL_lose_context")
    .loseContext(),
);
// Next.js also owns an empty route-announcer alert. Assert the artwork's
// recovery message specifically, without depending on announcer timing.
await expect(gl.locator(".error-state[role=alert]")).toBeVisible();
checks.push("Context loss gives a visible recovery path");
testingContextLoss = false;
await gl.getByRole("link", { name: "Try lighter graphics" }).click();
await gl
  .locator('main[data-ready=true][data-backend="WebGL2"]')
  .waitFor({ timeout: 90000 });
await expect(gl.locator(".error-state")).toHaveCount(0);
await gl.keyboard.press("p");
await expect(gl.locator("main")).toHaveAttribute("data-paused", "true");
checks.push("Recovery link restarts WebGL2 with working keyboard input");
await fallback.close();
await browser.close();
const report = { url, checks, errors, expectedErrors };
await fs.writeFile(
  "artifacts/sanctuary-devices.json",
  JSON.stringify(report, null, 2),
);
console.log(JSON.stringify(report, null, 2));
if (errors.length) process.exitCode = 1;
