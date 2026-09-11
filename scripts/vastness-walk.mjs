import { chromium, expect } from "@playwright/test";
import fs from "node:fs/promises";
import { qaLaunch } from "./qa-browser.mjs";
const browser = await chromium.launch(qaLaunch());
const page = await browser.newPage({
  viewport: { width: 1600, height: 1000 },
  locale: "ko-KR",
  hasTouch: true,
});
const url = process.env.QA_URL || "http://localhost:4173",
  fallback = process.env.QA_BACKEND === "webgl";
const errors = [],
  checks = [];
const performance = [];
const renderedFrames = [];
const read = () => page.evaluate(() => window.__vastness.inspect());
const check = (name, ok) => {
  checks.push({ name, passed: !!ok });
  expect(ok, name).toBeTruthy();
  console.log("PASS", name);
};
const delta = (a, b) => Math.hypot(...a.map((v, i) => v - b[i]));
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => {
  if (["error", "warning"].includes(m.type())) {
    errors.push(m.text());
    console.log("ERROR", m.text());
  }
});
const shot = async (name) => {
  await page.screenshot({
    path: `artifacts/walk-${name}${fallback ? "-webgl" : ""}.png`,
  });
  if (process.env.QA_EVIDENCE === "1")
    await page.screenshot({
      path: `artifacts/walk-${name}${fallback ? "-webgl" : ""}.jpg`,
      type: "jpeg",
      quality: 90,
    });
  console.log("SCREENSHOT", name);
};
async function measure(name) {
  if (process.env.QA_PROFILE !== "1") return;
  const result = await page.evaluate(async () => {
    const rows = [];
    let previous = 0;
    await new Promise((resolve) => {
      const tick = (t) => {
        const s = window.__vastness.inspect();
        if (previous)
          rows.push({
            frame: t - previous,
            render: s.gpuRenderMs,
            compute: s.gpuComputeMs,
          });
        previous = t;
        if (rows.length < 180) requestAnimationFrame(tick);
        else resolve();
      };
      requestAnimationFrame(tick);
    });
    const stats = (key) => {
      const a = rows
        .map((r) => r[key])
        .filter((v) => typeof v === "number" && Number.isFinite(v))
        .sort((a, b) => a - b);
      return a.length
        ? {
            samples: a.length,
            p50: a[Math.floor(a.length * 0.5)],
            p95: a[Math.floor(a.length * 0.95)],
            max: a.at(-1),
          }
        : null;
    };
    const s = window.__vastness.inspect();
    return {
      frame: stats("frame"),
      render: stats("render"),
      compute: stats("compute"),
      quality: s.quality,
      dpr: s.dpr,
      garden: s.garden,
      viewport: { width: innerWidth, height: innerHeight },
    };
  });
  performance.push({ name, ...result });
  console.log("PERFORMANCE", name, JSON.stringify(result));
}
async function checkRendered(name) {
  const png = await page.locator(".universe-canvas canvas").screenshot();
  const stats = await page.evaluate(
    async (src) => {
      const img = new Image();
      img.src = src;
      await img.decode();
      const canvas = document.createElement("canvas");
      canvas.width = 64;
      canvas.height = 40;
      const context = canvas.getContext("2d");
      context.drawImage(img, 0, 0, 64, 40);
      const pixels = context.getImageData(0, 0, 64, 40).data;
      let lit = 0,
        total = 0;
      for (let i = 0; i < pixels.length; i += 4) {
        const l = (pixels[i] + pixels[i + 1] + pixels[i + 2]) / 3;
        total += l;
        if (l > 12) lit++;
      }
      return { mean: total / (64 * 40), litFraction: lit / (64 * 40) };
    },
    "data:image/png;base64," + png.toString("base64"),
  );
  renderedFrames.push({ name, ...stats });
  check(
    name + " contains a rendered landscape, not a silent black frame",
    stats.litFraction > 0.08 && stats.mean > 4,
  );
}
try {
  await fs.mkdir("artifacts", { recursive: true });
  await page.goto(
    url +
      "/?qa=1" +
      (process.env.QA_PROFILE === "1" ? "&profile=1" : "") +
      (fallback ? "&backend=webgl&quality=BATTERY" : ""),
  );
  await page.locator("main[data-ready=true]").waitFor({ timeout: 120000 });
  await page.getByRole("button", { name: "안내 없이 시작" }).click();
  await page.getByRole("button", { name: "쉼터와 행성 둘러보기" }).click();
  await page.locator('[data-destination="nacre-coast"]').click();
  await page.waitForFunction(
    () =>
      window.__vastness.inspect().mode === "FREE" &&
      window.__vastness.inspect().approach === "nacre",
    {},
    { timeout: 130000 },
  );
  check("Land arrival offers grounded walking", (await read()).walkAvailable);
  await shot("arrival");
  await page.getByRole("button", { name: /여기서 걸어보기/ }).click();
  await page.waitForTimeout(3000);
  check(
    "Walking settles to eye height above actual terrain",
    (await read()).walking && (await read()).walkEyeHeight < 1.9,
  );
  await shot("shore-eye-level");
  await checkRendered("Ground-level view");
  const start = await read();
  await page.keyboard.down("w");
  await page.keyboard.down("d");
  await page.waitForTimeout(2000);
  await page.keyboard.up("d");
  await page.keyboard.up("w");
  check(
    "W+D walks diagonally without leaving ground mode",
    (await read()).walking &&
      delta((await read()).position, start.position) > 5 &&
      (await read()).walkedDistance > 5,
  );
  check(
    "Walking leaves world-space light traces and streams local grass",
    (await read()).garden.footprints > 0 && (await read()).garden.blades > 0,
  );
  const q = (await read()).quaternion;
  await page.mouse.move(1060, 280);
  await page.mouse.down();
  await page.mouse.move(1290, 330, { steps: 25 });
  await page.mouse.up();
  await page.waitForTimeout(400);
  check(
    "Walking drag look changes orientation with a free cursor",
    delta((await read()).quaternion, q) > 0.03 &&
      !(await page.evaluate(() => !!document.pointerLockElement)),
  );
  await page.waitForTimeout(1500);
  check("Walking input release settles", (await read()).velocity < 0.3);
  const seeds = (await read()).seeds;
  await page.getByRole("button", { name: "빛 한 점 남기기" }).click();
  await page.waitForTimeout(1200);
  check(
    "Walking can leave a visible persistent little light",
    (await read()).seeds === seeds + 1 && (await read()).createdVisible > 0,
  );
  await page.waitForTimeout(12000);
  check(
    "Stillness gathers living light",
    (await read()).garden.stillness > 0.7 && (await read()).garden.lifeVisible,
  );
  await measure("aurora-coast-walking");
  await checkRendered("Stillness and created light");
  await page.keyboard.press("k");
  await page.waitForTimeout(700);
  await shot("quiet-coast");
  check(
    "Quiet walking does not leave an invisible control panel",
    await page
      .locator(".walk-note")
      .evaluate((el) => getComputedStyle(el).pointerEvents === "none"),
  );
  await page.keyboard.press("k");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(400);
  const bounds = await page.locator(".walk-note").boundingBox();
  check(
    "Walking controls fit portrait",
    bounds.x >= 0 &&
      bounds.x + bounds.width <= 390 &&
      bounds.y + bounds.height <= 844,
  );
  await shot("mobile");
  const cdp = await page.context().newCDPSession(page);
  const touch = (type, points) =>
    cdp.send("Input.dispatchTouchEvent", {
      type,
      touchPoints: points.map(([id, x, y]) => ({
        id,
        x,
        y,
        radiusX: 6,
        radiusY: 6,
        force: 1,
      })),
    });
  const touchBefore = await read();
  await touch("touchStart", [
    [1, 65, 470],
    [2, 280, 470],
  ]);
  await touch("touchMove", [
    [1, 65, 415],
    [2, 335, 440],
  ]);
  await page.waitForTimeout(1500);
  await touch("touchEnd", []);
  await page.waitForTimeout(300);
  check(
    "Two thumbs walk and look at the same time",
    delta((await read()).position, touchBefore.position) > 2 &&
      delta((await read()).quaternion, touchBefore.quaternion) > 0.01 &&
      (await read()).walking,
  );
  check(
    "Mobile walking explains thumb controls",
    await page.locator(".walk-note .touch-help").isVisible(),
  );
  await page.waitForTimeout(1200);
  check("Touch release leaves no stuck motion", (await read()).velocity < 0.3);
  const liftStart = await read();
  await page.getByRole("button", { name: /다시 날아오르기/ }).click();
  await page.waitForTimeout(200);
  check(
    "Visible take-flight control returns free flight",
    !(await read()).walking && (await read()).mode === "FREE",
  );
  check(
    "Takeoff eases upward instead of snapping to the flight envelope",
    delta((await read()).position, liftStart.position) < 4,
  );
  await page.keyboard.down("w");
  await page.waitForTimeout(300);
  await page.keyboard.up("w");
  check("Flight still responds after walking", (await read()).velocity > 1);
  await page.waitForTimeout(1800);
  await page.keyboard.press("j");
  await page.waitForTimeout(3000);
  check(
    "Landing again remains available after takeoff",
    (await read()).walking,
  );
  const beforeWander = await read();
  await page.keyboard.press("b");
  await page.waitForTimeout(180);
  check(
    "Wander leaves walking gently",
    (await read()).mode === "WANDER" &&
      !(await read()).walking &&
      delta((await read()).position, beforeWander.position) < 4,
  );
  await page.keyboard.down("w");
  await page.waitForTimeout(120);
  await page.keyboard.up("w");
  check(
    "Manual input immediately takes over from coastal Wander",
    (await read()).mode === "FREE",
  );
  await page.keyboard.press("r");
  await page.waitForTimeout(200);
  check(
    "R recovers the original sea without walking state",
    !(await read()).walking && (await read()).sanctuary === "last-light",
  );
  check("No rendering or runtime errors", errors.length === 0);
} catch (e) {
  await shot("failure");
  console.log("STATE", JSON.stringify(await read().catch(() => null)));
  throw e;
} finally {
  await fs.writeFile(
    `artifacts/walk-qa${fallback ? "-webgl" : ""}.json`,
    JSON.stringify(
      {
        url,
        testedAt: new Date().toISOString(),
        browser: await browser.version(),
        checks,
        errors,
        performance,
        renderedFrames,
        state: await read().catch(() => null),
      },
      null,
      2,
    ),
  );
  await browser.close();
}
