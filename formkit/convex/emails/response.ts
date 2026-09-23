import { escapeHtml, renderEmailShell } from "./authCode";

/**
 * The two emails a response sets off: the owner's notification, and the
 * confirmation the person who answered gets back.
 *
 * Both are written by the customer in Settings → Notifications, so the subject
 * and message arrive here as their text with `{{variables}}` still in it. The
 * answers table below is Formkit's, not theirs.
 */

const INK = "#21282E";
const PAPER = "#f7fbff";
const MUTED = "#6d747a";
const RING = "#e0e2e4";

export type Vars = {
  name: string;
  email: string;
  form_name: string;
  submitted_at: string;
};

/** Replaces `{{name}}` and friends. An unknown variable is left alone. */
export function fill(text: string, vars: Vars) {
  return text.replace(/\{\{\s*(\w+)\s*\}\}/g, (whole, key: string) =>
    key in vars ? vars[key as keyof Vars] : whole,
  );
}

export function answersTable(rows: { question: string; value: string }[]) {
  if (!rows.length) return "";
  const cells = rows
    .map(
      ({ question, value }) => `
      <tr>
        <td style="padding:12px 0 0;font-size:12.5px;line-height:1.5;color:${MUTED};">${escapeHtml(question)}</td>
      </tr>
      <tr>
        <td style="padding:2px 0 12px;font-size:14.5px;line-height:1.6;color:${INK};box-shadow:inset 0 -1px 0 ${RING};">${
          value ? escapeHtml(value) : `<span style="color:${MUTED};">Not answered</span>`
        }</td>
      </tr>`,
    )
    .join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:20px;padding:4px 20px 8px;border-radius:20px;background:${PAPER};border:1px solid ${RING};">${cells}</table>`;
}

function button(label: string, href: string) {
  return `<div style="margin-top:22px;">
    <a href="${escapeHtml(href)}" style="display:inline-block;padding:13px 22px;border-radius:999px;background:${INK};color:#ffffff;font-size:14.5px;font-weight:500;text-decoration:none;">${escapeHtml(label)}</a>
  </div>`;
}

export function renderNotification({
  subject,
  message,
  rows,
  link,
  partial,
}: {
  subject: string;
  message: string;
  rows: { question: string; value: string }[];
  link?: string;
  partial?: boolean;
}) {
  const body = `${answersTable(rows)}${link ? button("Open the response", link) : ""}`;
  return renderEmailShell({
    heading: subject,
    lede: partial ? `${message} They stopped partway through.` : message,
    body,
    footer: "You are getting this because you own this form in Formkit.",
  });
}

export function renderConfirmation({
  subject,
  message,
  rows,
  brandName,
}: {
  subject: string;
  message: string;
  rows: { question: string; value: string }[];
  brandName: string;
}) {
  return renderEmailShell({
    heading: subject,
    lede: message,
    body: rows.length
      ? `<p style="margin:0 0 4px;font-size:13.5px;color:${MUTED};">A copy of what you sent:</p>${answersTable(rows)}`
      : "",
    footer: `Sent by ${brandName} with Formkit. Reply to this email to reach them.`,
  });
}

export function renderExport({
  formTitle,
  count,
  filename,
}: {
  formTitle: string;
  count: number;
  filename: string;
}) {
  return renderEmailShell({
    heading: "Your export is attached",
    lede: `${count} ${count === 1 ? "response" : "responses"} from ${formTitle}.`,
    body: `<p style="margin:0;font-size:14.5px;line-height:1.6;color:${INK};">The file is called ${escapeHtml(filename)}. It opens in Numbers, Excel, Google Sheets, or anything else that reads a spreadsheet.</p>`,
  });
}

/** "Maya added you to Client Onboarding" — an invitation to work on a form. */
export function renderInvite({
  inviter,
  formTitle,
  role,
  note,
  link,
}: {
  inviter: string;
  formTitle: string;
  role: string;
  note?: string;
  link: string;
}) {
  const can =
    role === "editor"
      ? "You can edit its questions and read its responses."
      : role === "commenter"
        ? "You can read it and leave comments."
        : "You can read it and its responses.";
  return renderEmailShell({
    heading: `${inviter} added you to ${formTitle}`,
    lede: `As ${role === "editor" ? "an Editor" : role === "commenter" ? "a Commenter" : "a Viewer"}. ${can}`,
    body: `${
      note
        ? `<p style="margin:0 0 4px;padding:14px 18px;border-radius:18px;background:${PAPER};font-size:14.5px;line-height:1.6;color:${INK};">${escapeHtml(note)}</p>`
        : ""
    }<p style="margin:14px 0 0;font-size:14px;line-height:1.6;color:${MUTED};">Sign in — or make an account — with this email address, and the form is waiting in your list.</p>${button("Open the form", link)}`,
  });
}
