import { cellOf, isRanking } from "./grid";
import type { Doc } from "../_generated/dataModel";
import { applyLogic, conditionsOf, ruleMatches, type Answer, type Rule } from "./logicEval";

/**
 * The answers a submission carries, checked on the server against the form
 * they were sent to, so a script cannot store what the form would never let
 * a person send.
 *
 * It mirrors the live form's own checks, and leans towards accepting: where
 * the server cannot know what the person saw (a rule that waits on the AI,
 * or a "jump to" that may have skipped questions), a question is not held to
 * being required. Everything it does check:
 * - every answer belongs to a question on this form;
 * - required questions are answered, after logic (show, hide, require);
 * - emails, links, numbers, dates and times are well formed;
 * - choices are among the question's options;
 * - ratings and scales are in their range;
 * - an upload has an allowed file type;
 * - an ending is one of the form's.
 */

export type Problem = { blockId?: string; code: string; message: string };

type AnswerIn = { blockId: string; value?: string; values?: string[]; fileId?: unknown; fileName?: string };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const URL_RE = /^(https?:\/\/)?[^\s.]+\.[^\s]{2,}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^\d{2}:\d{2}(:\d{2})?$/;
const PHONE = /^[+()\-.\s\d]{5,32}$/;

const filled = (a?: AnswerIn) => !!(a?.value?.trim() || a?.values?.length || a?.fileId);
const label = (b: Doc<"blocks">) => (b.title?.trim() ? `“${b.title.trim().slice(0, 60)}”` : "A question");

/** The words a choice question accepts: its options, plus anything typed into "Other". */
const takes = (b: Pick<Doc<"blocks">, "type" | "options" | "allowOther">, v: string) =>
  !!b.allowOther || (b.type === "yes-no" ? ["Yes", "No"] : (b.options ?? [])).includes(v);

/**
 * What a question's own rules say about an answer (Pro and Free alike): a
 * number's range, a text's length or pattern, a date's window, how many
 * choices. Null when it passes. Shared with the live form, which shows the
 * same words before sending.
 */
export function ruleProblem(
  b: Pick<Doc<"blocks">, "type" | "validation">,
  a: { value?: string; values?: string[] } | undefined,
): string | null {
  const r = b.validation;
  if (!r || !a) return null;
  const v = a.value?.trim() ?? "";
  switch (b.type) {
    case "number": {
      if (!v) return null;
      const n = Number(v.replace(/,/g, ""));
      if (!Number.isFinite(n)) return null;
      if (r.min !== undefined && n < r.min) return `Use a number of at least ${r.min}.`;
      if (r.max !== undefined && n > r.max) return `Use a number no higher than ${r.max}.`;
      return null;
    }
    case "short-text":
    case "long-text":
    case "name":
    case "company":
    case "address": {
      if (!v) return null;
      if (r.minLength !== undefined && v.length < r.minLength) return `Write at least ${r.minLength} characters.`;
      if (r.maxLength !== undefined && v.length > r.maxLength) return `Keep it to ${r.maxLength} characters.`;
      if (r.pattern) {
        try {
          // Anchored, and only on a sensible length, so a pattern cannot run away.
          if (v.length <= 2000 && !new RegExp(`^(?:${r.pattern})$`).test(v)) {
            return r.patternMessage?.trim() || "That is not in the form this question asks for.";
          }
        } catch {
          return null;
        }
      }
      return null;
    }
    case "date": {
      if (!v) return null;
      if (r.minDate && v < r.minDate) return `Pick a date on or after ${r.minDate}.`;
      if (r.maxDate && v > r.maxDate) return `Pick a date on or before ${r.maxDate}.`;
      return null;
    }
    case "multi-choice": {
      const n = a.values?.length ?? 0;
      if (!n) return null;
      if (r.minPicks !== undefined && n < r.minPicks) return `Pick at least ${r.minPicks}.`;
      if (r.maxPicks !== undefined && n > r.maxPicks) return `Pick no more than ${r.maxPicks}.`;
      return null;
    }
  }
  return null;
}

