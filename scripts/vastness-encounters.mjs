import { chromium, expect } from "@playwright/test";
import fs from "node:fs/promises";
const browser = await chromium.launch({ channel: process.env.QA_BROWSER || "chrome", headless: true });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, locale: "ko-KR" });
const errors = [], checks = [], samples = [];
const base = process.env.QA_URL || "http://localhost:4173", fallback = process.env.QA_BACKEND === "webgl";
const suffix = fallback ? "-webgl" : "";
page.on("pageerror", (e) => { errors.push(e.message); console.log("ERROR", e.message); });
page.on("console", (m) => { if (m.type() === "error") { errors.push(m.text()); console.log("ERROR", m.text()); } });
const read = () => page.evaluate(() => window.__vastness.inspect());
const check = (name, result) => { checks.push({ name, passed: Boolean(result) }); expect(result, name).toBeTruthy(); console.log("PASS", name); };
async function travel(id) {
  const started = Date.now();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "쉼터와 행성 둘러보기" }).click();
  if (await page.getByRole("button", { name: "다른 행성과 먼 우주", exact: true }).count())
    await page.getByRole("button", { name: "다른 행성과 먼 우주", exact: true }).click();
  await page.locator(`[data-destination="${id}"]`).click();
  await page.waitForTimeout(300);
  check(id + " starts continuous flight", (await read()).mode === "TRAVEL");
  await page.waitForFunction(() => window.__vastness.inspect().mode === "FREE", {}, { timeout: 70000 });
  await page.waitForFunction((target) => window.__vastness.inspect().encounter === target, id);
  await page.waitForTimeout(900);
  const s = await read(); samples.push({ id, travelMs: Date.now() - started, fps: s.fps, frameMs: s.frameMs, backend: s.backend, position: s.position });
  check(id + " is rendered without errors", errors.length === 0);
  await page.screenshot({ path: `artifacts/encounter-${id}${suffix}.png` });
}
try {
  await fs.mkdir("artifacts", { recursive: true });
  await page.goto(base + "/?qa=1" + (fallback ? "&backend=webgl&quality=BATTERY" : ""));
  await page.locator("main[data-ready=true]").waitFor({ timeout: 120000 });
  await page.getByRole("button", { name: "안내 없이 시작" }).click();
  for (const id of (process.env.QA_PLACES || "serein,nacre,moon,ember,giant").split(",").filter(Boolean)) {
    await travel(id);
    if (id === "serein") {
      await page.getByRole("button", { name: /행성 주위를 천천히 돌기/ }).click();
      await page.waitForTimeout(400);
      const before = await read();
      await page.waitForTimeout(2200);
      const after = await read();
      check("Planet orbit actually moves and turns the observer", after.mode === "ORBIT" && Math.hypot(...after.position.map((p, i) => p - before.position[i])) > 50 && Math.abs(after.quaternion[1] - before.quaternion[1]) > 0.001);
      await page.keyboard.down("w"); await page.waitForTimeout(80);
      check("Manual input interrupts planet orbit within 80 ms", (await read()).mode === "FREE");
      await page.keyboard.up("w");
    }
  }
  await travel("wound");
  await page.getByRole("button", { name: /물질을 살며시 놓아보기/ }).click();
  await page.locator('[data-release="orbit"]').click();
  await page.waitForTimeout(1200);
  const before = await read();
  check("Release creates 48 stateful tracers", before.experiment.active === 48);
  await page.waitForTimeout(4500);
  const after = await read();
  check("Tracer positions evolve under gravity", Math.abs(after.orbitSample[0] - before.orbitSample[0]) > 0.05);
  await page.screenshot({ path: `artifacts/encounter-orbit${suffix}.png` });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(400);
  const bounds = await page.getByRole("region", { name: "블랙홀 중력 실험" }).boundingBox();
  check("Experiment fits mobile portrait without overflow", bounds.x >= 0 && bounds.x + bounds.width <= 390 && bounds.y >= 0 && bounds.y + bounds.height <= 844 && await page.evaluate(() => document.documentElement.scrollWidth === innerWidth));
  await page.screenshot({ path: `artifacts/encounter-orbit-mobile${suffix}.png` });
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.keyboard.press("p"); await page.waitForTimeout(200);
  const paused = (await read()).orbitSample;
  await page.waitForTimeout(500);
  check("P freezes interactive orbit simulation exactly", JSON.stringify((await read()).orbitSample) === JSON.stringify(paused));
  check("Paused simulation cannot queue accidental releases", await page.locator('[data-release="fall"]').isDisabled());
  await page.keyboard.press("p");
  await page.locator('[data-release="fall"]').click();
  await page.waitForFunction(() => window.__vastness.inspect().experiment.absorbed === 48, {}, { timeout: 18000 });
  check("Low angular momentum matter is actually absorbed", (await read()).experiment.absorbed === 48);
  await page.locator('[data-release="escape"]').click();
  await page.waitForFunction(() => window.__vastness.inspect().experiment.escaped === 48, {}, { timeout: 45000 });
  check("High speed matter actually escapes", (await read()).experiment.escaped === 48);
  const gravity = page.getByRole("slider", { name: "중력의 세기" });
  await gravity.focus(); await page.keyboard.press("End");
  await expect.poll(async () => (await read()).experiment.gravity).toBe(2.5);
  check("Visible gravity slider changes the force model", (await read()).experiment.gravity === 2.5);
  await page.getByRole("button", { name: "궤적 지우기" }).click();
  await expect.poll(async () => (await read()).experiment.active).toBe(0);
  check("Clear removes live matter and histories", (await read()).experiment.launched === 0);
  await page.getByRole("button", { name: "패널 닫기" }).click();
  await page.mouse.click(800, 400); await page.waitForTimeout(120); await page.keyboard.press("t");
  await page.getByRole("region", { name: "블랙홀 중력 실험" }).waitFor();
  check("T opens the experiment and releases pointer lock", !await page.evaluate(() => Boolean(document.pointerLockElement)));
  check("No runtime or shader errors", errors.length === 0);
} catch (error) {
  console.log("FAILED STATE", JSON.stringify(await read()));
  await page.screenshot({ path: `artifacts/encounter-failure${suffix}.png` });
  throw error;
} finally {
  await fs.writeFile(`artifacts/encounters-qa${suffix}.json`, JSON.stringify({ url: base, browser: await browser.version(), checks, samples, errors }, null, 2));
  await browser.close();
}
