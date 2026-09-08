import { chromium, expect } from "@playwright/test";
import fs from "node:fs/promises";
const url = process.env.QA_URL || "http://localhost:3000";
const browser = await chromium.launch({
  channel: process.env.QA_BROWSER || "chrome",
  headless: true,
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [],
  checks = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});
await page.goto(url + "/?qa=1");
await page.locator("main[data-ready=true]").waitFor({ timeout: 90000 });
await page.waitForTimeout(1000);
const inspect = () => page.evaluate(() => window.__vastness.inspect());
const reset = async () => {
  await page.keyboard.press("r");
  await page.waitForTimeout(150);
};
const hold = async (keys, ms = 600) => {
  for (const k of keys) await page.keyboard.down(k);
  await page.waitForTimeout(ms);
  for (const k of keys) await page.keyboard.up(k);
};
const check = (name, ok) => {
  expect(ok, name).toBeTruthy();
  checks.push(name);
  console.log("PASS", name);
};
let a = await inspect();
await page.keyboard.down("w");
await page.waitForTimeout(400);
let b = await inspect();
check("W immediately moves forward", b.position[2] < a.position[2] - 20);
await page.keyboard.down("d");
await page.waitForTimeout(450);
let c = await inspect();
check(
  "W + D moves diagonally",
  c.position[0] > b.position[0] + 20 && c.position[2] < b.position[2] - 20,
);
await page.mouse.move(700, 400);
await page.mouse.move(770, 380, { steps: 10 });
await page.waitForTimeout(250);
check(
  "Mouse changes orientation while flying",
  Math.abs((await inspect()).quaternion[1]) > 0.008,
);
const dial = (await inspect()).speedDial;
await page.mouse.wheel(0, -250);
await page.waitForTimeout(150);
check(
  "Scroll increases speed while flying",
  (await inspect()).speedDial > dial * 1.3,
);
const normal = (await inspect()).speed;
await page.keyboard.down("Shift");
await page.waitForTimeout(250);
check("Shift boosts travel speed", (await inspect()).speed > normal * 3);
await page.keyboard.up("w");
await page.keyboard.up("d");
await page.keyboard.up("Shift");
await page.waitForTimeout(1800);
check("Releasing input settles velocity", (await inspect()).velocity < 5);
await reset();
await hold(["a"]);
check("A strafes left", (await inspect()).position[0] < -100);
await reset();
await hold(["s"]);
check("S moves backward", (await inspect()).position[2] > 9100);
await reset();
await hold(["d"]);
check("D strafes right", (await inspect()).position[0] > 100);
await reset();
await hold(["q"]);
check("Q rolls left", (await inspect()).quaternion[2] > 0.03);
await reset();
await hold(["e"]);
check("E rolls right", (await inspect()).quaternion[2] < -0.03);
await reset();
await hold(["Space"]);
check("Space rises", (await inspect()).position[1] > 100);
await reset();
await page.keyboard.down("Control");
await page.keyboard.down("w");
await page.waitForTimeout(500);
check("Ctrl precision slows travel", (await inspect()).speed < 400);
await page.keyboard.up("Control");
await page.keyboard.up("w");
await reset();
// Move into the canvas before resetting; click then uses real pointer hit testing.
await page.mouse.move(800, 700);
await reset();
await page.mouse.click(800, 700);
await page.waitForTimeout(250);
check(
  "Planet click selects a celestial object",
  (await inspect()).selected === "ORPHEUS IV",
);
await page.keyboard.press("f");
await page.waitForTimeout(250);
check("F starts selected-object travel", (await inspect()).mode === "TRAVEL");
await page.keyboard.down("w");
await page.waitForTimeout(100);
check("W interrupts travel immediately", (await inspect()).mode === "FREE");
await page.keyboard.up("w");
await page.keyboard.press("Escape");
await reset();
await page.mouse.move(800, 700);
await reset();
await page.mouse.click(800, 700);
await page.waitForTimeout(120);
a = await inspect();
await page.mouse.down();
await page.mouse.move(845, 685, { steps: 12 });
await page.mouse.up();
await page.waitForTimeout(250);
check(
  "Left drag orbits the selected planet",
  Math.hypot(...(await inspect()).position.map((v, i) => v - a.position[i])) >
    100,
);
await reset();
await page.mouse.move(800, 700);
await reset();
await page.mouse.dblclick(800, 700);
await page.waitForTimeout(150);
check("Double click starts travel", (await inspect()).mode === "TRAVEL");
await page.keyboard.press("Escape");
await page.keyboard.press("h");
await expect(page.getByLabel("Flight controls")).toBeVisible();
await page.keyboard.press("h");
await expect(page.getByLabel("Flight controls")).toHaveCount(0);
checks.push("H toggles help twice");
await page.keyboard.press("p");
a = await inspect();
await page.waitForTimeout(400);
check("P pauses simulation", Math.abs((await inspect()).time - a.time) < 0.05);
await page.keyboard.press("p");
await page.waitForTimeout(200);
check("P resumes simulation", (await inspect()).time > a.time);
await reset();
check(
  "R restores safe position and orientation",
  (await inspect()).position[2] === 9000 &&
    (await inspect()).quaternion[3] === 1,
);
await page.keyboard.press("b");
await page.waitForTimeout(150);
check("Optional drift starts", (await inspect()).mode === "DRIFT");
await page.mouse.move(820, 695, { steps: 4 });
await page.waitForTimeout(100);
check("Mouse immediately interrupts drift", (await inspect()).mode === "FREE");
await page.keyboard.press("l");
await page.waitForTimeout(150);
check("L acquires pointer lock", (await inspect()).locked);
await page.keyboard.press("Escape");
await page.waitForTimeout(150);
check("Escape releases pointer lock", !(await inspect()).locked);
await hold(["w"], 100);
await page.keyboard.down("d");
await page.evaluate(() => window.dispatchEvent(new Event("blur")));
await page.waitForTimeout(150);
check("Blur clears held keys", (await inspect()).keys.length === 0);
await page.keyboard.up("d");
await page.setViewportSize({ width: 1280, height: 720 });
await reset();
await hold(["w", "d"]);
check(
  "Resize preserves simultaneous navigation",
  (await inspect()).position[0] > 50 && (await inspect()).position[2] < 8950,
);
check(
  "Decorative UI does not intercept the canvas",
  await page.evaluate(
    () =>
      document.elementFromPoint(innerWidth / 2, innerHeight / 2)?.tagName ===
      "CANVAS",
  ),
);
check(
  "No horizontal overflow",
  await page.evaluate(
    () => document.documentElement.scrollWidth === innerWidth,
  ),
);
await fs.mkdir("artifacts", { recursive: true });
await page.screenshot({ path: "artifacts/vastness-controls.png" });
const report = {
  url,
  browser: await browser.version(),
  checks,
  errors,
  final: await inspect(),
};
await fs.writeFile(
  "artifacts/vastness-controls.json",
  JSON.stringify(report, null, 2),
);
await browser.close();
console.log(JSON.stringify({ checks: checks.length, errors }, null, 2));
if (errors.length) process.exitCode = 1;
