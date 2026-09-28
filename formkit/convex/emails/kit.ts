/**
 * The one design every Formkit email is built from.
 *
 * Formkit's own mail wears the landing page: the night sky across the top of
 * the card with the white logo on it, the heading in white beneath, then a
 * white card, ink pill buttons, pale panels and the mark in the footer.
 *
 * Mail sent for a customer — the confirmation somebody gets after answering
 * their form — wears the customer's brand instead: their logo or name, their
 * colour on the buttons, and a small "Made with Formkit" unless their company
 * has switched that credit off.
 *
 * Email is written like it is 2005 on purpose: tables for layout, inline
 * styles, images for the logo and the sky (no SVG, no CSS gradients), a solid
 * colour behind every image so nothing is lost when images are off, and a
 * single <style> block only for the phone-width tweaks. The images live in
 * public/email/, drawn by scripts/email-assets.mjs.
 */

const SITE = process.env.SITE_URL ?? "https://formkit.app";
const ASSETS = `${SITE}/email`;

export const C = {
  ink: "#21282E",
  body: "#3a3f44",
  muted: "#6d747a",
  faint: "#8d949b",
  ring: "#e4ebf1",
  panel: "#f5f8fb",
  page: "#eef4fa",
  night: "#0f4c85",
  blue50: "#eaf3fb",
  blue100: "#d8e9f7",
  blue600: "#2e78bb",
  green: "#78c86f",
};

const FONT = "'Outfit',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif";

export function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
const e = escapeHtml;

/** The customer's identity, for mail sent on their behalf. */
export type Brand = {
  name: string;
  logoUrl: string | null;
  color: string | null;
  /** The "Made with Formkit" credit. */
  badge: boolean;
};

type Shell = {
  heading: string;
  /** The line an inbox shows beside the subject. Defaults to the lede. */
  preheader?: string;
  /** A small label above the heading: "Sign-in code", "New response". */
  eyebrow?: string;
  lede?: string;
  body: string;
  /** Why this email arrived. */
  reason?: string;
  /** Links in the footer, e.g. to the settings that control this email. */
  links?: { label: string; href: string }[];
  brand?: Brand;
};

/** A colour the customer typed, or nothing if it is not a plain hex. */
export function safeColor(value: string | null | undefined) {
  return value && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(value.trim()) ? value.trim() : null;
}

/** White or ink, whichever reads on the given fill. */
export function inkOn(hex: string) {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.replace(/./g, (c) => c + c) : h;
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16) / 255);
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const lum = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  return lum > 0.45 ? C.ink : "#ffffff";
}

/** A colour mixed toward white: 0 is the colour, 1 is white. */
function tint(hex: string, amount: number) {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.replace(/./g, (c) => c + c) : h;
  return (
    "#" +
    [0, 2, 4]
      .map((i) => {
        const c = parseInt(full.slice(i, i + 2), 16);
        return Math.round(c + (255 - c) * amount)
          .toString(16)
          .padStart(2, "0");
      })
      .join("")
  );
}

export function renderShell({ heading, preheader, eyebrow, lede, body, reason, links, brand }: Shell) {
  const accent = safeColor(brand?.color) ?? C.ink;
  const head = brand ? brandHead(brand, accent, { heading, eyebrow, lede }) : skyHead({ heading, eyebrow, lede });
  const foot = brand ? brandFoot(brand, reason) : formkitFoot(reason, links);
  const preview = preheader ?? lede ?? "";

  return `<!doctype html>
<html lang="en-US" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="x-apple-disable-message-reformatting" />
<meta name="color-scheme" content="light only" />
<meta name="supported-color-schemes" content="light only" />
<title>${e(heading)}</title>
<link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
<style>
  body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
  /* Separate borders: collapsed ones cannot be rounded. */
  table { border-collapse: separate; mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
  img { border: 0; outline: none; text-decoration: none; -ms-interpolation-mode: bicubic; }
  a { color: ${C.blue600}; }
  @media (max-width: 620px) {
    .fk-outer { padding: 12px 8px 28px !important; }
    .fk-pad { padding-left: 24px !important; padding-right: 24px !important; }
    .fk-h1 { font-size: 26px !important; }
    .fk-code { font-size: 34px !important; letter-spacing: 8px !important; }
    .fk-card { border-radius: 22px !important; }
    .fk-sky { border-radius: 22px 22px 0 0 !important; }
  }
</style>
</head>
<body style="margin:0;padding:0;background:${C.page};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all;font-size:1px;line-height:1px;color:${C.page};">${e(preview)}${"&#8199;&#65279;&#847; ".repeat(40)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${C.page}" style="background:${C.page};">
  <tr>
    <td align="center" class="fk-outer" style="padding:32px 16px 40px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="fk-card" style="max-width:600px;background:#ffffff;border-radius:28px;border:1px solid ${C.ring};">
        ${head}
        <tr>
          <td class="fk-pad" style="padding:30px 40px 40px;font-family:${FONT};font-size:15px;line-height:1.6;color:${C.body};">
            ${body}
          </td>
        </tr>
      </table>
      ${foot}
    </td>
  </tr>
</table>
</body>
</html>`;
}

