import { chromium } from "@playwright/test";
import fs from "node:fs/promises";
const base = process.env.QA_URL || "http://localhost:3000";
await fs.mkdir("artifacts", { recursive: true });
const browser = await chromium.launch({
  channel: "chrome",
  headless: true,
});
const reports = [];
for (const spec of [
  {
    name: "desktop",
    width: 1440,
    height: 900,
    backend: "",
    times: [0, 47, 78, 98, 118, 137, 165, 212, 238, 260, 287],
  },
  {
    name: "mobile",
    width: 390,
    height: 844,
    backend: "",
    times: [0, 78, 165, 260, 287],
  },
  {
    name: "webgl",
    width: 1280,
    height: 800,
    backend: "webgl",
    times: [0, 78, 165, 260, 287],
  },
]) {
  const context = await browser.newContext({
    viewport: { width: spec.width, height: spec.height },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();
  const errors = [],
    warnings = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
    if (m.type() === "warning") warnings.push(m.text());
  });
  await page.goto(
    `${base}/?backend=${spec.backend}&quality=${spec.name === "mobile" ? "BATTERY" : "HIGH"}`,
  );
  await page
    .getByRole("button", { name: "Go offline", exact: true })
    .waitFor({ timeout: 60000 });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `artifacts/${spec.name}-000.png` });
  await page.getByRole("button", { name: "Go offline", exact: true }).click();
  await page.getByRole("button", { name: "Pause journey" }).click();
  await page.keyboard.press("f");
  const scenes = [];
  for (const t of spec.times.filter((t) => t > 0)) {
    // URL seek is a deterministic, documented inspection entry point; normal navigation remains continuous.
    await page.goto(
      `${base}/?backend=${spec.backend}&quality=${spec.name === "mobile" ? "BATTERY" : "HIGH"}&t=${t}`,
    );
    await page.waitForTimeout(5200);
    await page.keyboard.press("f");
    await page.waitForTimeout(500);
    const error = await page.locator(".error-state").count();
    const metrics = await page
      .locator(".hud")
      .innerText()
      .catch(() => "HUD unavailable");
    scenes.push({ t, error, metrics });
    await page.keyboard.press("f");
    await page.screenshot({
      path: `artifacts/${spec.name}-${String(t).padStart(3, "0")}.png`,
    });
    console.log(`${spec.name} ${t}: ${error ? "FAILED" : "rendered"}`);
  }
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > innerWidth,
  );
  reports.push({
    name: spec.name,
    scenes,
    errors: [...new Set(errors)],
    warnings: [...new Set(warnings)],
    overflow,
  });
  await context.close();
}
await browser.close();
await fs.writeFile(
  "artifacts/browser-qa.json",
  JSON.stringify(reports, null, 2),
);
console.log(JSON.stringify(reports, null, 2));
if (
  reports.some(
    (r) =>
      r.errors.length ||
      r.overflow ||
      r.scenes.some((s) => s.error || s.metrics === "HUD unavailable"),
  )
)
  process.exitCode = 1;
