import { chromium, expect } from "@playwright/test";
import fs from "node:fs/promises";
const browser = await chromium.launch({ channel: process.env.QA_BROWSER || "chrome", headless: true });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true, locale: "ko-KR", reducedMotion: "reduce" });
const page = await context.newPage(), errors = [], checks = [];
const base = process.env.QA_URL || "http://localhost:4173";
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => { if (m.type() === "error") { errors.push(m.text()); console.log("ERROR", m.text()); } });
const check = (name, ok) => { checks.push({ name, passed: Boolean(ok) }); expect(ok, name).toBeTruthy(); console.log("PASS", name); };
const read = () => page.evaluate(() => window.__vastness.inspect());
try {
  await fs.mkdir("artifacts", { recursive: true });
  await page.goto(base + "/?qa=1");
  await page.locator("main[data-ready=true]").waitFor({ timeout: 120000 });
  await page.locator('[data-step="welcome"]').waitFor();
  await page.screenshot({ path: "artifacts/onboarding-mobile-welcome.png" });
  check("Portrait welcome stays inside the viewport", await page.locator(".arrival-guide").evaluate((e) => { const r = e.getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth && r.top > 65 && r.bottom < innerHeight - 85; }));
  await page.getByRole("button", { name: /움직이는 법 알아보기/ }).tap();
  const cdp = await context.newCDPSession(page);
  const touch = (type, points) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: points.map(([id, x, y]) => ({ id, x, y, radiusX: 6, radiusY: 6, force: 1 })) });
  check("Touch guide uses touch-specific instructions", await page.getByText("화면 오른쪽에서 손가락을 움직이면 주위를 둘러볼 수 있어요.", { exact: true }).isVisible());
  await touch("touchStart", [[1, 280, 480]]);
  await touch("touchMove", [[1, 350, 455]]);
  await touch("touchEnd", []);
  await page.locator('[data-step="move"]').waitFor();
  check("Right thumb advances the actual look step", (await read()).learning.look > 0.075);
  await touch("touchStart", [[1, 75, 540]]);
  await touch("touchMove", [[1, 75, 475]]);
  await page.waitForTimeout(1400);
  await touch("touchEnd", []);
  await page.locator('[data-step="speed"]').waitFor();
  check("Left thumb movement advances the move step", (await read()).learning.move > 1.5);
  await page.screenshot({ path: "artifacts/onboarding-mobile-guide.png" });
  await touch("touchStart", [[1, 150, 500], [2, 250, 500]]);
  await touch("touchMove", [[1, 130, 500], [2, 270, 500]]);
  await touch("touchMove", [[1, 100, 500], [2, 300, 500]]);
  await touch("touchEnd", []);
  await page.locator('[data-step="done"]').waitFor();
  check("Two-finger spread completes speed instruction", (await read()).learning.speed > 0.05);
  await page.getByRole("button", { name: "여기 머물기" }).tap();
  for (const spec of [{ width: 390, height: 844 }, { width: 844, height: 390 }, { width: 1024, height: 768 }, { width: 1366, height: 768 }]) {
    await page.setViewportSize(spec); await page.waitForTimeout(250);
    check(`${spec.width}x${spec.height} has no overflow`, await page.evaluate(() => document.documentElement.scrollWidth === innerWidth));
    check(`${spec.width}x${spec.height} central canvas is unobstructed`, await page.evaluate(() => document.elementFromPoint(innerWidth / 2, innerHeight / 2)?.tagName === "CANVAS"));
    await page.getByRole("button", { name: "쉼터와 행성 둘러보기" }).tap();
    if (await page.getByRole("button", { name: "다른 행성과 먼 우주", exact: true }).count()) await page.getByRole("button", { name: "다른 행성과 먼 우주", exact: true }).tap();
    await page.locator('[data-destination="bloom"]').scrollIntoViewIfNeeded();
    check(`${spec.width}x${spec.height} every destination remains reachable`, await page.locator('[data-destination="bloom"]').isVisible());
    await page.getByRole("button", { name: "패널 닫기" }).tap();
  }
  check("No touch guide runtime errors", errors.length === 0);
} finally {
  await fs.writeFile("artifacts/touch-guide-qa.json", JSON.stringify({ url: base, checks, errors }, null, 2));
  await browser.close();
}
