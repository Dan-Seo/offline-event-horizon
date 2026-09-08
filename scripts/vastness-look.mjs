import { chromium } from "@playwright/test";
import fs from "node:fs/promises";
const browser = await chromium.launch({
  channel: process.env.QA_BROWSER || "chrome",
  headless: true,
});
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } }),
  errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});
await page.goto((process.env.QA_URL || "http://localhost:3000") + "/?qa=1");
await page.locator("main[data-ready=true]").waitFor({ timeout: 90000 });
await page.waitForTimeout(4000);
await page.keyboard.press("Escape");
await fs.mkdir("artifacts", { recursive: true });
await page.screenshot({ path: "artifacts/vastness-opening.png" });
if (process.env.QA_POSTER === "1") {
  // Element screenshots also include intersecting DOM. Hide it only for this capture.
  await page.locator(".universe-canvas canvas").screenshot({
    path: "public/poster.jpg",
    type: "jpeg",
    quality: 86,
    style:
      ".vastness > :not(.universe-canvas) { visibility: hidden !important; }",
  });
}
console.log(
  JSON.stringify(await page.evaluate(() => window.__vastness.inspect())),
);
if (process.env.QA_TOUR === "1")
  for (const [name, id] of [
    ["The Silent Giant", "giant"],
    ["The Wound", "wound"],
    ["The Cathedral", "cathedral"],
    ["The Bloom", "bloom"],
  ]) {
    await page.getByRole("button", { name: "PLACES", exact: false }).click();
    await page.getByRole("button", { name: new RegExp(name) }).click();
    await page.waitForTimeout(24000);
    await page.screenshot({ path: `artifacts/vastness-${id}.png` });
    console.log(
      id,
      JSON.stringify(await page.evaluate(() => window.__vastness.inspect())),
    );
  }
console.log("ERRORS", errors);
await browser.close();
if (errors.length) process.exitCode = 1;
