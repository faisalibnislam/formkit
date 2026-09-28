/**
 * Render every application screen and write it to `preview-shots/`.
 *
 * Run `npm run preview` first - this drives that server, so the screens are
 * drawn from the fixtures in `scripts/preview/` rather than from a backend.
 * It reports console errors and horizontal overflow alongside each shot,
 * because both are invisible in a screenshot and fatal in the product.
 *
 *   npm run preview
 *   npm run shots
 *   npm run shots -- --width 430          # the narrow layout
 *
 * Each screen gets a fresh page, and the dev server's own noise is filtered:
 * `next dev` pushes a hot-reload down its socket while a page is still
 * initialising and reports the result as a router or mount fault. The stack is
 * entirely inside Next (`hmrRefresh` → `processMessage`), it lands on a
 * different screen every run, and none of it happens in a production build.
 */

/* Errors that come from the dev server rather than from the page. */
const DEV_NOISE = [
  /Router action dispatched before initialization/,
  /state update on a component that hasn't mounted yet/,
  /Failed to load resource.*favicon/,
  /WebSocket/,
];
const isNoise = (text) => DEV_NOISE.some((re) => re.test(text));
import { mkdirSync } from "node:fs";
import { chromium } from "playwright";

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? fallback : args[i + 1];
};

const base = flag("base", "http://localhost:3001");
const out = flag("out", "preview-shots");
const width = Number(flag("width", 1600));
const height = Number(flag("height", 1000));
const only = flag("only", null);
/* The sandbox is UTC and nearly no reader is. A screen that server-renders
   anything from a clock hydrates into a mismatch that only shows in another
   timezone, so the sweep runs somewhere else by default. */
const timezoneId = flag("tz", "Pacific/Auckland");

const SCREENS = [
  ["dashboard", "/app"],
  ["forms", "/app/forms"],
  ["builder", "/app/forms/f1"],
  ["builder-design", "/app/forms/f1?tab=design"],
  ["builder-logic", "/app/forms/f1?tab=logic"],
  ["builder-settings", "/app/forms/f1?tab=settings"],
  ["responses", "/app/responses"],
  ["analytics", "/app/analytics"],
  ["templates", "/app/templates"],
  ["settings", "/app/settings"],
  ["settings-companies", "/app/settings?tab=companies"],
  ["ask", "/app/ask"],
  ["admin", "/admin"],
];

// Playwright's bundled revision is not always the one this image ships.
const executablePath = process.env.FK_CHROMIUM || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";

mkdirSync(out, { recursive: true });

const browser = await chromium.launch({
  executablePath,
  args: ["--no-sandbox", "--ignore-certificate-errors", "--disable-http2"],
});
const context = await browser.newContext({ viewport: { width, height }, timezoneId });

let bad = 0;
for (const [name, route] of SCREENS) {
  if (only && !name.includes(only)) continue;

  const page = await context.newPage();
  const errors = [];
  page.on("console", (m) => {
    if (m.type() === "error" && !isNoise(m.text())) errors.push(m.text().slice(0, 200));
  });
  page.on("pageerror", (e) => {
    if (!isNoise(String(e))) errors.push("threw: " + String(e).slice(0, 200));
  });

  // `load`, not `domcontentloaded`: navigating again mid-hydration makes Next's
  // dev router throw "action dispatched before initialization", which reads as
  // a fault in the page rather than in this script.
  await page.goto(base + route, { waitUntil: "load" });
  await page.waitForTimeout(Number(process.env.FK_SETTLE || 2200));
  await page.screenshot({ path: `${out}/${name}.png` });

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );

  await page.close();

  const notes = [];
  if (overflow > 0) notes.push(`overflows ${overflow}px`);
  if (errors.length) notes.push(`${errors.length} console errors`);
  if (notes.length) bad++;
  console.log(`${notes.length ? "✗" : "✓"} ${name.padEnd(20)} ${route}${notes.length ? " - " + notes.join(", ") : ""}`);
  for (const e of errors.slice(0, 3)) console.log(`    ${e}`);
}

await browser.close();
console.log(
  bad
    ? `\n${bad} screen(s) need attention.`
    : `\nAll screens clean (in ${timezoneId}).`,
);
