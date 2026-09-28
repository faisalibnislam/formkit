/**
 * The operators a condition can use, per kind of question - shared by the
 * Logic tab and the server, which checks rules the AI writes against it.
 * What each operator means is in `logicEval.ts`.
 *
 * A number question offers "is at least" as well as "is greater than", because
 * "18 or older" has to include 18.
 */
export const OPERATORS: Record<string, { value: string; label: string }[]> = {
  choice: [
    { value: "is", label: "is" },
    { value: "is-not", label: "is not" },
    { value: "is-empty", label: "is empty" },
    { value: "is-not-empty", label: "is not empty" },
  ],
  number: [
    { value: "at-least", label: "is at least" },
    { value: "at-most", label: "is at most" },
    { value: "greater", label: "is greater than" },
    { value: "less", label: "is less than" },
    { value: "is-empty", label: "is empty" },
  ],
  text: [
    { value: "contains", label: "contains" },
    { value: "is", label: "is" },
    { value: "is-empty", label: "is empty" },
    { value: "is-not-empty", label: "is not empty" },
  ],
};

export function operatorGroup(type: string | undefined | null, title: string | undefined | null) {
  if (!type) return "text";
  if (["single-choice", "multi-choice", "dropdown", "yes-no", "rating", "scale"].includes(type)) {
    return "choice";
  }
  if (type === "number") return "number";
  if (
    type === "short-text" &&
    title &&
    /\b(how old|how many|how much|age|number of)\b/i.test(title)
  ) {
    return "number";
  }
  return "text";
}

/** Operators that take no value - the rule reads complete without one. */
export const VALUELESS = new Set(["is-empty", "is-not-empty", "yes", "no"]);

type Q = {
  type?: string | null;
  title?: string | null;
  options?: string[] | null;
  scaleMin?: number | null;
  scaleMax?: number | null;
} | null | undefined;

export type ValueControl =
  | { kind: "select"; options: string[]; numeric?: boolean }
  | { kind: "text"; placeholder: string; numeric?: boolean; note?: string }
  | { kind: "none"; note: string };

const range = (from: number, to: number) =>
  Array.from({ length: Math.max(0, to - from + 1) }, (_, i) => String(from + i));

/**
 * What a condition's value is picked with, for the question it reads: its own
 * options, Yes / No, the points of a scale, or typed text - and whether the
 * answer is compared as a number.
 */
export function valueControl(q: Q): ValueControl {
  const type = q?.type ?? "";
  if (q?.options?.length) {
    return {
      kind: "select",
      options: q.options,
      numeric: q.options.every((o) => /^-?\d+(\.\d+)?$/.test(o.trim())),
    };
  }
  if (type === "yes-no") return { kind: "select", options: ["Yes", "No"] };
  if (type === "rating") return { kind: "select", options: range(1, q?.scaleMax ?? 5), numeric: true };
  if (type === "scale") {
    return { kind: "select", options: range(q?.scaleMin ?? 1, q?.scaleMax ?? 5), numeric: true };
  }
  if (type === "date") return { kind: "text", placeholder: "MM/DD/YYYY" };
  if (type === "number") return { kind: "text", placeholder: "e.g. 18", numeric: true };
  if (type === "email") return { kind: "text", placeholder: "An email address" };
  if (type === "phone") return { kind: "text", placeholder: "A phone number" };
  if (type === "file" || type === "signature") return { kind: "none", note: "any upload" };
  // A short-text question that is really asking for a number: age, headcount, year.
  if (/\bage\b|how old|how many|number of|headcount|year\b|budget|salary|price/i.test(q?.title ?? "")) {
    return { kind: "text", placeholder: "e.g. 18", numeric: true, note: "read as a number" };
  }
  return { kind: "text", placeholder: "Type a value" };
}

const LABELS: Record<string, string> = {
  is: "is",
  "is-not": "is not",
  "any-of": "is any of",
  "none-of": "is none of",
  contains: "contains",
  "not-contains": "does not contain",
  "starts-with": "starts with",
  "ends-with": "ends with",
  "email-domain": "is at the domain",
  matches: "matches the pattern",
  equals: "equals",
  "at-least": "is at least",
  "at-most": "is at most",
  greater: "is greater than",
  less: "is less than",
  between: "is between",
  before: "is before",
  after: "is after",
  on: "is on",
  "is-empty": "is empty",
  "is-not-empty": "is not empty",
  yes: "AI says yes",
  no: "AI says no",
};

/** Comparisons that pick several of a question's options. */
export const MULTI = new Set(["any-of", "none-of"]);

/** The comparisons that make sense for a question. */
export function opsFor(q: Q) {
  const vc = valueControl(q);
  const type = q?.type ?? "";
  const ids =
    vc.kind === "none"
      ? ["is-empty", "is-not-empty"]
      : type === "date"
        ? ["on", "before", "after", "between", "is-empty", "is-not-empty"]
        : vc.numeric
          ? ["is", "is-not", "at-least", "at-most", "greater", "less", "between", "is-empty", "is-not-empty"]
          : vc.kind === "select"
            ? ["is", "is-not", "any-of", "none-of", "is-empty", "is-not-empty"]
            : [
                "is",
                "is-not",
                "contains",
                "not-contains",
                "starts-with",
                "ends-with",
                ...(type === "email" ? ["email-domain"] : []),
                "matches",
                "is-empty",
                "is-not-empty",
              ];
  return ids.map((value) => ({ value, label: LABELS[value]! }));
}

/** The comparisons a calculation's result can use. */
export const CALC_OPS = ["equals", "at-least", "at-most", "greater", "less", "between"].map((value) => ({
  value,
  label: LABELS[value]!,
}));

export function opLabel(op: string | undefined) {
  return LABELS[op ?? ""] ?? op ?? "is";
}

/** The first value a condition on this question can take. */
export function firstValue(q: Q) {
  const vc = valueControl(q);
  return vc.kind === "select" ? vc.options[0] : undefined;
}
