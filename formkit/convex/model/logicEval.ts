/**
 * What a form's logic means, in one place: the form a person fills in, the
 * builder's tester and map, and the server all read rules through this file.
 *
 * A rule is one or more groups of conditions. Each group joins its own
 * conditions with AND or OR; the groups are joined by the rule's `join`.
 * Older rules have a flat list of conditions and no groups - read as one
 * group joined by `join`.
 *
 * A condition reads an answer, a calculation's result, or (Business) an AI
 * judgement about an answer, which the form asks for when the question's page
 * is finished and which falls back to the owner's chosen answer until then.
 */

export type Source = "answer" | "calc" | "ai";

export type Condition = {
  /** Stable id, for AI judgements and the tester. */
  id?: string;
  source?: Source;
  blockId?: string;
  /** A calculation's name, when `source` is "calc". */
  ref?: string;
  operator: string;
  value?: string;
  /** The upper end of "between". */
  value2?: string;
  /** For an AI condition: what to assume until (or unless) the AI answers. */
  fallback?: boolean;
};

export type Group = { join: "and" | "or"; conditions: Condition[] };

export type Action = "show" | "hide" | "require" | "jump" | "hide-options" | "ending";

export type Rule = {
  _id?: string;
  enabled?: boolean;
  join: "and" | "or";
  conditions: Condition[];
  groups?: Group[] | null;
  action: Action;
  targetId?: string | null;
  /** The options "hide-options" hides. */
  options?: string[] | null;
  /** The ending "ending" shows. */
  endingId?: string | null;
};

export type Answer = { value?: string; values?: string[]; fileId?: unknown; fileName?: string };

export type LogicContext = {
  answers: Record<string, Answer | undefined>;
  calc?: Record<string, number>;
  /** AI judgements by condition id: true, false, or not known yet. */
  ai?: Record<string, boolean | undefined>;
  /** Question types by id, so dates and numbers compare as what they are. */
  types?: Record<string, string | null | undefined>;
};

/** Operators that take no value. */
export const VALUELESS = new Set(["is-empty", "is-not-empty", "yes", "no"]);

/** The groups a rule is made of, whatever its age. */
export function groupsOf(rule: Pick<Rule, "join" | "conditions" | "groups">): Group[] {
  if (rule.groups && rule.groups.length) return rule.groups;
  return [{ join: rule.join, conditions: rule.conditions }];
}

/** Every condition in a rule, flattened - for editors, checks and the map. */
export function conditionsOf(rule: Pick<Rule, "join" | "conditions" | "groups">) {
  return groupsOf(rule).flatMap((g) => g.conditions);
}

const num = (s: string) => {
  const n = Number(String(s).replace(/[, ]/g, "").trim());
  return Number.isFinite(n) ? n : NaN;
};

/** A date answer or value as a day number, whatever way round it was typed. */
function day(s: string) {
  const t = s.trim();
  if (!t) return NaN;
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(t);
  if (iso) return Date.UTC(+iso[1]!, +iso[2]! - 1, +iso[3]!) / 86_400_000;
  const us = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(t);
  if (us) return Date.UTC(+us[3]!, +us[1]! - 1, +us[2]!) / 86_400_000;
  const d = Date.parse(t);
  return Number.isFinite(d) ? Math.floor(d / 86_400_000) : NaN;
}

/** A pattern the owner typed. A broken or catastrophic one simply never matches. */
function safeMatch(pattern: string, text: string) {
  if (pattern.length > 200 || text.length > 5000) return false;
  try {
    return new RegExp(pattern, "i").test(text);
  } catch {
    return false;
  }
}

