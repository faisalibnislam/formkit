import { OPERATORS, operatorGroup } from "../logic";
import { THEME_PRESETS } from "./themePresets";
import { voice } from "./gemini";

/**
 * What Ask Formkit asks the model for, and how its answers are checked before
 * anything is saved: the JSON schemas, the house style, and the validators that
 * coerce types, drop unusable options and refuse any rule the Logic tab could
 * not have written. Pure functions, so they can be exercised on their own.
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
] as const;
export type QuestionType = (typeof QUESTION_TYPES)[number];

export const CHOICE_TYPES = new Set(["single-choice", "multi-choice", "dropdown"]);
/** Answers that identify a person. They stay out of anything sent to the model. */
export const PERSONAL_TYPES = new Set(["name", "email", "phone", "address", "file", "signature", "company", "url"]);
export const RULE_ACTIONS = ["show", "hide", "require"] as const;
const ALL_OPERATORS = [...new Set(Object.values(OPERATORS).flatMap((g) => g.map((o) => o.value)))];
const VALUELESS = new Set(["is-empty", "is-not-empty"]);

export const VOICE = `House style:
- Sentence case: capitalise the first word and proper nouns only, never Title Case, never all lowercase.
- British spelling: colour, organisation, summarise, personalise.
- Plain, short and a little dry. Second person, addressed to the person answering.
- No emoji, no exclamation marks, no sales words (fast, easy, simply, just, powerful, seamless).
- Never use em dashes. Use a comma, a colon, brackets or a new sentence instead.`;

export const FORM_RULES = `${VOICE}

Writing a form:
- Ask the fewest questions that do the job, usually between five and twelve. A shorter form gets finished.
- Write each question as a person would say it out loud, ending in a question mark when it is a question.
- Prefer a choice question whenever the answers can be listed. single-choice, multi-choice and dropdown must always carry their options, between two and eight, each a real answer somebody might give. No other type carries options.
- Use a page item wherever the subject changes; never more than about six questions on one page.
- Mark a question required only when the form is useless without its answer.
- help is an optional one-line hint, usually empty.
- Never ask for more personal data than the stated purpose needs.
- Types: ${QUESTION_TYPES.join(", ")}.`;

export const ITEM_SCHEMA = {
  type: "OBJECT",
  properties: {
    kind: { type: "STRING", enum: ["question", "page"] },
    type: { type: "STRING", enum: [...QUESTION_TYPES] },
    title: { type: "STRING", description: "The question, or the page's name for a page item." },
    help: { type: "STRING", description: "A one-line hint, usually empty." },
    required: { type: "BOOLEAN" },
    options: {
      type: "ARRAY",
      items: { type: "STRING" },
      description: "Required for single-choice, multi-choice and dropdown: two to eight answers. Empty for every other type.",
    },
  },
  // Gemini leaves optional properties out more often than not, so every one is
  // asked for; an empty value is how "not this" is said.
  required: ["kind", "type", "title", "help", "required", "options"],
  propertyOrdering: ["kind", "type", "title", "help", "required", "options"],
};

export const RULE_SCHEMA = {
  type: "OBJECT",
  properties: {
    name: { type: "STRING", description: "A short name, like 'Only for existing clients'." },
    when: { type: "STRING", description: "The exact wording of the question the rule reads." },
    operator: { type: "STRING", enum: ALL_OPERATORS },
    value: { type: "STRING", description: "For a choice question, one of its options exactly. Empty for is-empty and is-not-empty." },
    action: { type: "STRING", enum: [...RULE_ACTIONS] },
    target: { type: "STRING", description: "The exact wording of the question it shows, hides or requires. It comes after the one it reads." },
  },
  required: ["name", "when", "operator", "value", "action", "target"],
  propertyOrdering: ["name", "when", "operator", "value", "action", "target"],
};

