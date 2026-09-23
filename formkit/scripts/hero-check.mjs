/**
 * Assert the landing hero actually moves.
 *
 *   npm run preview
 *   npm run hero-check
 *
 * The floating form parts and the pill in the headline bob on their own clock
 * and lean toward the pointer. All of that is written straight to the DOM from
 * a rAF loop, so nothing about it is visible in the markup: the elements are
 * there and correctly styled whether or not a single line of the motion was
 * ever ported. They were, once, and it was not.
 */
import { chromium } from "playwright";

const base = process.env.FK_BASE || "http://localhost:3001";
const executablePath = process.env.FK_CHROMIUM || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";

const browser = await chromium.launch({
  executablePath,
  args: ["--no-sandbox", "--ignore-certificate-errors", "--disable-http2"],
});
// Above 1100px: below it the floaters are deliberately hidden.
const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } });

let failures = 0;
const report = (label, ok, detail) => {
  if (!ok) failures++;
  console.log(`${ok ? "✓" : "✗"} ${label.padEnd(44)}${detail ? "  " + detail : ""}`);
};

const page = await context.newPage();
await page.goto(base + "/", { waitUntil: "load" });
await page.waitForTimeout(1500);

const count = await page.locator("[data-float]").count();
report("the hero carries floating parts", count >= 6, `${count} found`);

const transformOf = (n) =>
  page.locator("[data-float]").nth(n).evaluate((el) => el.style.transform || "");

// It bobs: the same element, two moments apart, is not in the same place.
const a = await transformOf(1);
await page.waitForTimeout(700);
const b = await transformOf(1);
report("they bob on their own clock", a !== "" && a !== b, a === b ? `stuck at "${a}"` : "");

// It leans: the pointer on the left and on the right tilt it opposite ways.
const rotateY = (t) => {
  const m = /rotateY\((-?[\d.]+)deg\)/.exec(t);
  return m ? parseFloat(m[1]) : null;
};
await page.mouse.move(200, 500);
await page.waitForTimeout(250);
const left = rotateY(await transformOf(1));
await page.mouse.move(1400, 500);
await page.waitForTimeout(250);
const right = rotateY(await transformOf(1));
report(
  "they lean toward the pointer",
  left !== null && right !== null && left < 0 && right > 0,
  `left=${left} right=${right}`,
);

// The tilt is real 3D, so the stage needs its perspective.
const perspective = await page
  .locator(".fk-floaties")
  .evaluate((el) => getComputedStyle(el).perspective);
report("the stage has perspective", perspective !== "none", perspective);

// The word in the headline leans with everything else.
const pill = await page.locator(".fk-hero-pill").evaluate((el) => el.style.transform || "");
report("the headline's pill moves too", pill.includes("rotateY"), pill.slice(0, 48));

await page.close();

// Nothing should move for anyone who asked for less motion.
const still = await context.newPage();
await still.emulateMedia({ reducedMotion: "reduce" });
await still.goto(base + "/", { waitUntil: "load" });
await still.waitForTimeout(900);
const x = await still.locator("[data-float]").nth(1).evaluate((el) => el.style.transform || "");
await still.waitForTimeout(600);
const y = await still.locator("[data-float]").nth(1).evaluate((el) => el.style.transform || "");
report("reduced motion leaves them still", x === y, x === y ? "" : `${x} -> ${y}`);
await still.close();

await browser.close();
console.log(failures ? `\n${failures} check(s) failed.` : "\nThe hero moves.");
process.exit(failures ? 1 : 0);
