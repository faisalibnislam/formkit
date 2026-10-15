/**
 * The form check before publishing: things that are not errors but often
 * cost answers, or trip people up. Pure, so it can be tested on its own; the
 * logic checks come from the Logic tab's map (LogicMap.logicChecks).
 */

export type CheckBlock = {
  _id: string;
  kind: string;
  type?: string | null;
  title?: string | null;
  required?: boolean | null;
  options?: string[] | null;
  imageId?: string | null;
  alt?: string | null;
  videoUrl?: string | null;
};

export type Finding = { level: "warn" | "info"; text: string };

/** Seconds a typical person spends on each kind of question. */
const SECONDS: Record<string, number> = {
  "long-text": 45,
  file: 30,
  voice: 60,
  signature: 15,
  address: 20,
  "short-text": 12,
  name: 6,
  email: 6,
  phone: 8,
};

export function minutesToFill(blocks: CheckBlock[]) {
  const s = blocks.filter((b) => b.kind === "field" && b.type !== "hidden").reduce((t, b) => t + (SECONDS[b.type ?? ""] ?? 8), 0);
  return Math.max(1, Math.round(s / 60));
}

export function formChecks(blocks: CheckBlock[]): Finding[] {
  const out: Finding[] = [];
  const fields = blocks.filter((b) => b.kind === "field" && b.type !== "hidden");
  const minutes = minutesToFill(blocks);
  if (fields.length > 25 || minutes > 8) {
    out.push({
      level: "info",
      text: `It takes about ${minutes} minutes and has ${fields.length} questions. Long forms lose people; pages, or fewer questions, help.`,
    });
  }
  const written = fields.filter((b) => b.required && b.type === "long-text").length;
  if (written >= 4) {
    out.push({ level: "info", text: `${written} required questions ask for a long written answer. That is where people most often stop.` });
  }
  const seen = new Map<string, number>();
  for (const b of fields) {
    const t = (b.title ?? "").trim().toLowerCase();
    if (t) seen.set(t, (seen.get(t) ?? 0) + 1);
  }
  for (const [t, n] of seen) {
    if (n > 1) out.push({ level: "warn", text: `${n} questions are worded “${t}”. People cannot tell them apart.` });
  }
  for (const b of fields) {
    const opts = (b.options ?? []).map((o) => o.trim().toLowerCase()).filter(Boolean);
    if (["single-choice", "multi-choice", "dropdown"].includes(b.type ?? "") && new Set(opts).size < opts.length) {
      out.push({ level: "warn", text: `“${b.title || "A choice question"}” offers the same option twice.` });
    }
    if (["single-choice", "dropdown"].includes(b.type ?? "") && opts.length === 1) {
      out.push({ level: "warn", text: `“${b.title || "A choice question"}” has only one option to pick.` });
    }
  }
  for (const b of blocks.filter((x) => x.kind === "content")) {
    if (b.type === "image" && b.imageId && !b.alt?.trim()) {
      out.push({ level: "warn", text: `A picture${b.title ? ` (“${b.title}”)` : ""} has no description for people using a screen reader.` });
    }
    if (b.type === "image" && !b.imageId) out.push({ level: "warn", text: "A picture block has no picture yet." });
    if (b.type === "video" && !b.videoUrl) out.push({ level: "warn", text: "A video block has no video yet." });
  }
  return out;
}
