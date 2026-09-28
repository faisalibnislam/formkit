import type { Doc, Id } from "../_generated/dataModel";

/**
 * Marking a quiz. A question with an answer key is marked as the response is
 * stored; one worth marks but without a key (a written answer, an upload)
 * waits for the owner to mark it by hand.
 *
 * - Choice and yes/no: right when the chosen option is in the key.
 * - Multiple choice: full marks for exactly the keyed options; nothing otherwise.
 * - Typed answers: right when they match any accepted answer, ignoring case,
 *   spacing and a trailing full stop; numbers compare as numbers.
 */

type Block = Pick<Doc<"blocks">, "_id" | "kind" | "type" | "answerKey" | "marks">;
type Answer = { blockId: Id<"blocks"> | string; value?: string; values?: string[]; fileName?: string };

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ").replace(/[.!]+$/, "");
const asNumber = (s: string) => {
  const n = Number(s.replace(/[, ]/g, ""));
  return Number.isFinite(n) ? n : null;
};

/** Whether a question counts towards the mark at all. */
export function marked(b: Block) {
  if (b.kind !== "field" || b.type === "hidden") return false;
  return !!b.answerKey?.length || (b.marks ?? 0) > 0;
}

export function markOne(b: Block, a: Answer | undefined): { got: number; max: number; manual?: boolean } {
  const max = b.marks ?? 1;
  const key = (b.answerKey ?? []).filter(Boolean);
  if (!key.length) return { got: 0, max, manual: true };
  const values = a?.values?.length ? a.values : a?.value ? [a.value] : [];
  if (!values.length) return { got: 0, max };
  if (b.type === "multi-choice") {
    const want = new Set(key.map(norm));
    const got = new Set(values.map(norm));
    const exact = want.size === got.size && [...want].every((k) => got.has(k));
    return { got: exact ? max : 0, max };
  }
  const given = values[0]!;
  const right = key.some((k) => {
    const x = asNumber(k);
    const y = asNumber(given);
    return x !== null && y !== null ? x === y : norm(k) === norm(given);
  });
  return { got: right ? max : 0, max };
}

export function markAll(blocks: Block[], answers: Answer[], passMark?: number) {
  const by = new Map(answers.map((a) => [a.blockId as string, a]));
  const marks = blocks.filter(marked).map((b) => ({ blockId: b._id, ...markOne(b, by.get(b._id)) }));
  return totals(marks, passMark);
}

/** Adds up per-question marks into the score, percentage and pass. */
export function totals(
  marks: { blockId: Id<"blocks">; got: number; max: number; manual?: boolean }[],
  passMark?: number,
) {
  const score = Math.round(marks.reduce((n, m) => n + m.got, 0) * 10) / 10;
  const max = Math.round(marks.reduce((n, m) => n + m.max, 0) * 10) / 10;
  const percent = max ? Math.round((score / max) * 1000) / 10 : 0;
  const pending = marks.filter((m) => m.manual).length;
  return {
    score,
    max,
    percent,
    // Pass or fail only once everything is marked.
    ...(typeof passMark === "number" && !pending ? { passed: percent >= passMark } : {}),
    marks,
    pending,
  };
}
