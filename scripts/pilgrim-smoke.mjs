import { chromium } from "@playwright/test";
import fs from "node:fs/promises";
import { enterEnglishExperience } from "./qa-entry.mjs";
import { qaLaunch } from "./qa-browser.mjs";
const softwareGpu = !!process.env.QA_SOFTWARE_GPU,
  url = process.env.QA_URL || "http://localhost:4173",
  backend =
    process.env.QA_BACKEND === "webgl"
      ? "&backend=webgl&quality=BATTERY"
      : process.env.QA_SOFTWARE_GPU
        ? "&quality=BATTERY"
        : "";
const browser = await chromium.launch(qaLaunch());
const page = await browser.newPage({
    viewport: process.env.QA_SOFTWARE_GPU
      ? { width: 960, height: 600 }
      : { width: 1600, height: 1000 },
    locale: "en-US",
  }),
  errors = [],
  checks = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => {
  if (["error", "warning"].includes(m.type())) {
    errors.push(m.text());
    console.log(m.type(), m.text());
  }
});
// backend below is the requested query; detected is what the renderer chose.
let detected = null;
const inspect = async () => {
  const s = await page.evaluate(() => window.__vastness.inspect());
  detected = { backend: s.backend, quality: s.quality, dpr: s.dpr };
  return s;
};
const check = (name, ok, detail) => {
  checks.push({ name, passed: !!ok, detail });
  console.log(ok ? "PASS" : "FAIL", name, detail ?? "");
};
// A software rasterizer takes seconds per frame, so the simulation cannot hold the
// wall-clock windows these checks measure; on QA_SOFTWARE_GPU they are recorded
// but do not fail the run.
const timed = (name, ok, detail) => {
  if (!softwareGpu || ok) return check(name, ok, detail);
  checks.push({ name, passed: false, skipped: "software GPU", detail });
  console.log("SKIP", name, "(software GPU cannot hold real time)");
};
await fs.mkdir("artifacts", { recursive: true });
try {
  await page.goto(url + "/?qa=1" + backend);
  await page.locator("main[data-ready=true]").waitFor({ timeout: 120000 });
  await enterEnglishExperience(page);
  await page
    .getByRole("button", { name: "Go with PILGRIM", exact: true })
    .click();
  await page.waitForTimeout(5000);
  let a = await inspect();
  check("PILGRIM boards through visible Go control", a.pilgrim.active);
  if (softwareGpu)
    check(
      "Software adapter is real WebGPU, not the WebGL2 fallback",
      detected.backend === "WebGPU",
      detected,
    );
  await page.keyboard.down("KeyW");
  await page.keyboard.down("KeyD");
  await page.waitForTimeout(2500);
  await page.keyboard.up("KeyD");
  await page.keyboard.up("KeyW");
  let b = await inspect();
  timed(
    "Physical vehicle accelerates and turns with W+D",
    b.pilgrim.distance > a.pilgrim.distance + 4 &&
      Math.abs(b.pilgrim.yaw - a.pilgrim.yaw) > 0.2,
  );
  await page
    .getByRole("button", { name: "Stop and rest", exact: true })
    .click();
  await page.waitForTimeout(3500);
  a = await inspect();
  timed("Rest settles physical velocity", a.pilgrim.speed < 0.1);
  await page
    .getByRole("button", { name: "Carry me somewhere", exact: true })
    .click();
  await page.waitForTimeout(14000);
  b = await inspect();
  timed(
    "Carry uses live perception frames",
    b.pilgrim.carry && b.pilgrim.perception?.captures > 8,
    b.pilgrim.perception,
  );
  await page.screenshot({ path: "artifacts/pilgrim-front.png" });
  await page.mouse.move(710, 410);
  await page.mouse.down();
  await page.mouse.move(785, 440, { steps: 12 });
  await page.mouse.up();
  await page.waitForTimeout(400);
  a = await inspect();
  check(
    "Free-cursor drag immediately overrides Carry",
    !a.pilgrim.carry &&
      (await page.evaluate(() => document.pointerLockElement === null)),
  );
  await page.goto(url + "/lab?qa=1" + backend);
  await page.locator("main[data-ready=true]").waitFor({ timeout: 120000 });
  await page.waitForTimeout(9000);
  a = await inspect();
  timed(
    "Research uses the same PILGRIM and actual sensors",
    a.pilgrim.active && a.pilgrim.perception?.captures > 10,
    a.pilgrim.perception,
  );
  await page.screenshot({ path: "artifacts/pilgrim-lab-rest.png" });
  await page.keyboard.down("KeyW");
  await page.waitForTimeout(3500);
  await page.keyboard.up("KeyW");
  await page.waitForTimeout(1000);
  b = await inspect();
  check(
    "Rendered RGB-D produces estimated motion",
    b.pilgrim.perception?.status === "TRACKING",
    b.pilgrim.perception,
  );
  await page.screenshot({ path: "artifacts/pilgrim-lab-moving.png" });
  await page
    .getByRole("button", { name: "Carry me somewhere", exact: true })
    .last()
    .click();
  await page.waitForTimeout(15000);
  a = await inspect();
  check(
    "Lab shares the scenic planner",
    a.pilgrim.carry && a.pilgrim.perception?.mapCells > 30,
    a.pilgrim,
  );
  await page.screenshot({ path: "artifacts/pilgrim-lab-carry.png" });
  await page
    .getByRole("button", { name: "ESTIMATE + TRUTH", exact: true })
    .click();
  await page.waitForTimeout(800);
  await page.screenshot({ path: "artifacts/pilgrim-lab-evaluation.png" });
  const downloaded = page.waitForEvent("download");
  await page
    .getByRole("button", {
      name: "Export sensors, trajectories & evaluation",
      exact: false,
    })
    .click();
  const download = await downloaded;
  await download.saveAs("artifacts/pilgrim-sensor-bundle.json");
  const bundle = JSON.parse(
    await fs.readFile("artifacts/pilgrim-sensor-bundle.json", "utf8"),
  );
  console.log("EVALUATION", JSON.stringify(bundle.evaluation));
  check("No runtime or shader errors", errors.length === 0, errors);
} catch (e) {
  check("Browser completion", false, String(e));
} finally {
  await fs.writeFile(
    "artifacts/pilgrim-smoke.json",
    JSON.stringify(
      {
        url,
        backend,
        detected,
        viewport: page.viewportSize(),
        browser: browser.version(),
        checks,
        errors,
      },
      null,
      2,
    ),
  );
  await browser.close();
}
if (checks.some((c) => !c.passed && !c.skipped)) process.exitCode = 1;
