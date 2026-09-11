import { chromium, expect } from "@playwright/test";
import fs from "node:fs/promises";
import { qaLaunch } from "./qa-browser.mjs";
const browser = await chromium.launch(qaLaunch());
const page = await browser.newPage({
  viewport: { width: 1600, height: 1000 },
  locale: "ko-KR",
});
const base = process.env.QA_URL || "http://localhost:4173",
  fallback = process.env.QA_BACKEND === "webgl";
const suffix = fallback ? "-webgl" : "";
const errors = [],
  checks = [],
  samples = [],
  performance = [];
const profile = process.env.QA_PROFILE === "1";
let readyMs;
const read = () => page.evaluate(() => window.__vastness.inspect());
const check = (name, result) => {
  checks.push({ name, passed: !!result });
  expect(result, name).toBeTruthy();
  console.log("PASS", name);
};
const shot = async (name) => {
  await page.screenshot({ path: `artifacts/approach-${name}${suffix}.png` });
  if (process.env.QA_EVIDENCE === "1")
    await page.screenshot({
      path: `artifacts/approach-${name}${suffix}.jpg`,
      type: "jpeg",
      quality: 90,
    });
  console.log("SCREENSHOT", name);
};
page.on("pageerror", (e) => {
  errors.push(e.message);
  console.log("ERROR", e.message);
});
page.on("console", (m) => {
  if (["error", "warning"].includes(m.type())) {
    errors.push(m.text());
    console.log("ERROR", m.text());
  }
});
async function measure(name) {
  if (!profile) return;
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
        .map((row) => row[key])
        .filter((x) => typeof x === "number" && Number.isFinite(x))
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
      frameMs: stats("frame"),
      gpuRenderMs: stats("render"),
      gpuComputeMs: stats("compute"),
      quality: s.quality,
      backend: s.backend,
      dpr: s.dpr,
    };
  });
  performance.push({ name, ...result });
  console.log("PERFORMANCE", name, JSON.stringify(result));
}
async function travel(id) {
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "쉼터와 행성 둘러보기" }).click();
  const distant = page.getByRole("button", {
    name: "다른 행성과 먼 우주",
    exact: true,
  });
  if (await distant.count()) await distant.click();
  await page.locator(`[data-destination="${id}"]`).click();
  await page.waitForTimeout(250);
  check(id + " starts continuous travel", (await read()).mode === "TRAVEL");
  await page.waitForFunction(
    () => window.__vastness.inspect().mode === "FREE",
    {},
    { timeout: 90000 },
  );
  await page.waitForFunction(
    (id) => window.__vastness.inspect().encounter === id,
    id,
  );
  await page.waitForTimeout(800);
}
try {
  await fs.mkdir("artifacts", { recursive: true });
  const started = Date.now();
  await page.goto(
    base +
      "/?qa=1" +
      (profile ? "&profile=1" : "") +
      (fallback ? "&backend=webgl&quality=BATTERY" : ""),
  );
  await page.locator("main[data-ready=true]").waitFor({ timeout: 120000 });
  readyMs = Date.now() - started;
  check(
    "Requested render backend initializes",
    (await read()).backend === (fallback ? "WebGL2" : "WebGPU"),
  );
  await page.getByRole("button", { name: "안내 없이 시작" }).click();
  await shot("opening");
  await measure("opening");
  if (process.env.QA_GR !== "0") {
    await travel("wound");
    const beforeGas = await read();
    await page.getByRole("button", { name: "가스 한 줄기 흘려보내기" }).click();
    await page.waitForTimeout(2000);
    check(
      "Gas release changes persistent state and moves",
      (await read()).gas.released > beforeGas.gas.released &&
        JSON.stringify((await read()).gasSample) !==
          JSON.stringify(beforeGas.gasSample),
    );
    await shot("wound-before");
    const start = await read();
    await page.getByRole("button", { name: /지평선 안으로/ }).click();
    await page.keyboard.press("w");
    await page.waitForTimeout(120);
    check(
      "Manual input cancels observation startup",
      !(await read()).relativity.active && !(await read()).relativityLoading,
    );
    await page.getByRole("button", { name: /지평선 안으로/ }).click();
    await page.waitForFunction(
      () => window.__vastness.inspect().relativity.active,
      {},
      { timeout: 90000 },
    );
    check(
      "Scientific observation initializes without shader errors",
      errors.length === 0,
    );
    check(
      "Numerical readings are optional, collapsed by default",
      !(await page.locator(".relativity-readings").isVisible()),
    );
    const observedGas = (await read()).gas.released;
    await page.getByRole("button", { name: "가스 한 줄기 흘려보내기" }).click();
    await page.waitForTimeout(300);
    check(
      "Gas can be added while observing calculated light paths",
      (await read()).gas.released > observedGas,
    );
    await page
      .getByRole("combobox", { name: "관측 재생 속도" })
      .selectOption("4");
    await page.waitForTimeout(800);
    await shot("gr-exterior");
    await page.keyboard.press("p");
    await page.waitForTimeout(250);
    const paused = (await read()).relativity;
    const pausedGas = (await read()).gas.time;
    await page.waitForTimeout(600);
    check(
      "P freezes the actual proper-time clock",
      paused.properTime === (await read()).relativity.properTime,
    );
    check(
      "P also freezes accretion state",
      pausedGas === (await read()).gas.time,
    );
    const beforeLook = (await read()).quaternion;
    await page.mouse.move(1040, 300);
    await page.mouse.down();
    await page.mouse.move(1240, 345, { steps: 20 });
    await page.mouse.up();
    await page.waitForTimeout(400);
    const afterLook = await read();
    check(
      "Drag changes view inside observation without locking cursor or exiting",
      afterLook.relativity.active &&
        Math.hypot(...afterLook.quaternion.map((v, i) => v - beforeLook[i])) >
          0.01 &&
        !(await page.evaluate(() => !!document.pointerLockElement)),
    );
    await page.mouse.move(1240, 345);
    await page.mouse.down();
    await page.mouse.move(1040, 300, { steps: 20 });
    await page.mouse.up();
    await page.keyboard.press("p");
    await page.waitForFunction(
      () => window.__vastness.inspect().relativity.radius < 1.48,
      {},
      { timeout: 70000 },
    );
    await page.keyboard.press("p");
    await page.waitForTimeout(200);
    await shot("gr-photon-sphere");
    samples.push(await read());
    await measure("photon-sphere");
    await page.keyboard.press("p");
    await page.waitForFunction(
      () => window.__vastness.inspect().relativity.radius < 0.85,
      {},
      { timeout: 30000 },
    );
    await page.keyboard.press("p");
    await page.waitForTimeout(250);
    const inside = await read();
    check(
      "Observer crosses the event horizon in finite proper time",
      inside.relativity.radius < 1 &&
        inside.relativity.outwardLight < 0 &&
        inside.relativity.properTime > 0,
    );
    await shot("gr-interior");
    await measure("interior");
    await page.keyboard.press("k");
    await page.waitForTimeout(500);
    check(
      "Quiet hides observation UI and releases its pointer area",
      await page.locator(".relativity-note").evaluate((node) => {
        const style = getComputedStyle(node);
        return style.opacity === "0" && style.pointerEvents === "none";
      }),
    );
    await shot("gr-interior-quiet");
    await page.keyboard.press("k");
    await page.mouse.move(1100, 380);
    await page.mouse.down();
    await page.mouse.move(150, 380, { steps: 35 });
    await page.mouse.up();
    await page.waitForTimeout(1300);
    await shot("gr-interior-outside-light");
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(700);
    const bounds = await page.locator(".relativity-note").boundingBox();
    check(
      "Observation UI fits portrait viewport",
      bounds.x >= 0 &&
        bounds.x + bounds.width <= 390 &&
        bounds.y >= 0 &&
        bounds.y + bounds.height <= 844 &&
        (await page.evaluate(
          () => document.documentElement.scrollWidth === innerWidth,
        )),
    );
    await shot("gr-mobile");
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Emulation.setTouchEmulationEnabled", {
      enabled: true,
      maxTouchPoints: 2,
    });
    const beforeTouch = (await read()).quaternion;
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ x: 320, y: 150, id: 1 }],
    });
    for (let i = 1; i <= 12; i++)
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [{ x: 320 - i * 5, y: 150, id: 1 }],
      });
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
    await page.waitForTimeout(450);
    check(
      "Right-side touch looks inside the horizon without exiting",
      (await read()).relativity.active &&
        Math.hypot(
          ...(await read()).quaternion.map((x, i) => x - beforeTouch[i]),
        ) > 0.01,
    );
    await cdp.send("Emulation.setTouchEmulationEnabled", { enabled: false });
    await cdp.detach();
    await page.setViewportSize({ width: 1600, height: 1000 });
    await page.keyboard.press("p");
    await page.waitForFunction(
      () => window.__vastness.inspect().relativity.ended,
      {},
      { timeout: 30000 },
    );
    check(
      "Calculation stops at documented radius, without inventing a singularity",
      Math.abs((await read()).relativity.radius - 0.2) < 1e-9,
    );
    await shot("gr-limit");
    await page.keyboard.down("w");
    await page.waitForTimeout(120);
    const exit = await read();
    check(
      "W immediately ends observation and restores exterior manual flight",
      !exit.relativity.active &&
        exit.mode === "FREE" &&
        Math.hypot(...exit.position.map((v, i) => v - start.position[i])) <
          15000,
    );
    await page.keyboard.up("w");
    await page.getByRole("button", { name: /지평선 안으로/ }).click();
    await page.waitForFunction(
      () => window.__vastness.inspect().relativity.active,
    );
    await page.keyboard.press("Escape");
    await page.waitForTimeout(200);
    check(
      "Escape exits observation, cursor remains free",
      !(await read()).relativity.active &&
        !(await page.evaluate(() => !!document.pointerLockElement)),
    );
  }
  for (const id of (process.env.QA_PLACES ?? "moon,serein,ember,nacre,giant")
    .split(",")
    .filter(Boolean)) {
    await travel(id);
    await page.getByRole("button", { name: /더 가까이/ }).click();
    await page.waitForTimeout(400);
    check(
      id + " descent uses existing smooth flight",
      (await read()).mode === "TRAVEL",
    );
    if (
      id ===
      (process.env.QA_PLACES ?? "moon,serein,ember,nacre,giant")
        .split(",")
        .filter(Boolean)[0]
    ) {
      await page.keyboard.down("w");
      await page.waitForTimeout(100);
      check(
        "Manual input interrupts planetary descent immediately",
        (await read()).mode === "FREE",
      );
      await page.keyboard.up("w");
      await page.waitForTimeout(250);
      await page.getByRole("button", { name: /더 가까이/ }).click();
    }
    await page.waitForFunction(
      () => window.__vastness.inspect().mode === "FREE",
      {},
      { timeout: 130000 },
    );
    await page.waitForTimeout(1500);
    const state = await read();
    check(id + " reaches a regional environment", state.approach === id);
    samples.push({ id, state });
    await shot(id + "-surface");
    await measure(id + "-surface");
    if (id === "nacre" && process.env.QA_EVIDENCE === "1") {
      await page.keyboard.press("k");
      await page.waitForTimeout(800);
      await shot("nacre-quiet");
      await page.keyboard.press("k");
    }
    await page.keyboard.down("w");
    await page.keyboard.down("d");
    await page.waitForTimeout(1300);
    await page.keyboard.up("w");
    await page.keyboard.up("d");
    await page.waitForTimeout(400);
    const moving = await read();
    check(
      id + " permits free flight near the surface",
      moving.mode === "FREE" &&
        Math.hypot(...moving.position.map((v, i) => v - state.position[i])) >
          2 &&
        moving.position.every(Number.isFinite),
    );
  }
  check("No shader or runtime errors", errors.length === 0);
} catch (error) {
  console.log("FAILED", error.message);
  try {
    console.log("STATE", JSON.stringify(await read()));
    await shot("failure");
  } catch {}
  throw error;
} finally {
  await fs.writeFile(
    `artifacts/approaches-qa${suffix}.json`,
    JSON.stringify(
      {
        url: base,
        testedAt: new Date().toISOString(),
        browser: await browser.version(),
        viewport: "1600x1000, 390x844 during observation",
        readyMs,
        adapter: profile
          ? await page
              .evaluate(async () => {
                const adapter = await navigator.gpu?.requestAdapter();
                return adapter
                  ? {
                      vendor: adapter.info.vendor,
                      architecture: adapter.info.architecture,
                      description: adapter.info.description,
                    }
                  : null;
              })
              .catch(() => null)
          : null,
        checks,
        samples,
        performance,
        errors,
      },
      null,
      2,
    ),
  );
  await browser.close();
}