export const DRAFT_SCHEMA = {
  type: "OBJECT",
  properties: {
    title: { type: "STRING" },
    description: { type: "STRING" },
    welcomeTitle: { type: "STRING" },
    welcomeMessage: { type: "STRING" },
    thanksTitle: { type: "STRING" },
    thanksMessage: { type: "STRING" },
    items: { type: "ARRAY", items: ITEM_SCHEMA },
    rules: { type: "ARRAY", items: RULE_SCHEMA },
    theme: { type: "STRING", enum: THEME_PRESETS.map((t) => t.id) },
    note: { type: "STRING", description: "One sentence on anything the person should know, or empty." },
  },
  required: ["title", "description", "welcomeTitle", "welcomeMessage", "thanksTitle", "thanksMessage", "items", "rules", "note"],
};

export type DraftItem =
  | {
      kind: "field";
      type: QuestionType;
      title: string;
      help?: string;
      required: boolean;
      options?: string[];
    }
  | { kind: "pagebreak"; pageName: string };

/** A rule in a draft points at questions by their number, counting from 1. */
export type DraftRule = {
  name: string;
  when: number;
  operator: string;
  value?: string;
  action: (typeof RULE_ACTIONS)[number];
  target: number;
};

export type Draft = {
  title: string;
  description: string;
  welcome: { title: string; message: string };
  thanks: { title: string; message: string };
  items: DraftItem[];
  rules: DraftRule[];
  theme?: string;
};

/* ---------- checking what the model sends back ---------- */

export function clean(s: unknown, max = 300) {
  return typeof s === "string" ? voice(s.replace(/\s+/g, " ").trim()).slice(0, max) : "";
}

export function coerceType(t: unknown): QuestionType {
  return (QUESTION_TYPES as readonly string[]).includes(String(t)) ? (t as QuestionType) : "short-text";
}

export type RawItem = { kind?: string; type?: string; title?: string; help?: string; required?: boolean; options?: unknown };

export function toItem(raw: RawItem): DraftItem | null {
  const title = clean(raw.title, 240);
  if (!title) return null;
  if (raw.kind === "page") return { kind: "pagebreak", pageName: title.slice(0, 60) };
  const type = coerceType(raw.type);
  const item: DraftItem = { kind: "field", type, title, required: raw.required === true };
  const help = clean(raw.help, 200);
  if (help) item.help = help;
  if (CHOICE_TYPES.has(type)) {
    const options = [
      ...new Set((Array.isArray(raw.options) ? raw.options : []).map((o) => clean(o, 80)).filter(Boolean)),
    ].slice(0, 10);
    // A choice question without real options is a text question.
    if (options.length >= 2) item.options = options;
    else item.type = "short-text";
  }
  return item;
}

export type RuleField = { type?: string; title?: string; options?: string[] };

const norm = (t: string) => t.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/**
 * Which question a rule means, counting from 1. The model names questions by
 * their wording, which it gets right far more often than it counts; a stored
 * draft's own rules use numbers.
 */
function resolveQuestion(ref: number | string | undefined, fields: RuleField[]) {
  if (typeof ref === "number") return ref;
  if (!ref) return 0;
  const wanted = norm(ref);
  const exact = fields.findIndex((f) => norm(f.title ?? "") === wanted);
  if (exact >= 0) return exact + 1;
  const loose = fields.findIndex((f) => {
    const t = norm(f.title ?? "");
    return t.length > 8 && (t.includes(wanted) || wanted.includes(t));
  });
  return loose + 1;
}

/** A rule the Logic tab could have written, or nothing. */
export function checkRule(
  raw: { name?: string; when?: number | string; operator?: string; value?: string; action?: string; target?: number | string },
  fields: RuleField[],
): DraftRule | null {
  const whenAt = resolveQuestion(raw.when, fields);
  const targetAt = resolveQuestion(raw.target, fields);
  const when = fields[whenAt - 1];
  const target = fields[targetAt - 1];
  // A rule only ever looks back: it reads an earlier answer to change a later question.
  if (!when || !target || targetAt <= whenAt) return null;
  if (!RULE_ACTIONS.includes(raw.action as (typeof RULE_ACTIONS)[number])) return null;
  const group = operatorGroup(when.type, when.title);
  if (!OPERATORS[group]!.some((o) => o.value === raw.operator)) return null;

  let value: string | undefined;
  if (!VALUELESS.has(raw.operator!)) {
    const wanted = String(raw.value ?? "").trim();
    if (!wanted) return null;
    if (when.type === "yes-no") {
      value = /^y/i.test(wanted) ? "Yes" : /^n/i.test(wanted) ? "No" : undefined;
    } else if (when.options?.length) {
      value = when.options.find((o) => o.toLowerCase() === wanted.toLowerCase());
    } else if (group === "number" || when.type === "rating" || when.type === "scale") {
      value = /^-?\d+(\.\d+)?$/.test(wanted) ? wanted : undefined;
    } else {
      value = wanted.slice(0, 120);
    }
    if (value === undefined) return null;
  }

  const name =
    clean(raw.name, 60) ||
    (value ? `Only for ${value.toLowerCase()}` : `When ${String(when.title ?? "").toLowerCase()} is answered`);
  return {
    name,
    when: whenAt,
    operator: raw.operator!,
    value,
    action: raw.action as DraftRule["action"],
    target: targetAt,
  };
}

