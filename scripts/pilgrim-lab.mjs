import { chromium } from "@playwright/test";
import fs from "node:fs/promises";
const url = process.env.QA_URL || "http://localhost:4173",
  fallback = process.env.QA_BACKEND === "webgl",
  channel = process.env.QA_BROWSER || "chrome";
const browser = await chromium.launch({ channel, headless: true }),
  context = await browser.newContext({
    viewport: { width: 1600, height: 1000 },
    locale: "en-US",
    hasTouch: true,
  }),
  page = await context.newPage(),
  errors = [],
  checks = [],
  samples = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => {
  if (["warning", "error"].includes(m.type())) {
    errors.push(m.text());
    if (errors.length < 6) console.log(m.type(), m.text());
  }
});
const check = (name, passed, detail) => {
  checks.push({ name, passed: !!passed, detail });
  console.log(passed ? "PASS" : "FAIL", name, detail ?? "");
};
const read = () => page.evaluate(() => window.__vastness.inspect());
const wait = async (ms) => {
  for (let remaining = ms; remaining > 0; remaining -= 1000) {
    await page.waitForTimeout(Math.min(1000, remaining));
    samples.push(await read());
  }
};
const download = async (name) => {
  const pending = page.waitForEvent("download");
  await page
    .getByRole("button", {
      name: "Export sensors, trajectories & evaluation",
      exact: false,
    })
    .click();
  const d = await pending;
  await d.saveAs(`artifacts/${name}.json`);
  return JSON.parse(await fs.readFile(`artifacts/${name}.json`, "utf8"));
};
const suffix = fallback ? "-webgl" : "",
  shot = async (name) =>
    page.screenshot({
      path: `artifacts/lab-${name}${suffix}.jpg`,
      quality: 90,
    });
