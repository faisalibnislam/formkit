/**
 * The question types a form can be built with from a spec: by Ask Formkit,
 * the API, the MCP server and imports. No server code here, so the website
 * can read it too.
 */
export const QUESTION_TYPES = [
  "short-text",
  "long-text",
  "email",
  "phone",
  "url",
  "name",
  "company",
  "address",
  "number",
  "single-choice",
  "multi-choice",
  "dropdown",
  "yes-no",
  "date",
  "time",
  "rating",
  "scale",
  "file",
  "signature",
  "voice",
] as const;
export type QuestionType = (typeof QUESTION_TYPES)[number];

/** What a rule's condition can test, by the kind of question it reads. */
export const RULE_OPERATORS = ["is", "is-not", "contains", "is-empty", "is-not-empty", "at-least", "at-most", "greater", "less"] as const;
