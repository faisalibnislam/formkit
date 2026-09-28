import { answers, button, C, EMAIL_SITE, facts, list, paragraph, quote, renderShell, safeColor, type Brand } from "./kit";

/**
 * Every email apart from the sign-in codes: a response's notification and
 * confirmation, exports, invitations, sign-in alerts, digests and comments.
 *
 * The notification and confirmation text is the customer's own, written in
 * Settings → Notifications, and arrives here with `{{variables}}` still in it.
 * The design around it is Formkit's.
 */

const SETTINGS = `${EMAIL_SITE}/app/settings?tab=notifications`;

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
  const answered = rows.filter((r) => r.value).length;
  return renderShell({
    eyebrow: partial ? "Partial response" : "New response",
    heading: subject,
    lede: partial ? `${message} They stopped partway through.` : message,
    body: `${
      rows.length
        ? `<div style="font-size:13px;font-weight:500;color:${C.muted};margin:0 0 10px;">${answered} of ${rows.length} ${rows.length === 1 ? "question" : "questions"} answered</div>${answers(rows)}`
        : ""
    }${link ? button("Open the response", link) : ""}`,
    reason: "You are getting this because you own this form in Formkit.",
    links: [{ label: "Notification settings", href: SETTINGS }],
  });
}

/** What somebody gets back after answering - in the form owner's colours. */
export function renderConfirmation({
  subject,
  message,
  rows,
  brandName,
  brand,
}: {
  subject: string;
  message: string;
  rows: { question: string; value: string }[];
  brandName: string;
  brand?: Partial<Brand>;
}) {
  const b: Brand = {
    name: brand?.name ?? brandName,
    logoUrl: brand?.logoUrl ?? null,
    color: safeColor(brand?.color),
    badge: brand?.badge !== false,
  };
  return renderShell({
    brand: b,
    eyebrow: "Received",
    heading: subject,
    lede: message,
    body: rows.length
      ? `<div style="font-size:13px;font-weight:500;color:${C.muted};margin:4px 0 10px;">A copy of what you sent</div>${answers(rows)}`
      : paragraph("Nothing else to do. This is just to say it arrived.", { muted: true }),
    reason: `Sent by ${b.name}. Reply to this email to reach them.`,
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
  return renderShell({
    eyebrow: "Export",
    heading: "Your export is attached",
    lede: `${count.toLocaleString("en-US")} ${count === 1 ? "response" : "responses"} from ${formTitle}.`,
    body: `${facts([
      ["File", filename],
      ["Form", formTitle],
      ["Responses", count.toLocaleString("en-US")],
    ])}${paragraph("It opens in Numbers, Excel, Google Sheets, or anything else that reads a spreadsheet.", {
      muted: true,
      top: 18,
    })}`,
    reason: "You asked Formkit to email this export.",
  });
}

/** "Maya added you to Client Onboarding" - an invitation to work on a form. */
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
  const as = role === "editor" ? "Editor" : role === "commenter" ? "Commenter" : "Viewer";
  const can =
    role === "editor"
      ? "You can edit its questions and read its responses."
      : role === "commenter"
        ? "You can read it and leave comments."
        : "You can read it and its responses.";
  return renderShell({
    eyebrow: "Invitation",
    heading: `${inviter} added you to ${formTitle}`,
    lede: `As ${as === "Editor" ? "an" : "a"} ${as}. ${can}`,
    body: `${note ? quote(note, inviter) : ""}${paragraph(
      "Sign in, or make an account, with this email address, and the form is waiting in your list.",
      { top: note ? 22 : 0 },
    )}${button("Open the form", link)}`,
    reason: `${inviter} shared a form with this address on Formkit.`,
  });
}

/** Settings → Security → Sign-in alerts. */
export function renderSignInAlert({ device, when, link }: { device: string; when: string; link: string }) {
  return renderShell({
    eyebrow: "Security",
    heading: "A new sign-in to your account",
    lede: "If this was you, there is nothing to do.",
    body: `${facts([
      ["Device", device],
      ["When", when],
    ])}${paragraph(
      "If it was not you, change your password now and sign out every other device from Settings → Account.",
      { top: 20 },
    )}${button("Review your sessions", link)}`,
    reason: "Sign-in alerts are on for your Formkit account.",
    links: [{ label: "Security settings", href: `${EMAIL_SITE}/app/settings` }],
  });
}

/** The daily summary and the weekly report, from Settings → Notifications. */
export function renderDigest({
  heading,
  lede,
  rows,
  link,
}: {
  heading: string;
  lede: string;
  rows: { form: string; line: string; count?: number }[];
  link: string;
}) {
  return renderShell({
    eyebrow: heading.toLowerCase().includes("week") ? "Weekly report" : "Daily summary",
    heading,
    lede,
    body: `${list(
      rows.map((r) => ({
        title: r.form,
        line: r.line,
        figure: r.count !== undefined ? `${r.count.toLocaleString("en-US")} new` : undefined,
      })),
    )}${button("Open your responses", link)}`,
    reason: "You chose to get this summary in Formkit.",
    links: [{ label: "Notification settings", href: SETTINGS }],
  });
}

/** A reply or @mention nobody opened in the app within ten minutes. */
export function renderCommentEmail({ heading, quote: text, link }: { heading: string; quote: string; link: string }) {
  return renderShell({
    eyebrow: "Comment",
    heading,
    lede: "You have not seen this in Formkit yet.",
    body: `${text ? quote(text.slice(0, 1200)) : ""}${button("Open the comment", link)}`,
    reason: "Sent because you were mentioned or replied to on a form.",
    links: [{ label: "Turn these emails off", href: SETTINGS }],
  });
}

/** Business: an invitation onto someone's whole team. */
export function renderTeamInvite({ inviter, role, link }: { inviter: string; role: string; link: string }) {
  const can =
    role === "admin"
      ? "You can work on every form, manage the team and approve forms."
      : role === "editor"
        ? "You can edit every form and read its responses."
        : "You can read every form and its responses.";
  const as = role === "admin" ? "an Admin" : role === "editor" ? "an Editor" : "a Viewer";
  return renderShell({
    eyebrow: "Team invitation",
    heading: `${inviter} added you to their team`,
    lede: `As ${as}. ${can}`,
    body: `${paragraph(
      "Sign in, or make an account, with this email address, and the team's forms are waiting under Shared.",
    )}${button("Open Formkit", link)}`,
    reason: `${inviter} added this address to their team on Formkit.`,
  });
}
