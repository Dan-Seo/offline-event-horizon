import { chromium, expect } from "@playwright/test";
import fs from "node:fs/promises";
import { enterEnglishExperience } from "./qa-entry.mjs";
const browser = await chromium.launch({
  channel: process.env.QA_BROWSER || "chrome",
  headless: true,
});
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } }),
  errors = [],
  samples = [];
page.on("pageerror", (e) => {
  errors.push(e.message);
  console.log("ERROR", e.message);
});
page.on("console", (m) => {
  if (m.type() === "error") {
    errors.push(m.text());
    console.log("ERROR", m.text());
  }
});
const get = () => page.evaluate(() => window.__vastness.inspect());
const place = process.env.QA_PLACE || "last-light";
const fallback = process.env.QA_BACKEND === "webgl";
const artifact = `sanctuary-${place}${fallback ? "-webgl" : ""}`;
const titles = {
  moonfall: "Moonfall",
  forest: "The Breathing Forest",
  veil: "The Veil",
  "living-sky": "The Living Sky",
};
try {
  await page.goto(
    (process.env.QA_URL || "http://localhost:3000") +
      "/?qa=1" +
      (fallback ? "&backend=webgl&quality=BATTERY" : ""),
  );
  await page.locator("main[data-ready=true]").waitFor({ timeout: 120000 });
  await enterEnglishExperience(page);
  if (titles[place]) {
    await page
      .getByRole("button", { name: "Comfort settings", exact: true })
      .click();
    await page.getByRole("button", { name: /Find somewhere quiet/ }).click();
    await page
      .getByRole("button", { name: new RegExp("^" + titles[place]) })
      .click();
    await page.waitForTimeout(500);
    expect((await get()).mode).toBe("TRAVEL");
    await page.waitForFunction(
      () => window.__vastness.inspect().mode === "FREE",
      {},
      { timeout: 60000 },
    );
  }
  await fs.mkdir("artifacts", { recursive: true });
  console.log("ARRIVED", place, JSON.stringify(await get()));
  await page.screenshot({ path: `artifacts/${artifact}-arrival.png` });
  for (let i = 0; i < Number(process.env.QA_OBSERVATIONS || 7); i++) {
    await page.waitForTimeout(10000);
    const s = await get();
    samples.push({
      time: s.time,
      mode: s.mode,
      event: s.beautyEvent,
      eventTime: s.beautyEventTime,
      stillness: s.stillness,
      fps: s.fps,
      frameMs: s.frameMs,
      position: s.position,
    });
    console.log("OBSERVE", place, JSON.stringify(samples.at(-1)));
    if (i === 3 || i === 6)
      await page.screenshot({
        path: `artifacts/${artifact}-${i === 3 ? "quiet" : "gift"}.png`,
      });
  }
  expect(errors).toEqual([]);
  await fs.writeFile(
    `artifacts/${artifact}.json`,
    JSON.stringify({ url: page.url(), samples, errors }, null, 2),
  );
} finally {
  await browser.close();
}