await fs.mkdir("artifacts", { recursive: true });
try {
  await page.goto(
    url +
      "/lab?qa=1&profile=1" +
      (fallback ? "&backend=webgl&quality=BATTERY" : ""),
  );
  await page.locator("main[data-ready=true]").waitFor({ timeout: 120000 });
  await wait(8500);
  const start = await read(),
    calibration = start.pilgrim.perception.calibration;
  check(
    "Sensor depth matches independent mesh-ray intersections",
    calibration?.samples >= 8 &&
      calibration.maxDepthError < 0.03 &&
      calibration.labelMismatches === 0,
    calibration,
  );
  check(
    "Research route contains live synchronized sensors",
    start.pilgrim.perception.captures > 15 &&
      start.pilgrim.perception.mapCells > 30,
  );
  await shot("starting");
  await page.evaluate(() => {
    window.__qaFrames = [];
    let previous = performance.now();
    const sample = (now) => {
      if (window.__qaFrames === null) return;
      if (window.__qaFrames.length < 100000)
        window.__qaFrames.push(now - previous);
      previous = now;
      requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  });
  await page
    .getByRole("button", { name: "Record 32 sensor frames", exact: true })
    .click();
  await page.keyboard.down("ControlLeft");
  await page.keyboard.down("KeyW");
  await wait(4000);
  await page.keyboard.up("KeyW");
  await page.keyboard.up("ControlLeft");
  await wait(2000);
  const moved = await read();
  check(
    "Precision manual motion yields a real visual estimate",
    moved.pilgrim.distance > 8 &&
      moved.pilgrim.perception.status === "TRACKING",
  );
  await page.waitForFunction(
    () => window.__vastness.inspect().pilgrim.perception.recordedFrames === 32,
    {},
    { timeout: 30000 },
  );
  const sequenceDownload = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Download RGB-D sequence", exact: true })
    .click();
  await (await sequenceDownload).saveAs(`artifacts/lab-sequence${suffix}.tar`);
  check(
    "Sensor sequence recording stops at its explicit memory bound",
    !(await read()).pilgrim.perception.recording,
  );
  await page
    .getByRole("button", { name: "Carry me somewhere", exact: true })
    .last()
    .click();
  await wait(Number(process.env.QA_CARRY_MS || 62000));
  const carried = await read();
  check(
    "Scenic travel advances from perceived routes",
    carried.pilgrim.distance > moved.pilgrim.distance + 12,
  );
  check(
    "Carry rests without ending the live world",
    carried.pilgrim.stops > 0 && carried.time > moved.time + 30,
    carried.pilgrim.stops,
  );
  check(
    "Perception history and contact caches remain bounded",
    carried.pilgrim.perception.points <= 14000 &&
      carried.pilgrim.contactCache <= 18000,
  );
  check(
    "No stale analysis queue accumulates",
    !carried.pilgrim.perception.error &&
      carried.pilgrim.perception.captures > 100,
  );
  await shot("carry");
  const bundle = await download(`lab-clear-bundle${suffix}`);
  check(
    "Export synchronizes truth, estimates, intrinsics and sensor planes",
    bundle.records.every((r) => r.truth.id > 0 && r.truth.timestamp >= 0) &&
      bundle.lastCapture.rgb.length === 192 * 128 * 4 &&
      bundle.lastCapture.depth.length === 192 * 128 &&
      bundle.lastCapture.normals.length === 192 * 128 * 3 &&
      bundle.sensor.fx > 0,
  );
  check(
    "Clear run produces evaluable relative-motion pairs",
    bundle.evaluation.segments.some(
      (s) => s.rpePairs > 8 && Number.isFinite(s.rpeTranslation),
    ),
    {
      tracking: bundle.evaluation.trackingFraction,
      segments: bundle.evaluation.segments.length,
    },
  );
  check(
    "Latest exported image and pose pair share the same capture",
    bundle.lastCapture.id === bundle.records.at(-1).truth.id &&
      bundle.lastCapture.timestamp === bundle.records.at(-1).truth.timestamp,
  );
  await page.keyboard.down("KeyW");
  await page.waitForTimeout(100);
  let s = await read();
  await page.keyboard.up("KeyW");
  check(
    "Manual input cancels autonomous control immediately",
    !s.pilgrim.carry,
  );
  await page.getByRole("button", { name: "Rest", exact: true }).last().click();
  await wait(1500);
  await page.keyboard.press("KeyP");
  const paused = await read();
  await page.waitForTimeout(900);
  s = await read();
  check(
    "Pause freezes physical and sensor simulation time",
    s.time === paused.time && s.pilgrim.distance === paused.pilgrim.distance,
  );
  await page.keyboard.press("KeyP");
  const conditionResults = [];
  for (const condition of [
    "LOW_LIGHT",
    "CLEAR",
    "FOG",
    "REPETITIVE",
    "REFLECTIVE_WATER",
    "DYNAMIC",
    "FAST_MOTION",
    "RAIN",
    "CLEAR",
  ]) {
    await page
      .getByLabel("Sensor condition", { exact: true })
      .selectOption(condition);
    await wait(1600);
    if (condition === "FAST_MOTION") {
      await page
        .getByRole("button", { name: "Reset run", exact: true })
        .click();
      await wait(1000);
      await page.keyboard.down("KeyW");
      await wait(2800);
      const moving = await read();
      await page.keyboard.up("KeyW");
      check(
        "Fast-motion condition changes the physical drive",
        moving.pilgrim.speed > 13,
        {
          speed: moving.pilgrim.speed,
          status: moving.pilgrim.perception.status,
        },
      );
      await wait(1200);
    }
    const state = (await read()).pilgrim.perception;
    conditionResults.push({ condition, ...state });
    check(
      `${condition} applies a new sensor configuration`,
      state.condition === condition && !state.error,
    );
    if (condition === "LOW_LIGHT")
      check(
        "Tracking loss is visible under low light",
        state.status === "LOST",
      );
  }
  check(
    "Tracking recovers after clear visibility returns",
    conditionResults.at(-1).status === "TRACKING",
  );
  await page
    .getByRole("button", { name: "ESTIMATE + TRUTH", exact: true })
    .click();
  await wait(500);
  await shot("evaluation");
  const frameSamples = await page.evaluate(() => {
      const values = window.__qaFrames;
      window.__qaFrames = null;
      return values.slice(2);
    }),
    gpuSamples = samples.map((s) => s.gpuRenderMs).filter((x) => x != null),
    workerSamples = samples
      .map((s) => s.pilgrim.perception?.analysisMs)
      .filter((x) => x != null);
  const stats = (a) => {
    const x = [...a].sort((a, b) => a - b);
    return {
      n: x.length,
      p50: x[Math.floor(x.length * 0.5)],
      p95: x[Math.floor(x.length * 0.95)],
      max: x.at(-1),
    };
  };
  for (const [width, height, label] of [
    [1366, 768, "laptop"],
    [1024, 768, "tablet"],
    [390, 844, "portrait"],
  ]) {
    await page.setViewportSize({ width, height });
    await page.waitForTimeout(700);
    check(
      `${label} layout has no horizontal overflow`,
      await page.evaluate(
        () => document.documentElement.scrollWidth === innerWidth,
      ),
    );
    const bounds = await page.locator(".universe-canvas canvas").boundingBox();
    check(
      `${label} visible canvas receives pointer input`,
      await page.evaluate(
        ({ x, y }) => document.elementFromPoint(x, y)?.tagName === "CANVAS",
        {
          x: bounds.x + bounds.width * 0.5,
          y: bounds.y + bounds.height * 0.35,
        },
      ),
    );
    await shot(label);
  }
  await page
    .getByRole("button", { name: "SENSORS + PLANNER", exact: true })
    .click();
  const cdp = await context.newCDPSession(page),
    before = await read(),
    touch = (type, points) =>
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
  await touch("touchStart", [
    [1, 65, 280],
    [2, 285, 280],
  ]);
  await touch("touchMove", [
    [1, 85, 225],
    [2, 325, 250],
  ]);
  await page.waitForTimeout(1800);
  await touch("touchEnd", []);
  await page.waitForTimeout(250);
  s = await read();
  check(
    "Both thumbs steer and look in the portrait research viewport",
    s.pilgrim.distance > before.pilgrim.distance + 1 &&
      Math.abs(s.pilgrim.yaw - before.pilgrim.yaw) > 0.02,
  );
  await page.waitForTimeout(3000);
  s = await read();
  check(
    "Touch release leaves no held input or motion",
    s.keys.length === 0 && s.pilgrim.speed < 0.2,
  );
  check(
    "Cursor is never locked",
    await page.evaluate(() => document.pointerLockElement === null),
  );
  check(
    "No unexpected console or shader errors",
    errors.length === 0,
    errors.slice(0, 5),
  );
  await fs.writeFile(
    `artifacts/pilgrim-lab-qa${suffix}.json`,
    JSON.stringify(
      {
        url,
        at: new Date().toISOString(),
        browser: browser.version(),
        backend: carried.backend,
        checks,
        errors,
        performance: {
          frameInterval: stats(frameSamples),
          gpuRenderPass: stats(gpuSamples),
          worker: stats(workerSamples),
          viewport: { width: 1600, height: 1000 },
          quality: carried.quality,
          dpr: carried.dpr,
        },
        evaluation: bundle.evaluation,
        conditionResults,
        final: s,
        recordingSamples: samples.length,
      },
      null,
      2,
    ),
  );
} catch (e) {
  check("Lab suite completes", false, String(e));
  await shot("failure");
  await fs.writeFile(
    `artifacts/pilgrim-lab-failure${suffix}.json`,
    JSON.stringify(
      { checks, errors, state: await read().catch(() => null) },
      null,
      2,
    ),
  );
} finally {
  await browser.close();
}
if (checks.some((c) => !c.passed)) process.exitCode = 1;
