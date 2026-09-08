import { chromium } from "@playwright/test";
import fs from "node:fs/promises";
await fs.mkdir("artifacts", { recursive: true });
const browser = await chromium.launch({
  channel: "chrome",
  headless: true,
  args: ["--enable-unsafe-webgpu"],
});
const page = await browser.newPage({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 1,
});
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});
await page.goto(process.argv[2] || "http://localhost:3000");
await page.waitForTimeout(9000);
await page.screenshot({ path: "artifacts/office-first.png" });
console.log(
  JSON.stringify(
    { errors, text: await page.locator("body").innerText() },
    null,
    2,
  ),
);
await browser.close();
