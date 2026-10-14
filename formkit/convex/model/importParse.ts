import type { RawDraft, RawItem } from "./aiForms";

/**
 * Reading another tool's form into a Formkit spec (model/aiForms.ts RawDraft),
 * without AI where the form's own data is on its public page: Google Forms
 * publishes its whole structure there, and a Typeform page or export carries
 * its field list. Anything that cannot be carried over is named in `skipped`,
 * so the person knows what to add by hand. Pure functions, tested on their own.
 */

export type Parsed = { spec: RawDraft; skipped: string[]; from: string };

/** The hosts a link may be read from, and only these. */
export const IMPORT_HOSTS: { test: RegExp; name: string }[] = [
  { test: /^(docs\.google\.com|forms\.gle)$/, name: "Google Forms" },
  { test: /^([a-z0-9-]+\.)?typeform\.com$/, name: "Typeform" },
  { test: /^(tally\.so|www\.tally\.so)$/, name: "Tally" },
  { test: /^([a-z0-9-]+\.)?jotform\.(com|eu)$|^form\.jotform\.com$/, name: "Jotform" },
];

export function sourceOf(url: string) {
  try {
    const u = new URL(url);
    if (u.protocol !== "https:") return null;
    return IMPORT_HOSTS.find((h) => h.test.test(u.hostname.toLowerCase()))?.name ?? null;
  } catch {
    return null;
  }
}

