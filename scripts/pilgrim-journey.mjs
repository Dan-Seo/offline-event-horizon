import { chromium } from "@playwright/test";
import fs from "node:fs/promises";
import { qaChannel, qaLaunch } from "./qa-browser.mjs";
const url = process.env.QA_URL || "http://localhost:4173";
const browser = await chromium.launch(qaLaunch());
const context = await browser.newContext({
    viewport: { width: 1600, height: 1000 },
    locale: "en-US",
    hasTouch: true,
  }),
  page = await context.newPage();
const checks = [],
  errors = [],
  samples = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => {
  if (["error", "warning"].includes(m.type())) errors.push(m.text());
});
const check = (name, ok, detail) => {
  checks.push({ name, passed: !!ok, detail });
  console.log(ok ? "PASS" : "FAIL", name, detail ?? "");
};
let detected = null;
const read = async () => {
  const s = await page.evaluate(() => window.__vastness.inspect());
  detected = { backend: s.backend, quality: s.quality, dpr: s.dpr };
  return s;
};
const shot = async (name) =>
  page.screenshot({ path: `artifacts/journey-${name}.jpg`, quality: 90 });
const sample = async (ms) => {
  for (let elapsed = 0; elapsed < ms; elapsed += 1000) {
    await page.waitForTimeout(Math.min(1000, ms - elapsed));
    const s = await read();
    delete s.bodies;
    samples.push(s);
  }
};
await fs.mkdir("artifacts", { recursive: true });
try {
  await page.goto(url + "/?qa=1&profile=1");
  await page.locator("main[data-ready=true]").waitFor({ timeout: 120000 });
  check(
    "Ordinary arrival does not run research sensors",
    (await read()).pilgrim.perception === null &&
      (await page.locator(".research-lens").count()) === 0,
  );
  await page
    .locator("[data-step=welcome]")
    .getByRole("button", { name: "Carry me somewhere", exact: true })
    .click();
  await sample(8000);
  check(
    "Arrival can hand over without a tutorial",
    (await read()).pilgrim.carry,
  );
  await page.keyboard.press("KeyK");
  check(
    "Quiet hides the interface while Carry stays active",
    (await read()).pilgrim.carry &&
      (await page.locator("main.quiet").count()) === 1,
  );
  await page.evaluate(() => {
    window.__journeyIntervals = [];
    let last = performance.now();
    const tick = (now) => {
      if (window.__journeyIntervals === null) return;
      if (window.__journeyIntervals.length >= 100000)
        window.__journeyIntervals.shift();
      window.__journeyIntervals.push(now - last);
      last = now;
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  const duration = Number(process.env.QA_REST_MS || 120000);
  await sample(duration / 2);
  await shot("water-stillness");
  await sample(duration / 2);
  const carried = await read();
  check(
    "A sustained quiet ride alternates motion and rests",
    carried.pilgrim.distance > 25 && carried.pilgrim.stops > 0,
    {
      seconds: duration / 1000,
      distance: carried.pilgrim.distance,
      stops: carried.pilgrim.stops,
    },
  );
  check(
    "Live state remains bounded throughout the ride",
    samples.every(
      (s) =>
        s.sectors === 27 &&
        s.pilgrim.contactCache <= 18000 &&
        (s.pilgrim.perception?.points ?? 0) <= 14000 &&
        !s.pilgrim.perception?.error,
    ),
  );
  const intervals = await page.evaluate(() => {
    const values = window.__journeyIntervals;
    window.__journeyIntervals = null;
    return values.slice(2);
  });
  await shot("water-later");
  await page.keyboard.down("KeyW");
  await page.waitForTimeout(100);
  check(
    "W interrupts Carry directly even in Quiet",
    !(await read()).pilgrim.carry,
  );
  await page.keyboard.up("KeyW");
  await page.keyboard.press("Escape");
  await page
    .getByRole("button", { name: "Stop and rest", exact: true })
    .click();
  await sample(1600);
  const rested = await read();
  await sample(1500);
  check(
    "Manual rest stops disabled research work",
    (await read()).pilgrim.perception.captures ===
      rested.pilgrim.perception.captures &&
      !(await read()).pilgrim.perception.enabled,
  );
  await page.keyboard.down("ControlLeft");
  await page.keyboard.press("KeyC");
  await page.keyboard.up("ControlLeft");
  check("Ctrl+C does not start a ride", !(await read()).pilgrim.carry);
  await page
    .getByRole("button", { name: "Leave PILGRIM and fly", exact: true })
    .click();
  check("Flight remains available", !(await read()).pilgrim.active);
  await page.keyboard.press("KeyM");
  await page.locator('[data-destination="nacre-coast"]').click();
  await page.waitForFunction(
    () =>
      window.__vastness.inspect().approach === "nacre" &&
      window.__vastness.inspect().mode === "FREE",
    {},
    { timeout: 90000 },
  );
  await sample(2000);
  await page
    .getByRole("button", { name: "Go with PILGRIM", exact: true })
    .click();
  await sample(3500);
  await page
    .getByRole("button", { name: "Stop and rest", exact: true })
    .click();
  await sample(2000);
  const coastStart = await read();
  check(
    "The same craft boards the planetary coastal frame",
    coastStart.pilgrim.active &&
      coastStart.approach === "nacre" &&
      coastStart.pilgrim.position.every(Number.isFinite),
  );
  await page.keyboard.down("KeyW");
  await sample(18000);
  await page.keyboard.up("KeyW");
  await sample(2500);
  const coast = await read();
  check(
    "Planetary surface traversal moves and settles",
    coast.pilgrim.distance > coastStart.pilgrim.distance + 15 &&
      coast.pilgrim.speed < 0.3,
    {
      distance: coast.pilgrim.distance,
      water: coast.pilgrim.water,
      gliding: coast.pilgrim.gliding,
    },
  );
  await shot("aurora-coast");
  await page
    .getByRole("button", { name: "Carry me somewhere", exact: true })
    .click();
  await sample(10000);
  check(
    "Scenic sensing also works in a planetary frame",
    (await read()).pilgrim.perception.captures >
      rested.pilgrim.perception.captures &&
      !(await read()).pilgrim.perception.error,
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(700);
  check(
    "Portrait craft controls fit the viewport",
    await page.evaluate(
      () => document.documentElement.scrollWidth === innerWidth,
    ),
  );
  const cdp = await context.newCDPSession(page),
    before = await read();
  const touch = (type, points) =>
    cdp.send("Input.dispatchTouchEvent", {
      type,
      touchPoints: points.map(([id, x, y]) => ({
        id,
        x,
        y,
        radiusX: 5,
        radiusY: 5,
        force: 1,
      })),
    });
  await touch("touchStart", [
    [1, 65, 510],
    [2, 285, 510],
  ]);
  await touch("touchMove", [
    [1, 80, 455],
    [2, 330, 485],
  ]);
  await page.waitForTimeout(2000);
  await touch("touchEnd", []);
  await page.waitForTimeout(300);
  const mobile = await read();
  check(
    "Two-thumb input interrupts Carry and drives the craft",
    !mobile.pilgrim.carry &&
      mobile.pilgrim.distance > before.pilgrim.distance + 0.5 &&
      Math.abs(mobile.pilgrim.yaw - before.pilgrim.yaw) > 0.01,
  );
  await shot("portrait");
  await page.keyboard.press("KeyR");
  await page.waitForTimeout(200);
  check(
    "Recovery returns to the original sea without trapping input",
    !(await read()).pilgrim.active &&
      (await read()).mode === "FREE" &&
      (await page.evaluate(() => document.pointerLockElement === null)),
  );
  check("No browser or shader errors", errors.length === 0, errors);
  const sorted = [...intervals].sort((a, b) => a - b);
  const performance = {
    frames: sorted.length,
    p50: sorted[Math.floor(sorted.length * 0.5)],
    p95: sorted[Math.floor(sorted.length * 0.95)],
    p99: sorted[Math.floor(sorted.length * 0.99)],
    max: sorted.at(-1),
    over50: sorted.filter((v) => v > 50).length,
    quality: carried.quality,
    dpr: carried.dpr,
    viewport: { width: 1600, height: 1000 },
  };
  await fs.writeFile(
    "artifacts/pilgrim-journey.json",
    JSON.stringify(
      {
        url,
        detected,
        browser: browser.version(),
        channel: qaChannel,
        at: new Date().toISOString(),
        checks,
        errors,
        performance,
        samples,
      },
      null,
      2,
    ),
  );
} catch (e) {
  check("Journey completes", false, String(e));
  await shot("failure");
  await fs.writeFile(
    "artifacts/pilgrim-journey-failure.json",
    JSON.stringify(
      { url, detected, checks, errors, state: await read().catch(() => null) },
      null,
      2,
    ),
  );
} finally {
  await browser.close();
}
if (checks.some((c) => !c.passed)) process.exitCode = 1;
