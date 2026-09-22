/**
 * Screenshot a running page and report console errors and horizontal overflow.
 *
 *   npm run dev
 *   node scripts/screenshot.mjs http://localhost:3000/pricing out.png 1440 1000
 *
 * Arguments: url, output path, viewport width, viewport height, full-page (1/0).
 */
import { chromium } from "playwright";

const [url, out, w = "1440", h = "1000", full = "1"] = process.argv.slice(2);

if (!url || !out) {
  console.error("Usage: node scripts/screenshot.mjs <url> <out.png> [width] [height] [full]");
  process.exit(1);
}

const browser = await chromium.launch({
  // Chromium is pre-installed in this environment; fall back to Playwright's own.
  executablePath: process.env.CHROMIUM_PATH || "/opt/pw-browsers/chromium",
});
const page = await browser.newPage({ viewport: { width: +w, height: +h } });

const errors = [];
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});
page.on("pageerror", (e) => errors.push(String(e)));

await page.goto(url, { waitUntil: "networkidle", timeout: 60000 });
await page.waitForTimeout(1200);
await page.screenshot({ path: out, fullPage: full === "1" });

console.log("console errors:", errors.length ? errors.slice(0, 8) : "none");
console.log(
  "horizontal overflow px:",
  await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  ),
);

await browser.close();
