/**
 * The operators a condition can use, per kind of question.
 *
 * This mirrors `OPERATORS` and `operatorGroup` in `convex/logic.ts` — the server
 * is the source of truth for what a stored rule means, and this copy exists
 * because a client bundle should not pull in Convex function definitions.
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

/** Operators that take no value — the rule reads complete without one. */
export const VALUELESS = new Set(["is-empty", "is-not-empty"]);