export function conditionHolds(c: Condition, ctx: LogicContext): boolean {
  if (c.source === "ai") {
    const judged = c.id ? ctx.ai?.[c.id] : undefined;
    const yes = judged ?? !!c.fallback;
    return c.operator === "no" ? !yes : yes;
  }

  let given: string;
  let values: string[] | undefined;
  let type: string | null | undefined;
  if (c.source === "calc") {
    const r = c.ref ? ctx.calc?.[c.ref] : undefined;
    given = r === undefined ? "" : String(r);
    type = "number";
  } else {
    if (!c.blockId) return false;
    const a = ctx.answers[c.blockId];
    values = a?.values;
    given = a?.values?.join(", ") ?? a?.value ?? a?.fileName ?? "";
    type = ctx.types?.[c.blockId];
  }

  const want = c.value ?? "";
  const low = (x: string) => x.trim().toLowerCase();
  const same = (x: string) => low(x) === low(want);
  // A multiple-choice answer "is" an option when that option is among those picked.
  const is = values ? values.some(same) : same(given);
  const wants = want
    .split("|")
    .map(low)
    .filter(Boolean);
  const empty = given.trim() === "";

  switch (c.operator) {
    case "is":
      return is;
    case "is-not":
      return !is;
    case "any-of":
      return values ? values.some((v) => wants.includes(low(v))) : wants.includes(low(given));
    case "none-of":
      return values ? !values.some((v) => wants.includes(low(v))) : !wants.includes(low(given));
    case "contains":
      return low(given).includes(low(want));
    case "not-contains":
      return !low(given).includes(low(want));
    case "starts-with":
      return low(given).startsWith(low(want));
    case "ends-with":
      return low(given).endsWith(low(want));
    case "email-domain": {
      const domain = low(given).split("@")[1] ?? "";
      const w = low(want).replace(/^@/, "");
      return !!domain && (domain === w || domain.endsWith(`.${w}`));
    }
    case "matches":
      return !empty && safeMatch(want, given);
    case "is-empty":
      return empty;
    case "is-not-empty":
      return !empty;
    case "equals":
      return !empty && num(given) === num(want);
    case "at-least":
      return !empty && num(given) >= num(want);
    case "at-most":
      return !empty && num(given) <= num(want);
    case "greater":
      return !empty && num(given) > num(want);
    case "less":
      return !empty && num(given) < num(want);
    case "between": {
      if (empty) return false;
      if (type === "date") {
        const d = day(given);
        return d >= day(want) && d <= day(c.value2 ?? "");
      }
      const n = num(given);
      return n >= num(want) && n <= num(c.value2 ?? "");
    }
    case "before":
      return !empty && day(given) < day(want);
    case "after":
      return !empty && day(given) > day(want);
    case "on":
      return !empty && day(given) === day(want);
    default:
      return false;
  }
}

export function ruleMatches(rule: Rule, ctx: LogicContext) {
  const groups = groupsOf(rule).filter((g) => g.conditions.length);
  if (!groups.length) return false;
  const results = groups.map((g) => {
    const r = g.conditions.map((c) => conditionHolds(c, ctx));
    return g.join === "or" ? r.some(Boolean) : r.every(Boolean);
  });
  return rule.join === "or" ? results.some(Boolean) : results.every(Boolean);
}

export type LogicOutcome = {
  hidden: Set<string>;
  forced: Set<string>;
  jumpTo: string | null;
  /** Options hidden on a question, by question id. */
  hiddenOptions: Map<string, Set<string>>;
  /** The ending to show, from the first matching "ending" rule. */
  ending: string | null;
};

/** Everything the rules say, for one set of answers. Rules run top to bottom. */
export function applyLogic(rules: Rule[], ctx: LogicContext): LogicOutcome {
  const out: LogicOutcome = { hidden: new Set(), forced: new Set(), jumpTo: null, hiddenOptions: new Map(), ending: null };
  for (const rule of rules) {
    if (rule.enabled === false) continue;
    if (rule.action === "ending") {
      if (out.ending === null && rule.endingId && ruleMatches(rule, ctx)) out.ending = rule.endingId;
      continue;
    }
    if (!rule.targetId) continue;
    const hit = ruleMatches(rule, ctx);
    if (rule.action === "show" && !hit) out.hidden.add(rule.targetId);
    if (rule.action === "hide" && hit) out.hidden.add(rule.targetId);
    if (rule.action === "require" && hit) out.forced.add(rule.targetId);
    if (rule.action === "jump" && hit && out.jumpTo === null) out.jumpTo = rule.targetId;
    if (rule.action === "hide-options" && hit && rule.options?.length) {
      const set = out.hiddenOptions.get(rule.targetId) ?? new Set<string>();
      for (const o of rule.options) set.add(o);
      out.hiddenOptions.set(rule.targetId, set);
    }
  }
  return out;
}
