import { chromium, expect } from "@playwright/test";
import fs from "node:fs/promises";
import { enterEnglishExperience } from "./qa-entry.mjs";
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
const check = (name, ok) => {
  expect(ok, name).toBeTruthy();
  checks.push(name);
  console.log("PASS", name);
};
const inspect = () => page.evaluate(() => window.__vastness.inspect());
const wait = (ms) => page.waitForTimeout(ms);
const hold = async (keys, ms = 550) => {
  for (const k of keys) await page.keyboard.down(k);
  await wait(ms);
  for (const k of keys) await page.keyboard.up(k);
};
const reset = async () => {
  await page.keyboard.press("r");
  await wait(160);
};
const delta = (a, b) => Math.hypot(...a.map((v, i) => v - b[i]));
try {
  await page.goto((process.env.QA_URL || "http://localhost:3000") + "/?qa=1");
  await page.locator("main[data-ready=true]").waitFor({ timeout: 120000 });
  await enterEnglishExperience(page);
  await wait(400);
  const home = await inspect();
  await page.keyboard.down("w");
  await wait(400);
  const w = await inspect();
  check(
    "W moves immediately with a free cursor",
    w.position[2] < home.position[2] - 0.5,
  );
  await page.keyboard.down("d");
  await wait(400);
  const diagonal = await inspect();
  check(
    "W + D moves diagonally",
    diagonal.position[0] > w.position[0] + 0.5 &&
      diagonal.position[2] < w.position[2] - 0.5,
  );
  await page.keyboard.up("w");
  await page.keyboard.up("d");
  await reset();
  await page.mouse.click(720, 440);
  await wait(160);
  check(
    "Canvas click leaves the cursor unlocked and visible",
    await page.evaluate(
      () => !document.pointerLockElement && getComputedStyle(document.querySelector("canvas")).cursor !== "none",
    ),
  );
  await page.keyboard.press("l");
  check("L cannot confine the cursor", !await page.evaluate(() => Boolean(document.pointerLockElement)));
  const rot = (await inspect()).quaternion;
  await page.mouse.move(770, 415, { steps: 8 });
  await wait(150);
  check("Moving the free cursor does not rotate the camera", delta((await inspect()).quaternion, rot) < 0.001);
  await page.keyboard.down("w");
  await page.mouse.down();
  await page.mouse.move(810, 415, { steps: 12 });
  await page.mouse.up();
  await wait(200);
  check(
    "Left-drag look responds while W is held",
    delta((await inspect()).quaternion, rot) > 0.01,
  );
  const dial = (await inspect()).speedDial;
  await page.mouse.wheel(0, -300);
  await wait(150);
  check(
    "Wheel smoothly increases travel dial during flight",
    (await inspect()).speedDial > dial * 1.5,
  );
  const speed = (await inspect()).speed;
  await page.keyboard.down("Shift");
  await wait(120);
  check(
    "Shift gives a visible speed boost",
    (await inspect()).speed > speed * 3,
  );
  await page.keyboard.up("Shift");
  await page.keyboard.up("w");
  await wait(1800);
  check("Released motion settles", (await inspect()).velocity < 0.5);
  const settled = (await inspect()).quaternion;
  await page.mouse.move(1020, 350, { steps: 6 });
  await wait(150);
  check("Releasing a drag stops mouse steering", delta((await inspect()).quaternion, settled) < 0.002);
  await page.getByRole("button", { name: "Comfort settings", exact: true }).click();
  await expect(page.getByLabel("Look sensitivity")).toBeVisible();
  check("UI is clickable immediately after a drag without Esc", !await page.evaluate(() => Boolean(document.pointerLockElement)));
  await page.getByRole("button", { name: "Close panel", exact: true }).click();
  await page.keyboard.press("b");
  await wait(100);
  await page.keyboard.press("Escape");
  await wait(100);
  check(
    "Esc cancels automation with the cursor still free",
    (await inspect()).mode === "FREE" && !await page.evaluate(() => Boolean(document.pointerLockElement)),
  );
  await reset();
  const planet = (await inspect()).bodies.find((b) => b.id === "giant");
  await page.mouse.click(planet.x, planet.y);
  await wait(180);
  check(
    "Clicking the visible planet selects it",
    (await inspect()).selected === "THE SILENT GIANT",
  );
  await page.keyboard.press("f");
  await wait(600);
  check(
    "F starts a continuous approach",
    (await inspect()).mode === "TRAVEL" &&
      delta((await inspect()).position, home.position) > 10,
  );
  await page.keyboard.down("w");
  await wait(80);
  check(
    "Manual W immediately overrides focus travel",
    (await inspect()).mode === "FREE",
  );
  await page.keyboard.up("w");
  await page.keyboard.press("Escape");
  await reset();
  await page.mouse.click(720, 440);
  await wait(130);
  await page.keyboard.press("b");
  await wait(100);
  await page.mouse.move(780, 440, { steps: 5 });
  await wait(120);
  check("Free cursor movement leaves WANDER undisturbed", (await inspect()).mode === "WANDER");
  await page.mouse.down();
  check("A real drag interrupts WANDER in its pointer-down event", (await inspect()).mode === "FREE");
  await page.mouse.move(840, 450, { steps: 5 });
  await page.mouse.up();
  await wait(120);
  check(
    "Drag look keeps manual control after interrupting WANDER",
    (await inspect()).mode === "FREE",
  );
  await page.keyboard.press("Escape");
  await reset();
  const visible = (await inspect()).bodies.find((b) => b.id === "giant");
  await page.mouse.click(visible.x, visible.y);
  await wait(120);
  await page.keyboard.press("Escape");
  await wait(120);
  const orbitBefore = (await inspect()).position;
  await page.mouse.move(720, 450);
  await page.mouse.down({ button: "right" });
  await page.mouse.move(750, 455, { steps: 8 });
  await page.mouse.up({ button: "right" });
  await wait(180);
  check(
    "Right drag orbits the selection",
    delta((await inspect()).position, orbitBefore) > 10,
  );
  await page.keyboard.press("Escape");
  await reset();
  await wait(1100);
  const dbl = (await inspect()).bodies.find((b) => b.id === "giant");
  await page.mouse.dblclick(dbl.x, dbl.y, { delay: 100 });
  await wait(200);
  check(
    "Double click approaches the visible target with a free cursor",
    (await inspect()).mode === "TRAVEL" &&
      (await inspect()).selected === "THE SILENT GIANT",
  );
  await page.keyboard.press("Escape");
  for (const [key, axis, sign] of [
    ["a", 0, -1],
    ["s", 2, 1],
    ["d", 0, 1],
    ["Space", 1, 1],
    ["x", 1, -1],
  ]) {
    await reset();
    const before = await inspect();
    await hold([key]);
    const after = await inspect();
    check(
      `${key} movement works`,
      (after.position[axis] - before.position[axis]) * sign > 0.5,
    );
  }
  for (const [key, sign] of [
    ["q", 1],
    ["e", -1],
  ]) {
    await reset();
    await hold([key]);
    check(`${key} roll works`, (await inspect()).quaternion[2] * sign > 0.02);
  }
  await reset();
  const normal = (await inspect()).speed;
  await page.keyboard.down("Control");
  await page.keyboard.down("w");
  await wait(250);
  check(
    "Ctrl precision slows movement",
    (await inspect()).speed < normal * 0.3,
  );
  await page.keyboard.up("w");
  await page.keyboard.up("Control");
  await page.keyboard.press("b");
  await wait(200);
  check("B enables WANDER", (await inspect()).mode === "WANDER");
  await page.keyboard.down("w");
  await wait(80);
  check("W interrupts WANDER immediately", (await inspect()).mode === "FREE");
  await page.keyboard.up("w");
  await page.keyboard.press("Escape");
  await page.keyboard.press("h");
  await expect(page.getByRole("complementary", { name: "Flight controls", exact: true })).toBeVisible();
  await page.keyboard.press("h");
  await expect(page.getByRole("complementary", { name: "Flight controls", exact: true })).toHaveCount(0);
  checks.push("H toggles help both ways");
  await page.keyboard.press("p");
  await wait(140);
  const t = (await inspect()).time;
  await wait(400);
  check(
    "P pauses all environmental time",
    Math.abs((await inspect()).time - t) < 0.01,
  );
  await page.keyboard.press("p");
  await wait(200);
  check("P resumes simulation", (await inspect()).time > t + 0.08);
  await reset();
  const safe = await inspect();
  check(
    "R restores the known safe view",
    delta(safe.position, home.position) < 0.01 &&
      delta(safe.quaternion, home.quaternion) < 0.001,
  );
  await page.keyboard.down("w");
  await wait(100);
  await page.evaluate(() => window.dispatchEvent(new Event("blur")));
  await wait(100);
  check("Window blur clears held keys", (await inspect()).keys.length === 0);
  await page.keyboard.up("w");
  await reset();
  await page.mouse.move(720, 400);
  await page.mouse.down();
  await page.keyboard.press("Escape");
  await page.mouse.move(850, 420, { steps: 5 });
  await page.mouse.up();
  await wait(150);
  check("Esc during a drag releases steering without a stuck gesture", delta((await inspect()).quaternion, home.quaternion) < 0.001);
  await page.getByRole("button", { name: "Comfort settings", exact: true }).click();
  await expect(page.getByLabel("Look sensitivity")).toBeVisible();
  check("Cancelled drag releases its capture for the next UI click", !await page.evaluate(() => Boolean(document.pointerLockElement)));
  await page.getByRole("button", { name: "Close panel", exact: true }).click();
  await reset();
  await hold(["w"], 1200);
  check(
    "Moving near the sea leaves a simulated water wake",
    (await inspect()).waterWakes > 0,
  );
  for (const [width, height] of [
    [1366, 768],
    [1024, 768],
    [390, 844],
  ]) {
    await page.setViewportSize({ width, height });
    await wait(250);
    check(
      `${width}×${height} canvas has no intercepting overlay`,
      await page.evaluate(
        () =>
          document.elementFromPoint(innerWidth / 2, innerHeight * 0.52)
            ?.tagName === "CANVAS",
      ),
    );
    check(
      `${width}×${height} has no horizontal overflow`,
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
    await reset();
    const before = await inspect();
    await hold(["w"], 250);
    check(
      `${width}×${height} resize preserves controls`,
      (await inspect()).position[2] < before.position[2] - 0.2,
    );
  }
  check("No browser or shader errors", errors.length === 0);
} finally {
  await fs.mkdir("artifacts", { recursive: true });
  await fs.writeFile(
    `artifacts/sanctuary-controls-${process.env.QA_BROWSER || "chrome"}.json`,
    JSON.stringify(
      {
        url: page.url(),
        browser: browser.version(),
        checks,
        errors,
        state: await inspect().catch(() => null),
      },
      null,
      2,
    ),
  );
  await browser.close();
}