function skyHead({ heading, eyebrow, lede }: { heading: string; eyebrow?: string; lede?: string }) {
  return `<tr>
          <td class="fk-sky fk-pad" background="${ASSETS}/sky.jpg" bgcolor="${C.night}" valign="top" style="padding:30px 40px 36px;border-radius:28px 28px 0 0;background-color:${C.night};background-image:url('${ASSETS}/sky.jpg');background-size:cover;background-position:center top;background-repeat:no-repeat;font-family:${FONT};">
            <a href="${SITE}" style="text-decoration:none;color:#ffffff;"><img src="${ASSETS}/logo-white.png" width="139" height="26" alt="Formkit" style="display:block;width:139px;height:26px;color:#ffffff;font-family:${FONT};font-size:20px;font-weight:600;" /></a>
            ${
              eyebrow
                ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-top:34px;"><tr><td style="padding:6px 13px;border-radius:999px;background:rgba(255,255,255,0.14);border:1px solid rgba(255,255,255,0.24);font-family:${FONT};font-size:12.5px;font-weight:500;line-height:1.2;color:#ffffff;">${e(eyebrow)}</td></tr></table>`
                : `<div style="height:22px;line-height:22px;font-size:1px;">&nbsp;</div>`
            }
            <h1 class="fk-h1" style="margin:${eyebrow ? "16px" : "12px"} 0 0;font-family:${FONT};font-size:30px;line-height:1.15;font-weight:700;letter-spacing:-0.6px;color:#ffffff;">${e(heading)}</h1>
            ${lede ? `<p style="margin:12px 0 0;font-family:${FONT};font-size:15.5px;line-height:1.55;color:#ffffff;color:rgba(255,255,255,0.84);">${e(lede)}</p>` : ""}
          </td>
        </tr>`;
}

function brandHead(brand: Brand, accent: string, { heading, eyebrow, lede }: { heading: string; eyebrow?: string; lede?: string }) {
  const mark = brand.logoUrl
    ? `<img src="${e(brand.logoUrl)}" height="36" alt="${e(brand.name)}" style="display:block;height:36px;width:auto;max-width:200px;font-family:${FONT};font-size:18px;font-weight:600;color:${C.ink};" />`
    : `<div style="font-family:${FONT};font-size:19px;font-weight:600;letter-spacing:-0.3px;color:${C.ink};">${e(brand.name)}</div>`;
  // Their colour, washed almost to white, behind the header — a nod to the
  // brand that keeps the heading readable whatever the colour is.
  const wash = brand.color ? tint(accent, 0.9) : C.panel;
  return `<tr>
          <td class="fk-sky fk-pad" bgcolor="${wash}" style="padding:32px 40px 30px;border-radius:28px 28px 0 0;background:${wash};border-bottom:1px solid ${C.ring};font-family:${FONT};">
            ${mark}
            ${eyebrow ? `<div style="margin-top:28px;font-size:13px;font-weight:500;color:${C.muted};"><span style="display:inline-block;width:8px;height:8px;border-radius:8px;background:${accent};margin-right:8px;vertical-align:1px;"></span>${e(eyebrow)}</div>` : `<div style="height:14px;line-height:14px;font-size:1px;">&nbsp;</div>`}
            <h1 class="fk-h1" style="margin:${eyebrow ? "8px" : "12px"} 0 0;font-family:${FONT};font-size:28px;line-height:1.2;font-weight:700;letter-spacing:-0.5px;color:${C.ink};">${e(heading)}</h1>
            ${lede ? `<p style="margin:12px 0 0;font-family:${FONT};font-size:15.5px;line-height:1.6;color:${C.body};">${e(lede)}</p>` : ""}
          </td>
        </tr>`;
}

function formkitFoot(reason?: string, links?: { label: string; href: string }[]) {
  const all = [...(links ?? []), { label: "Help centre", href: `${SITE}/help` }];
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;">
        <tr>
          <td align="center" style="padding:28px 24px 0;font-family:${FONT};">
            <a href="${SITE}" style="text-decoration:none;"><img src="${ASSETS}/mark-ink.png" width="26" height="22" alt="Formkit" style="display:inline-block;width:26px;height:22px;opacity:0.9;font-family:${FONT};font-size:13px;color:${C.ink};" /></a>
            ${reason ? `<p style="margin:14px 0 0;font-size:13px;line-height:1.6;color:${C.muted};">${e(reason)}</p>` : ""}
            <p style="margin:${reason ? "8px" : "14px"} 0 0;font-size:13px;line-height:1.6;color:${C.muted};">
              ${all.map((l) => `<a href="${e(l.href)}" style="color:${C.ink};text-decoration:none;font-weight:500;">${e(l.label)}</a>`).join(`<span style="color:${C.faint};">&nbsp;&nbsp;·&nbsp;&nbsp;</span>`)}
            </p>
            <p style="margin:8px 0 0;font-size:12px;line-height:1.6;color:${C.faint};">Formkit — forms people actually finish.</p>
          </td>
        </tr>
      </table>`;
}

