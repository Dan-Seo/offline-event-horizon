import { chromium, expect } from "@playwright/test";
import fs from "node:fs/promises";
import { enterEnglishExperience } from "./qa-entry.mjs";
import { qaLaunch } from "./qa-browser.mjs";
const url = process.env.QA_URL || "http://localhost:4173",
  browser = await chromium.launch(qaLaunch());
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } }),
  samples = [],
  errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});
try {
  await page.goto(url + "/?qa=1");
  await page.locator("main[data-ready=true]").waitFor({ timeout: 120000 });
  await enterEnglishExperience(page);
  await page.getByRole("button", { name: "WANDER", exact: true }).click();
  for (let i = 0; i < 11; i++) {
    await page.waitForTimeout(10000);
    const s = await page.evaluate(() => window.__vastness.inspect());
    samples.push({
      time: s.time,
      mode: s.mode,
      velocity: s.velocity,
      position: s.position,
      event: s.beautyEvent,
      stillness: s.stillness,
    });
    console.log("WANDER", JSON.stringify(samples.at(-1)));
    expect(s.mode).toBe("WANDER");
    expect(Math.hypot(s.position[0], s.position[2] - 460)).toBeLessThan(450);
    if (i === 8) {
      await page.screenshot({ path: "artifacts/sanctuary-wander-gift.png" });
      await page
        .locator("canvas")
        .screenshot({
          path: "artifacts/sanctuary-signature.jpg",
          type: "jpeg",
          quality: 92,
        });
    }
  }
  expect(samples.filter((s) => s.velocity < 0.3).length).toBeGreaterThan(4);
  expect(samples.some((s) => s.event === "sea-visitor")).toBe(true);
  await page.keyboard.down("w");
  await page.waitForTimeout(80);
  expect((await page.evaluate(() => window.__vastness.inspect())).mode).toBe(
    "FREE",
  );
  await page.keyboard.up("w");
  expect(errors).toEqual([]);
} finally {
  await fs.mkdir("artifacts", { recursive: true });
  await fs.writeFile(
    "artifacts/sanctuary-wander.json",
    JSON.stringify({ url, samples, errors }, null, 2),
  );
  await browser.close();
}