export function validateAnswers(
  form: Pick<Doc<"forms">, "endings">,
  blocks: Doc<"blocks">[],
  rules: Rule[],
  answers: AnswerIn[],
  opts: { partial: boolean; ending?: string | null },
): Problem[] {
  const problems: Problem[] = [];
  const byId = new Map(blocks.map((b) => [b._id as string, b]));
  const ordered = [...blocks].sort((a, b) => a.order - b.order);
  const position = new Map(ordered.map((b, i) => [b._id as string, i]));

  const given = new Map<string, AnswerIn>();
  for (const a of answers) {
    const b = byId.get(a.blockId);
    if (!b || b.kind !== "field") {
      problems.push({ blockId: a.blockId, code: "unknown-question", message: "An answer was sent for a question this form does not have." });
      continue;
    }
    given.set(a.blockId, a);
  }

  // Formats and options, for whatever was answered, partial or not.
  for (const [id, a] of given) {
    const b = byId.get(id)!;
    const v = a.value?.trim() ?? "";
    const bad = (code: string, message: string) => problems.push({ blockId: id, code, message: `${label(b)}: ${message}` });
    switch (b.type) {
      case "email":
        if (v && !EMAIL.test(v)) bad("email", "that is not an email address.");
        break;
      case "url":
        if (v && !URL_RE.test(v)) bad("url", "that is not a web address.");
        break;
      case "phone":
        if (v && (!PHONE.test(v) || (v.match(/\d/g)?.length ?? 0) < 5)) bad("phone", "that is not a phone number.");
        break;
      case "number":
        if (v && !Number.isFinite(Number(v.replace(/,/g, "")))) bad("number", "that is not a number.");
        break;
      case "date":
        if (v && (!DATE.test(v) || Number.isNaN(Date.parse(v)))) bad("date", "that is not a date.");
        break;
      case "time":
        if (v && !TIME.test(v)) bad("time", "that is not a time.");
        break;
      case "single-choice":
      case "dropdown":
      case "yes-no": {
        const options = b.type === "yes-no" ? ["Yes", "No"] : (b.options ?? []);
        if (v && options.length && !takes(b, v)) bad("option", "that is not one of the choices.");
        break;
      }
      case "multi-choice": {
        const options = b.options ?? [];
        if (options.length && (a.values ?? []).some((x) => !takes(b, x))) bad("option", "that is not one of the choices.");
        break;
      }
      case "rating": {
        const max = Math.max(2, Math.min(10, b.scaleMax ?? 5));
        const n = Number(v);
        if (v && (!Number.isInteger(n) || n < 1 || n > max)) bad("range", `ratings go from 1 to ${max}.`);
        break;
      }
      case "scale": {
        const from = b.scaleMin ?? 1;
        const to = b.scaleMax ?? 5;
        const n = Number(v);
        if (v && (!Number.isInteger(n) || n < from || n > to)) bad("range", `the scale goes from ${from} to ${to}.`);
        break;
      }
      case "matrix": {
        const rows = b.rows ?? [];
        const columns = b.options ?? [];
        const cells = (a.values ?? []).map((x) => cellOf(x, rows, columns));
        if (cells.some((c) => !c)) {
          bad("option", "that is not one of the rows and columns.");
          break;
        }
        const perRow = new Map<string, number>();
        for (const c of cells) perRow.set(c!.row, (perRow.get(c!.row) ?? 0) + 1);
        if (!b.matrixMulti && [...perRow.values()].some((n) => n > 1)) bad("option", "pick one answer in each row.");
        if (!opts.partial && b.required && cells.length && perRow.size < rows.length) bad("rows", "answer every row.");
        break;
      }
      case "ranking": {
        const values = a.values ?? [];
        if (values.length && !isRanking(values, b.options ?? [])) bad("option", "put every option in order, once each.");
        break;
      }
      case "file": {
        const accept = (b.accept ?? []).map((x) => x.toLowerCase());
        const ext = `.${(a.fileName ?? "").split(".").pop()?.toLowerCase() ?? ""}`;
        if (a.fileId && accept.length && !accept.includes(ext)) bad("file-type", `this question takes ${accept.join(" ")} files.`);
        break;
      }
    }
  }

  for (const [id, a] of given) {
    const b = byId.get(id)!;
    const message = ruleProblem(b, a);
    if (message) problems.push({ blockId: id, code: "rule", message: `${label(b)}: ${message}` });
  }

  if (opts.ending && !(form.endings ?? []).some((e) => e.id === opts.ending)) {
    problems.push({ code: "ending", message: "The form has no such ending." });
  }

  if (opts.partial) return problems;

  // Required questions, after logic. The AI's yes/no answers are not known
  // here, so anything that hangs on one is given the benefit of the doubt.
  const asAnswers: Record<string, Answer> = {};
  for (const [id, a] of given) asAnswers[id] = a;
  const types = Object.fromEntries(blocks.map((b) => [b._id as string, b.type]));
  const outcome = applyLogic(rules, { answers: asAnswers, types });
  const usesAi = (r: Rule) => conditionsOf(r).some((c) => c.source === "ai");

  const lenient = new Set<string>();
  for (const r of rules) {
    if (r.enabled === false) continue;
    if (usesAi(r) && r.targetId) lenient.add(r.targetId);
    // A jump to an ending may have skipped everything after the questions it looks at.
    if (r.action === "jump" && !r.targetId && r.endingId && (usesAi(r) || ruleMatches(r, { answers: asAnswers, types }))) {
      const from = Math.max(-1, ...conditionsOf(r).map((c) => (c.blockId ? (position.get(c.blockId) ?? -1) : -1)));
      for (const b of ordered.slice(from + 1)) lenient.add(b._id);
    }
    // A jump may have skipped everything between the questions it looks at and its target.
    if (r.action === "jump" && r.targetId && (usesAi(r) || ruleMatches(r, { answers: asAnswers, types }))) {
      const from = Math.max(-1, ...conditionsOf(r).map((c) => (c.blockId ? (position.get(c.blockId) ?? -1) : -1)));
      const to = position.get(r.targetId) ?? -1;
      for (const b of ordered.slice(from + 1, Math.max(from + 1, to))) lenient.add(b._id);
    }
  }
  // Calculated values can decide rules too, and they are worked out from answers.
  if (rules.some((r) => conditionsOf(r).some((c) => c.source === "calc"))) {
    for (const r of rules) if (r.targetId) lenient.add(r.targetId);
  }

  for (const b of ordered) {
    if (b.kind !== "field" || b.type === "hidden") continue;
    if (outcome.hidden.has(b._id) || lenient.has(b._id)) continue;
    if (!(b.required || outcome.forced.has(b._id))) continue;
    if (!filled(given.get(b._id))) {
      problems.push({ blockId: b._id, code: "required", message: `${label(b)} needs an answer.` });
    }
  }
  return problems;
}