function brandFoot(brand: Brand, reason?: string) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;">
        <tr>
          <td align="center" style="padding:24px 24px 0;font-family:${FONT};font-size:13px;line-height:1.6;color:${C.muted};">
            ${reason ? `<p style="margin:0;">${e(reason)}</p>` : ""}
            ${
              brand.badge
                ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:16px auto 0;"><tr>
                <td style="padding:7px 14px 7px 12px;border-radius:999px;background:#ffffff;border:1px solid ${C.ring};font-family:${FONT};font-size:12.5px;line-height:1;color:${C.muted};">
                  <a href="${SITE}" style="text-decoration:none;color:${C.muted};"><img src="${ASSETS}/mark-ink.png" width="16" height="14" alt="" style="display:inline-block;width:16px;height:14px;vertical-align:-3px;margin-right:6px;" />Made with <span style="color:${C.ink};font-weight:600;">Formkit</span></a>
                </td></tr></table>`
                : ""
            }
          </td>
        </tr>
      </table>`;
}

/* ---------- Pieces for the body ---------- */

/** A pill button that survives Outlook: the colour is on the cell, not the link. */
export function button(label: string, href: string, color: string = C.ink) {
  const ink = inkOn(color);
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-top:26px;">
  <tr>
    <td bgcolor="${color}" style="border-radius:999px;background:${color};">
      <a href="${e(href)}" style="display:inline-block;padding:14px 26px;border-radius:999px;font-family:${FONT};font-size:15px;font-weight:500;line-height:1.2;color:${ink};text-decoration:none;">${e(label)}&nbsp;&nbsp;&rarr;</a>
    </td>
  </tr>
</table>`;
}

export function paragraph(text: string, opts: { muted?: boolean; top?: number } = {}) {
  return `<p style="margin:${opts.top ?? 0}px 0 0;font-family:${FONT};font-size:${opts.muted ? 13.5 : 15}px;line-height:1.6;color:${opts.muted ? C.muted : C.body};">${e(text)}</p>`;
}

/** A pale rounded panel. */
export function panel(inner: string, opts: { top?: number; pad?: string } = {}) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:${opts.top ?? 0}px;">
  <tr>
    <td bgcolor="${C.panel}" style="padding:${opts.pad ?? "6px 22px"};border-radius:20px;background:${C.panel};border:1px solid ${C.ring};font-family:${FONT};">${inner}</td>
  </tr>
</table>`;
}

