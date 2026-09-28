/**
 * One full-page screenshot of one route, after optional steps.
 *
 *   npm run preview
 *   node scripts/snap.mjs "/app/forms/f1?tab=design" out.png [steps.js|-] [width]
 *
 * `steps.js` is the body of an async function that receives the Playwright
 * page as `p` - click a tab, open a menu - before the picture is taken. Page
 * errors are printed, so a snap doubles as a smoke test of that state.
 */
import { chromium } from "playwright";
import { readFileSync } from "fs";
const [route, out, steps, w] = process.argv.slice(2);
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--no-sandbox", "--disable-http2"] });
const p = await (await b.newContext({ viewport: { width: Number(w || 1500), height: 1000 } })).newPage();
const errs = [];
p.on("pageerror", (e) => errs.push(String(e).slice(0, 200)));
p.on("console", (m) => { if (m.type() === "error" && !/Router action|HMR|Fast Refresh/.test(m.text())) errs.push(m.text().slice(0, process.env.FK_ERRLEN ? Number(process.env.FK_ERRLEN) : 200)); });
await p.goto((process.env.FK_BASE || "http://localhost:3001") + route, { waitUntil: "load" });
await p.waitForTimeout(2200);
if (steps && steps !== "-") { const fn = new Function("p", `return (async () => { ${readFileSync(steps, "utf8")} })()`); await fn(p); }
await p.screenshot({ path: out, fullPage: process.env.FK_FULL !== "0" });
console.log(errs.length ? "ERRORS:\n" + errs.join("\n") : "no errors");
await b.close();
