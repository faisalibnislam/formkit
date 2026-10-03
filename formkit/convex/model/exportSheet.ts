/**
 * Response and contact exports, built from pages.
 *
 * The export queries hand over raw records a page at a time (responses.ts:
 * exportPage, contactsExportPage), so no single read has to hold every
 * response. This file turns the pages into the finished sheet; it is plain
 * code, used by the browser download and by the export-by-email action alike.
 */

/** One response, ready to be a row: answers already turned into text. */
export type ExportRecord = {
  formId: string;
  form: string;
  submittedAt: number;
  status: string;
  partial: boolean;
  name: string;
  email: string;
  phone: string;
  company: string;
  source: string;
  device: string;
  tags: string;
  note: string;
  answers: { q: string; text: string }[];
  calc: Record<string, string> | null;
  payment: string | null;
  quiz: [string, string, string, string, string] | null;
  insight: [string, string, string, string, string] | null;
};

export type ExportPage = {
  filename: string;
  title: string;
  /** Every form in scope, not one: the sheet gets a Form column. */
  many: boolean;
  /** The form exported on its own, whose questions lead even if nobody answered. */
  formId: string | null;
  records: ExportRecord[];
  /** Each form's questions in form order, for the forms this page touched. */
  questions: Record<string, string[]>;
  cursor: string;
  done: boolean;
};

export type ExportContact = {
  key: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  company: string | null;
  tags: string[];
  source: string;
  created: number;
  responses: number;
};

export type SheetData = { filename: string; title: string; columns: string[]; rows: string[][] };

export function fmtDate(at: number) {
  return new Date(at).toISOString().replace("T", " ").slice(0, 16);
}

/** Asks for pages until the last one; `fetch` is a query call. */
export async function readPages<P extends { cursor: string; done: boolean }>(
  fetch: (cursor: string | null) => Promise<P>,
): Promise<P[]> {
  const pages: P[] = [];
  let cursor: string | null = null;
  for (;;) {
    const page: P = await fetch(cursor);
    pages.push(page);
    if (page.done) return pages;
    cursor = page.cursor;
  }
}

/** The responses sheet: question columns in form order, then what any row carries. */
export function responsesSheet(pages: ExportPage[]): SheetData {
  const first = pages[0];
  // Oldest first; ticked rows arrive in the order they were ticked.
  const records = pages.flatMap((p) => p.records).sort((a, b) => a.submittedAt - b.submittedAt);
  const formQuestions: Record<string, string[]> = {};
  for (const p of pages) Object.assign(formQuestions, p.questions);

  // Question order follows the forms, in the order they first appear.
  const order = [...new Set(records.map((r) => r.formId))];
  if (first?.formId && !order.includes(first.formId)) order.push(first.formId);
  const questions: string[] = [];
  const seen = new Set<string>();
  const add = (q: string) => {
    const title = q.trim();
    if (seen.has(title.toLowerCase())) return;
    seen.add(title.toLowerCase());
    questions.push(title);
  };
  for (const id of order) for (const q of formQuestions[id] ?? []) add(q);
  // Answers to questions since removed from the form still export.
  for (const r of records) for (const a of r.answers) add(a.q);

  // Calculation results get a column each, after the questions.
  const calcNames = [...new Set(records.flatMap((r) => Object.keys(r.calc ?? {})))];
  const paid = records.some((r) => r.payment !== null);
  const quizzed = records.some((r) => r.quiz !== null);
  const replied = records.some((r) => r.insight !== null);
  const many = first?.many ?? true;

  const columns = [
    ...(many ? ["Form"] : []),
    "Submitted",
    "Status",
    "Complete",
    "Name",
    "Email",
    "Phone",
    "Company",
    "Source",
    "Device",
    "Tags",
    "Note",
    ...questions,
    ...calcNames,
    ...(paid ? ["Payment"] : []),
    ...(quizzed ? ["Score", "Out of", "Percent", "Result", "To mark"] : []),
    ...(replied ? ["Sentiment", "Lead score", "Urgency", "AI summary", "AI reply"] : []),
  ];
  const rows = records.map((r) => {
    const byQuestion = new Map(r.answers.map((a) => [a.q.trim().toLowerCase(), a.text]));
    return [
      ...(many ? [r.form] : []),
      fmtDate(r.submittedAt),
      r.status,
      r.partial ? "Partial" : "Complete",
      r.name,
      r.email,
      r.phone,
      r.company,
      r.source,
      r.device,
      r.tags,
      r.note,
      ...questions.map((q) => byQuestion.get(q.toLowerCase()) ?? ""),
      ...calcNames.map((n) => r.calc?.[n] ?? ""),
      ...(paid ? [r.payment ?? ""] : []),
      ...(quizzed ? (r.quiz ?? ["", "", "", "", ""]) : []),
      ...(replied ? (r.insight ?? ["", "", "", "", ""]) : []),
    ];
  });
  return { filename: first?.filename ?? "responses", title: first?.title ?? "Responses", columns, rows };
}

/** The contacts sheet, each person once (pages can name the same person twice). */
export function contactsSheet(pages: { people: ExportContact[] }[]): SheetData {
  const seen = new Set<string>();
  const people = pages.flatMap((p) => p.people).filter((c) => !seen.has(c.key) && (seen.add(c.key), true));
  return {
    filename: "contacts",
    title: "Contacts",
    columns: ["Name", "Email", "Phone", "Company", "Tags", "Source", "Created", "Responses"],
    rows: people.map((c) => [
      c.name ?? "",
      c.email ?? "",
      c.phone ?? "",
      c.company ?? "",
      c.tags.join(", "),
      c.source,
      fmtDate(c.created),
      String(c.responses),
    ]),
  };
}