/** Question-and-answer rows, as the response inbox shows them. */
export function answers(rows: { question: string; value: string }[], opts: { top?: number } = {}) {
  if (!rows.length) return "";
  const cells = rows
    .map(({ question, value }, i) => {
      const line = i < rows.length - 1 ? `border-bottom:1px solid ${C.ring};` : "";
      return `<tr><td style="padding:14px 0;${line}font-family:${FONT};">
        <div style="font-size:12.5px;line-height:1.5;color:${C.muted};">${e(question)}</div>
        <div style="margin-top:3px;font-size:15px;line-height:1.55;color:${C.ink};white-space:pre-wrap;">${
          value ? e(value) : `<span style="color:${C.faint};">Not answered</span>`
        }</div>
      </td></tr>`;
    })
    .join("");
  return panel(`<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${cells}</table>`, {
    top: opts.top ?? 0,
  });
}

/** Label and value pairs: "Device — Chrome on macOS". */
export function facts(rows: [string, string][], opts: { top?: number } = {}) {
  const cells = rows
    .map(([k, v], i) => {
      const line = i < rows.length - 1 ? `border-bottom:1px solid ${C.ring};` : "";
      return `<tr>
        <td style="padding:13px 0;${line}font-family:${FONT};font-size:13.5px;color:${C.muted};width:38%;" valign="top">${e(k)}</td>
        <td style="padding:13px 0;${line}font-family:${FONT};font-size:15px;color:${C.ink};font-weight:500;" valign="top">${e(v)}</td>
      </tr>`;
    })
    .join("");
  return panel(`<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${cells}</table>`, {
    top: opts.top ?? 0,
  });
}

/** Somebody's own words — a comment, a note on an invitation. */
export function quote(text: string, who?: string, opts: { top?: number } = {}) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:${opts.top ?? 0}px;">
  <tr>
    <td width="4" bgcolor="${C.blue100}" style="width:4px;border-radius:4px;background:${C.blue100};">&nbsp;</td>
    <td style="padding:4px 0 4px 18px;font-family:${FONT};">
      ${who ? `<div style="font-size:13px;font-weight:600;color:${C.ink};margin-bottom:4px;">${e(who)}</div>` : ""}
      <div style="font-size:15.5px;line-height:1.6;color:${C.body};white-space:pre-wrap;">${e(text)}</div>
    </td>
  </tr>
</table>`;
}

/** The six digits, large enough to read across the room, easy to copy. */
export function code(token: string, minutes: number) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
  <tr>
    <td align="center" bgcolor="${C.blue50}" style="padding:26px 16px 22px;border-radius:22px;background:${C.blue50};border:1px solid ${C.blue100};font-family:${FONT};">
      <div class="fk-code" style="font-size:42px;line-height:1;font-weight:500;letter-spacing:12px;color:${C.ink};padding-left:12px;">${e(token)}</div>
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:18px auto 0;"><tr>
        <td style="padding:6px 12px;border-radius:999px;background:#ffffff;font-family:${FONT};font-size:12.5px;line-height:1.2;color:${C.muted};">Expires in ${minutes} minutes</td>
      </tr></table>
    </td>
  </tr>
</table>`;
}

/** A row per form with a figure on the right, for the digests. */
export function list(rows: { title: string; line: string; figure?: string }[], opts: { top?: number } = {}) {
  const cells = rows
    .map((r, i) => {
      const line = i < rows.length - 1 ? `border-bottom:1px solid ${C.ring};` : "";
      return `<tr>
        <td style="padding:14px 0;${line}font-family:${FONT};" valign="middle">
          <div style="font-size:15px;font-weight:500;line-height:1.4;color:${C.ink};">${e(r.title)}</div>
          <div style="margin-top:2px;font-size:13.5px;line-height:1.5;color:${C.muted};">${e(r.line)}</div>
        </td>
        ${
          r.figure
            ? `<td align="right" valign="middle" style="padding:14px 0 14px 12px;${line}font-family:${FONT};white-space:nowrap;">
          <span style="display:inline-block;padding:6px 12px;border-radius:999px;background:#ffffff;border:1px solid ${C.ring};font-size:14px;font-weight:600;color:${C.ink};"><span style="display:inline-block;width:8px;height:8px;border-radius:8px;background:${C.green};margin-right:7px;vertical-align:1px;"></span>${e(r.figure)}</span>
        </td>`
            : ""
        }
      </tr>`;
    })
    .join("");
  return panel(`<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${cells}</table>`, {
    top: opts.top ?? 0,
  });
}

export { SITE as EMAIL_SITE };
