import { code, paragraph, renderShell } from "./kit";

export { escapeHtml } from "./kit";

/** A sign-up, password-reset or change-of-address code. */
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
  return renderShell({
    eyebrow: "Your code",
    heading,
    lede,
    preheader: `${token} — ${lede}`,
    body: `${code(token, minutes)}${paragraph(
      "Formkit will never ask you for this code by email, phone or message. If you did not ask for it, you can ignore this email — nothing changes without the code.",
      { muted: true, top: 20 },
    )}`,
    reason: "Sent because this address was entered on Formkit.",
  });
}
