/**
 * Assert the builder's drag-and-drop, against a real browser.
 *
 *   npm run preview
 *   npm run drag-check
 *
 * This exists because "the handlers are wired" is not the same as "it drags",
 * and the difference shipped once already. Dispatching DragEvents by hand
 * proves nothing: it skips the browser's own decision about whether a drag may
 * begin, which is where the bugs were. Every case below drives the real thing
 * and checks the order that comes out the other side.
 */
import { chromium } from "playwright";

const base = process.env.FK_BASE || "http://localhost:3001";
const form = process.env.FK_FORM || "f1";
const executablePath = process.env.FK_CHROMIUM || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";

/** The fixture's blocks, in the order `scripts/preview/fixtures.ts` lists them. */
const START = ["b1", "b2", "b3", "b4", "b5", "b6"];
/** Which of those are question cards - a page break is not one. */
const CARDS = ["b1", "b2", "b4", "b5", "b6"];

/** Where the blocks end up when the block at `from` is dropped on `slot`. */
function expectedOrder(fromId, slot) {
  const from = START.indexOf(fromId);
  const rest = START.filter((id) => id !== fromId);
  const to = from < slot ? slot - 1 : slot;
  if (to === from) return null; // already there: the drop is a no-op
  rest.splice(to, 0, fromId);
  return rest;
}

const browser = await chromium.launch({
  executablePath,
  args: ["--no-sandbox", "--ignore-certificate-errors", "--disable-http2"],
});
/* Tall enough that every insert point and its source card are on screen at
   once: scrolling mid-drag moves the target out from under the pointer, and
   the run then fails for a reason that has nothing to do with the app. */
const context = await browser.newContext({ viewport: { width: 1600, height: 2200 } });

let failures = 0;

async function open() {
  const page = await context.newPage();
  const seen = { reorder: null, add: null, threw: null };
  await page.exposeFunction("__fkSeen", (kind, args) => {
    seen[kind] = args;
  });
  page.on("pageerror", (e) => {
    seen.threw = String(e).slice(0, 160);
  });
  await page.goto(`${base}/app/forms/${form}`, { waitUntil: "load" });
  await page.waitForTimeout(2200);
  // The preview shim logs every mutation; that is the signal here.
  await page.evaluate(() => {
    const info = console.info.bind(console);
    console.info = (...a) => {
      if (String(a[0]).includes("mutation")) {
        if (a[1] === "blocks:reorder") window.__fkSeen("reorder", a[2]);
        if (a[1] === "blocks:add") window.__fkSeen("add", a[2]);
      }
      info(...a);
    };
  });
  return { page, seen };
}

function report(label, ok, detail) {
  if (!ok) failures++;
  console.log(`${ok ? "✓" : "✗"} ${label.padEnd(42)}${detail ? "  " + detail : ""}`);
}

/** Drop a question card on an insert point and check the order it produces. */
async function move(cardIndex, slot) {
  const id = CARDS[cardIndex];
  const want = expectedOrder(id, slot);
  const { page, seen } = await open();
  const source = page.locator(".fk-qcard").nth(cardIndex);
  await source.scrollIntoViewIfNeeded();
  await page.waitForTimeout(150);
  await source.dragTo(page.locator(".fk-insert").nth(slot));
  await page.waitForTimeout(700);
  const got = seen.reorder?.ids ?? null;
  const label = want
    ? `move ${id} to slot ${slot}`
    : `move ${id} to slot ${slot} (no-op)`;
  const ok = want ? got?.join(",") === want.join(",") : got === null;
  report(label, ok, seen.threw ?? (want ? `got ${got?.join(",") ?? "nothing"}` : ""));
  await page.close();
}

console.log("Builder drag and drop\n");

// Reordering, in both directions and across a page break.
await move(0, 2);
await move(0, 4);
await move(0, 6);
await move(3, 0);
// Dropping a card back where it already is changes nothing.
await move(0, 1);

// A field type dragged in from the library lands at the slot it was dropped on.
{
  const { page, seen } = await open();
  await page.locator(".fk-fieldtile").first().dragTo(page.locator(".fk-insert").nth(3));
  await page.waitForTimeout(700);
  report("library tile to slot 3", seen.add?.at === 3, `at=${seen.add?.at}`);
  await page.close();
}

// A page break reorders like anything else.
{
  const { page, seen } = await open();
  // By its grip: the middle of a page break is its name, which is a text field.
  await page.locator(".fk-pagebreak .fk-pagebreak-grip").first().dragTo(page.locator(".fk-insert").nth(0));
  await page.waitForTimeout(700);
  report("page break to slot 0", seen.reorder?.ids?.[0] === "b3", `first=${seen.reorder?.ids?.[0]}`);
  await page.close();
}

// A press that lands on a control is that control's, not the card's.
{
  const { page, seen } = await open();
  const card = page.locator(".fk-qcard").first();
  await card.hover();
  await card.locator('button[aria-label="Delete this question"]').dragTo(page.locator(".fk-insert").nth(4));
  await page.waitForTimeout(700);
  report("a drag from the delete button is refused", seen.reorder === null);
  await page.close();
}

// Clicking still works, for anyone who does not drag: the insert point opens
// the field picker, and what is picked lands at that point.
{
  const { page, seen } = await open();
  const slot = page.locator(".fk-insert").nth(1);
  await slot.evaluate((el) => el.scrollIntoView({ block: "center" }));
  await slot.hover();
  await page.waitForTimeout(350);
  await slot.locator(".fk-insert-pill").click();
  await page.locator(".fk-picker").waitFor({ state: "visible", timeout: 3000 });
  await page.locator(".fk-picker .fk-fieldtile").nth(1).click();
  await page.waitForTimeout(600);
  report("the insert point's picker adds a field", seen.add?.at === 1, `at=${seen.add?.at}`);
  await page.close();
}

// A card's lower half drops after it; its upper half before it.
for (const [target, half, slot] of [
  [3, "lower", 5],
  [3, "upper", 4],
]) {
  const { page, seen } = await open();
  const dest = page.locator(".fk-qcard").nth(target);
  const box = await dest.boundingBox();
  const y = half === "lower" ? box.height * 0.8 : box.height * 0.2;
  await page.locator(".fk-qcard").nth(0).dragTo(dest, { targetPosition: { x: box.width / 2, y } });
  await page.waitForTimeout(700);
  const want = expectedOrder("b1", slot);
  const got = seen.reorder?.ids ?? null;
  report(`drop on the ${half} half of card ${target}`, got?.join(",") === want.join(","), `got ${got?.join(",") ?? "nothing"}`);
  await page.close();
}

// Move down swaps with the next block, for anyone who cannot drag at all.
{
  const { page, seen } = await open();
  const card = page.locator(".fk-qcard").first();
  await card.hover();
  await card.locator('button[aria-label="Move down"]').click();
  await page.waitForTimeout(600);
  report("move down swaps with the next block", seen.reorder?.ids?.slice(0, 2).join(",") === "b2,b1", `got ${seen.reorder?.ids?.join(",") ?? "nothing"}`);
  await page.close();
}

await browser.close();
console.log(failures ? `\n${failures} check(s) failed.` : "\nAll drag checks passed.");
process.exit(failures ? 1 : 0);
