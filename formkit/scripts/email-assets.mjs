/**
 * The images the emails show, drawn from the same artwork as the site.
 *
 *   node scripts/email-assets.mjs
 *
 * Email clients cannot be trusted with SVG or CSS gradients, so the logo and
 * the night sky are rendered to PNGs in public/email/ and served from the
 * site. Everything is drawn at 4× (the sky at 2×) so it stays sharp on a
 * retina screen. Re-run this if the logo or the sky ever changes.
 */
import { readFileSync, mkdirSync } from "fs";
import sharp from "sharp";

const out = new URL("../public/email/", import.meta.url);
mkdirSync(out, { recursive: true });

const src = readFileSync(new URL("../src/components/brand/logo-paths.ts", import.meta.url), "utf8");
const pick = (name) => JSON.parse(src.match(new RegExp(`export const ${name} = (\\[[^\\]]*\\])`))[1]);
const MARK = pick("MARK");
const WORD = pick("WORD");

const INK = "#21282E";

async function logo(file, { paths, viewBox, color, height }) {
  const [, , w, h] = viewBox.split(" ").map(Number);
  const width = Math.round((height * w) / h);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" width="${width}" height="${height}">${paths
    .map((d) => `<path d="${d}" fill="${color}"/>`)
    .join("")}</svg>`;
  await sharp(Buffer.from(svg)).png().toFile(new URL(file, out).pathname);
  console.log(file, `${width}×${height}`);
}

// The full logo is shown 26px tall, the mark 22px.
await logo("logo-white.png", { paths: [...MARK, ...WORD], viewBox: "0 0 4076 763", color: "#ffffff", height: 104 });
await logo("logo-ink.png", { paths: [...MARK, ...WORD], viewBox: "0 0 4076 763", color: INK, height: 104 });
await logo("mark-ink.png", { paths: MARK, viewBox: "0 0 903 763", color: INK, height: 88 });

/* The landing page's night sky (styles/sky.css), still: the same gradient,
   the two washes and a scatter of stars, placed the same way every time. */
const W = 1200;
const H = 560;
let seed = 7;
const rand = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
const stars = Array.from({ length: 70 }, () => {
  const y = rand() * H * 0.78;
  const r = 0.7 + rand() * 1.5;
  const a = (0.25 + rand() * 0.6) * (1 - y / H);
  return `<circle cx="${(rand() * W).toFixed(1)}" cy="${y.toFixed(1)}" r="${r.toFixed(2)}" fill="#fff" fill-opacity="${a.toFixed(2)}"/>`;
}).join("");
const sky = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#062a52"/><stop offset=".2" stop-color="#0a3d6f"/>
      <stop offset=".42" stop-color="#115791"/><stop offset=".64" stop-color="#1c74b0"/>
      <stop offset=".84" stop-color="#3693ca"/><stop offset="1" stop-color="#59acd9"/>
    </linearGradient>
    <radialGradient id="top" cx=".5" cy="-.16" r=".8" gradientTransform="translate(.5 -.16) scale(1.2 .96) translate(-.5 .16)">
      <stop offset="0" stop-color="#60aade" stop-opacity=".34"/><stop offset=".66" stop-color="#0a2850" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="bottom" cx=".6" cy="1.2" r=".8" gradientTransform="translate(.6 1.2) scale(1.26 .74) translate(-.6 -1.2)">
      <stop offset="0" stop-color="#a8daf3" stop-opacity=".6"/><stop offset=".66" stop-color="#7ac0e7" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="foot" x1="0" y1="1" x2="0" y2="0">
      <stop offset="0" stop-color="#70b2de" stop-opacity=".5"/><stop offset=".48" stop-color="#70b2de" stop-opacity=".18"/>
      <stop offset="1" stop-color="#70b2de" stop-opacity="0"/>
    </linearGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#g)"/>
  <rect width="${W}" height="${H}" fill="url(#top)"/>
  <rect width="${W}" height="${H}" fill="url(#bottom)"/>
  <rect y="${H * 0.48}" width="${W}" height="${H * 0.52}" fill="url(#foot)"/>
  ${stars}
</svg>`;
await sharp(Buffer.from(sky)).jpeg({ quality: 84, mozjpeg: true }).toFile(new URL("sky.jpg", out).pathname);
console.log("sky", `${W}×${H}`);
