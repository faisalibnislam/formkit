/**
 * Smarter forms (Pro): keys, scores, calculations and answer piping.
 *
 * A question can carry a short key ("name", "budget"). The key is how a
 * link pre-fills it (?budget=5000), how a later question, the thank-you
 * screen or the redirect quotes it ({{name}}), and how a calculation reads it
 * (quality + value * 2).
 *
 * A choice question can give each option points; a number, rating or scale
 * question counts as its own value. Calculations are small formulas over
 * those numbers and earlier calculations. The same code runs in the browser,
 * for the thank-you screen, and on the server, which is the one kept.
 *
 * Formulas are parsed by hand — numbers, keys, + − × ÷, brackets, and
 * min/max/round — never evaluated as code.
 */

export type CalcBlock = {
  _id: string;
  kind: string;
  type?: string | null;
  title?: string | null;
  key?: string | null;
  options?: string[] | null;
  scores?: number[] | null;
};

export type CalcAnswer = { value?: string; values?: string[] };

export type CalcVar = { name: string; formula: string };

const KEY = /^[a-z][a-z0-9_]{0,39}$/;

/** "What is your budget?" → "what_is_your_budget", trimmed to something typable. */
export function suggestKey(title: string | null | undefined) {
  const words = (title ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w && !["what", "is", "your", "the", "a", "an", "of", "do", "you", "how", "are", "to", "for"].includes(w));
  const key = words.slice(0, 3).join("_").replace(/^[0-9_]+/, "");
  return key || "answer";
}

export function validKey(key: string) {
  return KEY.test(key);
}

