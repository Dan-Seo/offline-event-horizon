import { chromium } from "@playwright/test";
import fs from "node:fs/promises";
import { enterEnglishExperience } from "./qa-entry.mjs";
const browser = await chromium.launch({
  channel: process.env.QA_BROWSER || "chrome",
  headless: true,
});
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } }),
  errors = [];
page.on("console", (m) => {
  if (["error", "warning"].includes(m.type())) errors.push(m.text());
  console.log(m.type(), m.text());
});
page.on("pageerror", (e) => {
  errors.push(e.message);
  console.log("PAGEERROR", e.message);
});
try {
  await page.goto(
    (process.env.QA_URL || "http://localhost:3000") +
      "/?qa=1" +
      (process.env.QA_BACKEND === "webgl"
        ? "&backend=webgl&quality=BATTERY"
        : ""),
  );
  await page.locator("main[data-ready=true]").waitFor({ timeout: 60000 });
  await enterEnglishExperience(page);
  await page.waitForTimeout(3000);
  await page.keyboard.press("Escape");
  await fs.mkdir("artifacts", { recursive: true });
  await page.screenshot({ path: "artifacts/sanctuary-opening.png" });
  if (process.env.QA_POSTER === "1") {
    await page
      .locator(".universe-canvas canvas")
      .screenshot({ path: "public/poster.jpg", type: "jpeg", quality: 90 });
  }
  console.log(
    "STATE",
    JSON.stringify(await page.evaluate(() => window.__vastness?.inspect())),
  );
} finally {
  await browser.close();
}
if (errors.length) process.exitCode = 1;