export function fieldsOf(items: DraftItem[]): RuleField[] {
  return items.filter((i): i is Extract<DraftItem, { kind: "field" }> => i.kind === "field");
}

export type RawDraft = {
  title?: string;
  description?: string;
  welcomeTitle?: string;
  welcomeMessage?: string;
  thanksTitle?: string;
  thanksMessage?: string;
  items?: RawItem[];
  rules?: Parameters<typeof checkRule>[0][];
  theme?: string;
  note?: string;
};

export function toDraft(raw: RawDraft | null): { draft: Draft; note: string } | null {
  if (!raw || !Array.isArray(raw.items)) return null;
  const items = raw.items
    .map(toItem)
    .filter((i): i is DraftItem => i !== null)
    .slice(0, 40);
  // No page break at the very start or end, and never two in a row.
  const tidy = items.filter(
    (it, i, all) =>
      it.kind === "field" || (i > 0 && i < all.length - 1 && all[i - 1]!.kind === "field"),
  );
  if (!tidy.some((i) => i.kind === "field")) return null;

  const fields = fieldsOf(tidy);
  const title = clean(raw.title, 120) || "Untitled form";
  return {
    draft: {
      title,
      description: clean(raw.description, 300),
      welcome: { title: clean(raw.welcomeTitle, 120) || title, message: clean(raw.welcomeMessage, 400) },
      thanks: { title: clean(raw.thanksTitle, 120) || "Thank you", message: clean(raw.thanksMessage, 400) },
      items: tidy,
      rules: (Array.isArray(raw.rules) ? raw.rules : [])
        .map((r) => checkRule(r, fields))
        .filter((r): r is DraftRule => r !== null)
        .slice(0, 8),
      theme: THEME_PRESETS.some((t) => t.id === raw.theme) ? raw.theme : undefined,
    },
    note: clean(raw.note, 300),
  };
}

/** A form as the model reads it: numbered questions, pages as headings. */
export function describe(items: { kind: string; type?: string; title?: string; options?: string[]; pageName?: string; required?: boolean }[]) {
  let n = 0;
  return items
    .map((b) => {
      if (b.kind === "pagebreak") return `Page: ${b.pageName ?? "Untitled page"}`;
      n += 1;
      const opts = b.options?.length ? ` Options: ${b.options.join(" | ")}.` : "";
      return `${n}. [${b.type}${b.required ? ", required" : ""}] ${b.title ?? ""}${opts}`;
    })
    .join("\n");
}

export function draftAsJson(d: Draft) {
  return JSON.stringify({
    title: d.title,
    description: d.description,
    welcomeTitle: d.welcome.title,
    welcomeMessage: d.welcome.message,
    thanksTitle: d.thanks.title,
    thanksMessage: d.thanks.message,
    items: d.items.map((i) =>
      i.kind === "pagebreak"
        ? { kind: "page", title: i.pageName }
        : { kind: "question", type: i.type, title: i.title, help: i.help ?? "", required: i.required, options: i.options ?? [] },
    ),
    // Rules go out naming their questions, the way the model is asked to write them.
    rules: d.rules.map((r) => {
      const fields = fieldsOf(d.items);
      return { ...r, when: fields[r.when - 1]?.title ?? "", target: fields[r.target - 1]?.title ?? "" };
    }),
    theme: d.theme,
  });
}

