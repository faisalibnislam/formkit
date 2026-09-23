/**
 * Assert that every menu and dropdown actually paints on top.
 *
 *   npm run preview
 *   npm run menu-check
 *
 * A menu can have the highest z-index in the stylesheet and still be buried:
 * any ancestor between it and the page that carries a z-index of its own makes
 * a stacking context, and the menu is then trapped inside it. That is not
 * visible in the markup and it is not visible in the CSS — the only honest test
 * is to open the thing and ask the browser what is actually at that point.
 */
import { chromium } from "playwright";

const base = process.env.FK_BASE || "http://localhost:3001";
const executablePath = process.env.FK_CHROMIUM || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";

/** Each case opens one overlay and names the element it should end up inside. */
const CASES = [
  {
    name: "account menu",
    route: "/app",
    open: async (p) => p.locator(".fk-avatarpill").click(),
    menu: ".fk-menu",
  },
  {
    name: "publish menu, over the dock",
    route: "/app/forms/f1",
    open: async (p) => p.locator('button[aria-label="More form actions"]').click(),
    menu: ".fk-menu",
  },
  {
    name: "sort dropdown, forms",
    route: "/app/forms",
    open: async (p) => p.locator('.ui-select-trigger').first().click(),
    menu: ".ui-select-menu",
  },
  {
    name: "filter dropdown, responses",
    route: "/app/responses",
    open: async (p) => p.locator('.ui-select-trigger').first().click(),
    menu: ".ui-select-menu",
  },
  {
    name: "field type dropdown, inspector",
    route: "/app/forms/f1",
    open: async (p) => {
      await p.locator(".fk-qcard").first().click();
      await p.waitForTimeout(400);
      await p.locator(".ui-select-trigger").first().click();
    },
    menu: ".ui-select-menu",
  },
  {
    name: "font menu, opening upward under the dock",
    route: "/app/forms/f1?tab=design",
    open: async (p) => {
      await p.getByRole("tab", { name: "Type" }).click();
      await p.waitForTimeout(300);
      await p.getByRole("button", { name: "Heading font" }).click();
    },
    menu: ".ui-select-menu",
  },
];

const browser = await chromium.launch({
  executablePath,
  args: ["--no-sandbox", "--ignore-certificate-errors", "--disable-http2"],
});
const context = await browser.newContext({ viewport: { width: 1600, height: 1200 } });

let failures = 0;

for (const c of CASES) {
  const page = await context.newPage();
  await page.goto(base + c.route, { waitUntil: "load" });
  await page.waitForTimeout(2200);

  let detail = "";
  let ok = false;
  try {
    await c.open(page);
    await page.waitForTimeout(500);
    const menu = page.locator(c.menu).first();
    await menu.waitFor({ state: "visible", timeout: 4000 });

    // Sample the menu's own points and ask what the browser would hand a click.
    const result = await menu.evaluate((el) => {
      const r = el.getBoundingClientRect();
      const points = [
        [r.left + r.width / 2, r.top + 12],
        [r.left + r.width / 2, r.top + r.height / 2],
        [r.left + r.width / 2, r.bottom - 12],
      ];
      for (const [x, y] of points) {
        const hit = document.elementFromPoint(x, y);
        if (!hit || !el.contains(hit)) {
          return {
            ok: false,
            covering: hit
              ? `${hit.tagName.toLowerCase()}.${String(hit.className).split(" ")[0]}`
              : "nothing",
            at: `${Math.round(x)},${Math.round(y)}`,
          };
        }
      }
      return { ok: true };
    });
    ok = result.ok;
    detail = result.ok ? "" : `covered by ${result.covering} at ${result.at}`;
  } catch (e) {
    detail = String(e).split("\n")[0].slice(0, 90);
  }

  if (!ok) failures++;
  console.log(`${ok ? "✓" : "✗"} ${c.name.padEnd(34)}${detail ? "  " + detail : ""}`);
  await page.close();
}

await browser.close();
console.log(failures ? `\n${failures} menu(s) are painted over.` : "\nEvery menu is on top.");
process.exit(failures ? 1 : 0);