/** The number an answer stands for: its points, or itself. */
export function numberOf(block: CalcBlock, answer: CalcAnswer | undefined): number {
  if (!answer) return 0;
  const options = block.type === "yes-no" ? ["Yes", "No"] : (block.options ?? []);
  const scores = block.scores ?? [];
  if (["single-choice", "dropdown", "yes-no"].includes(block.type ?? "")) {
    const i = options.indexOf(answer.value ?? "");
    return i >= 0 ? (scores[i] ?? 0) : 0;
  }
  if (block.type === "multi-choice") {
    return (answer.values ?? []).reduce((n, v) => {
      const i = options.indexOf(v);
      return n + (i >= 0 ? (scores[i] ?? 0) : 0);
    }, 0);
  }
  const n = Number(String(answer.value ?? "").replace(/[, ]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

/* ---------- a small, safe expression parser ---------- */

type Token = { t: "num"; v: number } | { t: "id"; v: string } | { t: "op"; v: string };

function tokenize(src: string): Token[] | null {
  const out: Token[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i]!;
    if (/\s/.test(c)) {
      i++;
    } else if (/[0-9.]/.test(c)) {
      let j = i;
      while (j < src.length && /[0-9.]/.test(src[j]!)) j++;
      const n = Number(src.slice(i, j));
      if (!Number.isFinite(n)) return null;
      out.push({ t: "num", v: n });
      i = j;
    } else if (/[a-z_]/i.test(c)) {
      let j = i;
      while (j < src.length && /[a-z0-9_]/i.test(src[j]!)) j++;
      out.push({ t: "id", v: src.slice(i, j).toLowerCase() });
      i = j;
    } else if ("+-*/(),×÷".includes(c)) {
      out.push({ t: "op", v: c === "×" ? "*" : c === "÷" ? "/" : c });
      i++;
    } else {
      return null;
    }
  }
  return out;
}

const FUNCS: Record<string, (args: number[]) => number> = {
  min: (a) => (a.length ? Math.min(...a) : 0),
  max: (a) => (a.length ? Math.max(...a) : 0),
  round: (a) => {
    const places = Math.max(0, Math.min(6, Math.floor(a[1] ?? 0)));
    const f = 10 ** places;
    return Math.round((a[0] ?? 0) * f) / f;
  },
  abs: (a) => Math.abs(a[0] ?? 0),
};

/**
 * Evaluates a formula against named numbers. Returns null — never throws —
 * for anything that does not parse, so a half-typed formula reads as "not
 * yet" rather than breaking the form.
 */
export function evaluate(formula: string, env: Record<string, number>): number | null {
  const tokens = tokenize(formula);
  if (!tokens || !tokens.length) return null;
  let pos = 0;
  const peek = () => tokens[pos];
  const take = () => tokens[pos++];

  function primary(): number | null {
    const tok = take();
    if (!tok) return null;
    if (tok.t === "num") return tok.v;
    if (tok.t === "op" && tok.v === "-") {
      const v = primary();
      return v === null ? null : -v;
    }
    if (tok.t === "op" && tok.v === "(") {
      const v = expr();
      if (take()?.v !== ")") return null;
      return v;
    }
    if (tok.t === "id") {
      // Own keys only: "constructor" is a key like any other, not a method.
      const fn = Object.prototype.hasOwnProperty.call(FUNCS, tok.v) ? FUNCS[tok.v] : undefined;
      if (fn && peek()?.v === "(") {
        take();
        const args: number[] = [];
        if (peek()?.v !== ")") {
          for (;;) {
            const a = expr();
            if (a === null) return null;
            args.push(a);
            if (peek()?.v === ",") take();
            else break;
          }
        }
        if (take()?.v !== ")") return null;
        return fn(args);
      }
      return Object.prototype.hasOwnProperty.call(env, tok.v) ? (env[tok.v] ?? 0) : 0;
    }
    return null;
  }
  function term(): number | null {
    let left = primary();
    while (left !== null && (peek()?.v === "*" || peek()?.v === "/")) {
      const op = take()!.v;
      const right = primary();
      if (right === null) return null;
      left = op === "*" ? left * right : right === 0 ? 0 : left / right;
    }
    return left;
  }
  function expr(): number | null {
    let left = term();
    while (left !== null && (peek()?.v === "+" || peek()?.v === "-")) {
      const op = take()!.v;
      const right = term();
      if (right === null) return null;
      left = op === "+" ? left + right : left - right;
    }
    return left;
  }
  const value = expr();
  if (value === null || pos !== tokens.length || !Number.isFinite(value)) return null;
  return Math.round(value * 1e6) / 1e6;
}

/** The keys a formula mentions that are neither a question nor an earlier result. */
export function unknownKeys(formula: string, known: Set<string>) {
  const tokens = tokenize(formula) ?? [];
  return [...new Set(tokens.filter((t) => t.t === "id" && !Object.prototype.hasOwnProperty.call(FUNCS, t.v) && !known.has(t.v)).map((t) => t.v as string))];
}

/**
 * Every calculation, in order — each can use the questions and the ones
 * before it.
 */
export function computeAll(vars: CalcVar[], blocks: CalcBlock[], answers: Record<string, CalcAnswer | undefined>) {
  const env: Record<string, number> = {};
  for (const b of blocks) {
    if (b.kind === "field" && b.key) env[b.key] = numberOf(b, answers[b._id]);
  }
  const results: Record<string, number> = {};
  for (const v of vars) {
    if (!validKey(v.name)) continue;
    const n = evaluate(v.formula, env);
    const value = n ?? 0;
    results[v.name] = value;
    env[v.name] = value;
  }
  return results;
}

/** What `{{key}}` becomes: an answer as the person gave it, or a result. */
export function pipeValues(
  blocks: CalcBlock[],
  answers: Record<string, CalcAnswer | undefined>,
  results: Record<string, number> = {},
) {
  const out: Record<string, string> = {};
  for (const b of blocks) {
    if (b.kind !== "field" || !b.key) continue;
    const a = answers[b._id];
    out[b.key] = a?.values?.length ? a.values.join(", ") : (a?.value ?? "");
  }
  for (const [k, n] of Object.entries(results)) out[k] = n.toLocaleString("en-US");
  return out;
}

/** Replaces {{key}} in text; an unknown or unanswered key becomes nothing. */
export function pipe(text: string | null | undefined, values: Record<string, string>, encode = false) {
  if (!text) return text ?? "";
  return text.replace(/\{\{\s*([a-z][a-z0-9_]*)\s*\}\}/gi, (_, k: string) => {
    const key = k.toLowerCase();
    const v = Object.prototype.hasOwnProperty.call(values, key) ? (values[key] ?? "") : "";
    return encode ? encodeURIComponent(v) : v;
  });
}
