/**
 * The one email shell Formkit sends everything through.
 *
 * Plain HTML with inline styles — email clients ignore stylesheets. Colours and
 * type mirror the design system: Outfit with a system fallback, `#21282E` ink,
 * `#f7fbff` paper, white card at a generous radius.
 */

const INK = "#21282E";
const PAPER = "#f7fbff";
const MUTED = "#6d747a";
const RING = "#e0e2e4";

type Shell = {
  heading: string;
  lede: string;
  body: string;
  footer?: string;
};

export function renderEmailShell({ heading, lede, body, footer }: Shell) {
  return `<!doctype html>
<html lang="en-US">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(heading)}</title>
  </head>
  <body style="margin:0;padding:0;background:${PAPER};">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${PAPER};padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:28px;box-shadow:0 12px 40px -16px rgba(44,48,52,.10);overflow:hidden;">
            <tr>
              <td style="padding:36px 36px 8px;font-family:'Outfit',Helvetica,Arial,sans-serif;">
                <div style="font-size:15px;font-weight:600;letter-spacing:-.02em;color:${INK};">formkit</div>
              </td>
            </tr>
            <tr>
              <td style="padding:12px 36px 0;font-family:'Outfit',Helvetica,Arial,sans-serif;">
                <h1 style="margin:0;font-size:26px;line-height:1.2;font-weight:700;letter-spacing:-.02em;color:${INK};">${escapeHtml(heading)}</h1>
                <p style="margin:12px 0 0;font-size:15px;line-height:1.6;color:${MUTED};">${escapeHtml(lede)}</p>
              </td>
            </tr>
            <tr>
              <td style="padding:24px 36px 36px;font-family:'Outfit',Helvetica,Arial,sans-serif;">${body}</td>
            </tr>
          </table>
          <div style="max-width:520px;margin:18px auto 0;font-family:'Outfit',Helvetica,Arial,sans-serif;font-size:12.5px;line-height:1.6;color:${MUTED};text-align:center;">
            ${footer ? escapeHtml(footer) + "<br />" : ""}© ${new Date().getFullYear()} Formkit · formkit.app
          </div>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export function renderAuthCodeEmail({
  token,
  expires,
  heading,
  lede,
}: {
  token: string;
  expires: Date;
  heading: string;
  lede: string;
}) {
  const minutes = Math.max(1, Math.round((expires.getTime() - Date.now()) / 60000));
  const body = `
    <div style="display:block;padding:20px 24px;border-radius:20px;background:${PAPER};border:1px solid ${RING};text-align:center;">
      <div style="font-size:34px;letter-spacing:.24em;font-weight:300;color:${INK};">${escapeHtml(token)}</div>
    </div>
    <p style="margin:16px 0 0;font-size:13.5px;line-height:1.6;color:${MUTED};">
      The code is good for ${minutes} minutes. Formkit will never ask you for it by email or message.
    </p>`;
  return renderEmailShell({ heading, lede, body });
}

export function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