/** The JSON value that starts at `start` (an `{` or `[`), read with brackets balanced. */
export function balanced(text: string, start: number): string | null {
  const open = text[start];
  if (open !== "{" && open !== "[") return null;
  let depth = 0;
  let inString = false;
  for (let i = start; i < text.length && i - start < 3_000_000; i++) {
    const c = text[i];
    if (inString) {
      if (c === "\\") i++;
      else if (c === '"') inString = false;
      continue;
    }
    if (c === '"') inString = true;
    else if (c === "{" || c === "[") depth++;
    else if (c === "}" || c === "]") {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}

const s = (v: unknown) => (typeof v === "string" ? v.trim() : "");

/* ---------- Google Forms ---------- */

const GOOGLE_TYPES: Record<number, string> = {
  0: "short-text",
  1: "long-text",
  2: "single-choice",
  3: "dropdown",
  4: "multi-choice",
  5: "scale",
  9: "date",
  10: "time",
  13: "file",
  18: "rating",
};
const GOOGLE_SKIPPED: Record<number, string> = {
  6: "a block of text",
  7: "a grid question",
  11: "an image",
  12: "a video",
};

export function googleForm(html: string): Parsed | null {
  const at = html.indexOf("FB_PUBLIC_LOAD_DATA_");
  if (at < 0) return null;
  const json = balanced(html, html.indexOf("[", at));
  if (!json) return null;
  let data: unknown[];
  try {
    data = JSON.parse(json) as unknown[];
  } catch {
    return null;
  }
  const body = data[1] as unknown[] | undefined;
  if (!Array.isArray(body)) return null;
  const rawItems = (Array.isArray(body[1]) ? body[1] : []) as unknown[][];
  const items: RawItem[] = [];
  const skipped: string[] = [];
  for (const it of rawItems) {
    const title = s(it[1]);
    const type = Number(it[3]);
    const help = s(it[2]);
    if (type === 8) {
      items.push({ kind: "page", title: title || "Next page" });
      continue;
    }
    const mapped = GOOGLE_TYPES[type];
    if (!mapped) {
      skipped.push(`${title || "Untitled"} (${GOOGLE_SKIPPED[type] ?? "a kind of question Formkit does not have"})`);
      continue;
    }
    const answer = (Array.isArray(it[4]) ? it[4][0] : undefined) as unknown[] | undefined;
    const required = Array.isArray(answer) && answer[2] === 1;
    const options = (Array.isArray(answer?.[1]) ? (answer![1] as unknown[][]) : [])
      .map((o) => s(o?.[0]))
      .filter(Boolean);
    const item: RawItem = { kind: "field", type: mapped, title: title || "Untitled question", required };
    if (help) item.help = help;
    if (mapped === "single-choice" || mapped === "multi-choice" || mapped === "dropdown") item.options = options;
    items.push(item);
  }
  const title = s(body[8]) || s(data[3]) || "Imported form";
  return {
    spec: {
      title,
      description: s(body[0]),
      welcomeTitle: title,
      welcomeMessage: s(body[0]).slice(0, 400),
      items,
      rules: [],
    },
    skipped,
    from: "Google Forms",
  };
}

/* ---------- Typeform ---------- */

type TypeformField = {
  title?: string;
  type?: string;
  properties?: { description?: string; choices?: { label?: string }[]; allow_multiple_selection?: boolean; fields?: TypeformField[] };
  validations?: { required?: boolean };
};

const TYPEFORM_TYPES: Record<string, string> = {
  short_text: "short-text",
  long_text: "long-text",
  email: "email",
  phone_number: "phone",
  website: "url",
  number: "number",
  dropdown: "dropdown",
  yes_no: "yes-no",
  legal: "yes-no",
  date: "date",
  rating: "rating",
  opinion_scale: "scale",
  nps: "scale",
  file_upload: "file",
  address: "address",
  contact_info: "name",
};

function typeformItems(fields: TypeformField[], items: RawItem[], skipped: string[]) {
  for (const f of fields) {
    const title = s(f.title).replace(/\{\{[^}]*\}\}/g, "…") || "Untitled question";
    if (f.type === "group" || f.type === "inline_group") {
      if (f.type === "group" && items.length) items.push({ kind: "page", title: title.slice(0, 60) });
      typeformItems(f.properties?.fields ?? [], items, skipped);
      continue;
    }
    if (f.type === "statement") {
      skipped.push(`${title} (a statement)`);
      continue;
    }
    let type = TYPEFORM_TYPES[f.type ?? ""];
    if (f.type === "multiple_choice" || f.type === "picture_choice" || f.type === "ranking") {
      type = f.properties?.allow_multiple_selection || f.type === "ranking" ? "multi-choice" : "single-choice";
      if (f.type !== "multiple_choice") skipped.push(`${title} (a ${f.type.replace("_", " ")} question, brought in as plain choices)`);
    }
    if (!type) {
      skipped.push(`${title} (a ${String(f.type ?? "kind of").replace(/_/g, " ")} question Formkit does not have)`);
      continue;
    }
    const item: RawItem = { kind: "field", type, title, required: f.validations?.required === true };
    const help = s(f.properties?.description);
    if (help) item.help = help;
    const choices = (f.properties?.choices ?? []).map((c) => s(c.label)).filter(Boolean);
    if (choices.length) item.options = choices;
    items.push(item);
  }
}

/** A Typeform definition, from its API or an export: { title, fields, welcome_screens, thankyou_screens }. */
export function typeformDefinition(def: unknown): Parsed | null {
  const d = def as { title?: string; fields?: TypeformField[]; welcome_screens?: { title?: string; properties?: { description?: string } }[]; thankyou_screens?: { title?: string; properties?: { description?: string } }[] };
  if (!d || !Array.isArray(d.fields) || !d.fields.some((f) => f && typeof f === "object" && "type" in f)) return null;
  const items: RawItem[] = [];
  const skipped: string[] = [];
  typeformItems(d.fields, items, skipped);
  const welcome = d.welcome_screens?.[0];
  const thanks = d.thankyou_screens?.find((t) => s(t.title) && !/^default/i.test(s(t.title)));
  return {
    spec: {
      title: s(d.title) || "Imported form",
      welcomeTitle: s(welcome?.title) || s(d.title),
      welcomeMessage: s(welcome?.properties?.description),
      thanksTitle: s(thanks?.title),
      thanksMessage: s(thanks?.properties?.description),
      items,
      rules: [],
    },
    skipped,
    from: "Typeform",
  };
}

/** A Typeform page: its definition is in the page's data, when Typeform puts it there. */
export function typeformPage(html: string): Parsed | null {
  for (let at = html.indexOf('"fields":['); at >= 0; at = html.indexOf('"fields":[', at + 10)) {
    // Walk back to the object holding the fields.
    for (let open = html.lastIndexOf("{", at); open >= 0 && at - open < 200_000; open = html.lastIndexOf("{", open - 1)) {
      const json = balanced(html, open);
      if (!json || json.length < at - open) continue;
      try {
        const parsed = typeformDefinition(JSON.parse(json));
        if (parsed) return parsed;
      } catch {
        /* not this one */
      }
      break;
    }
  }
  return null;
}

/* ---------- Formkit's own spec ---------- */

export function formkitSpec(def: unknown): Parsed | null {
  const d = def as RawDraft & { questions?: RawItem[]; welcome?: { title?: string; message?: string }; thanks?: { title?: string; message?: string } };
  const items = Array.isArray(d?.items) ? d.items : Array.isArray(d?.questions) ? d.questions : null;
  if (!items || !items.some((i) => i && typeof i === "object" && "title" in i)) return null;
  return {
    spec: {
      ...d,
      items,
      welcomeTitle: d.welcomeTitle ?? d.welcome?.title,
      welcomeMessage: d.welcomeMessage ?? d.welcome?.message,
      thanksTitle: d.thanksTitle ?? d.thanks?.title,
      thanksMessage: d.thanksMessage ?? d.thanks?.message,
      rules: Array.isArray(d.rules) ? d.rules : [],
    },
    skipped: [],
    from: "a Formkit spec",
  };
}

/* ---------- Anything else: what the AI reads ---------- */

/**
 * A page reduced to what describes its form: the app's own data when the
 * page carries it (Tally's), otherwise the visible text with each field's
 * label and choices. Scripts, styles and markup are dropped.
 */
export function pageText(html: string, max = 30_000) {
  const next = html.indexOf('id="__NEXT_DATA__"');
  if (next >= 0) {
    const json = balanced(html, html.indexOf("{", next));
    if (json) {
      try {
        const data = JSON.parse(json) as { props?: { pageProps?: Record<string, unknown> } };
        const page = data.props?.pageProps ?? {};
        const keep = JSON.stringify({ form: page.form ?? page.name, blocks: page.blocks ?? page }, (_k, v: unknown) =>
          typeof v === "string" && v.length > 500 ? v.slice(0, 500) : v,
        );
        return keep.slice(0, max);
      } catch {
        /* fall through to the text */
      }
    }
  }
  return html
    .replace(/<(script|style|noscript|svg|head)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<option[^>]*>([\s\S]*?)<\/option>/gi, " [option: $1] ")
    .replace(/<(label|legend|h[1-6])[^>]*>/gi, "\n")
    .replace(/<input[^>]*type="(checkbox|radio)"[^>]*value="([^"]*)"[^>]*>/gi, " [choice: $2] ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n")
    .trim()
    .slice(0, max);
}
