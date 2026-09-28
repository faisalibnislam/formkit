/**
 * The comparison with Google Forms and Typeform.
 *
 * Standing rule: competitors are named only here, with no logos, brand colours,
 * screenshots or claims about what they cannot do. Every row is sourced to each
 * product's published free tier as of September 2026, and a dash means
 * "offered but narrower", never "missing".
 */

export const COMPARE_ASOF = "September 2026";

export type CellKind = "yes" | "part" | "no";
export type Cell = { kind: CellKind; note: string };

/** Column order: Google Forms, Typeform, Formkit. */
export type CompareRow = { label: string; cells: [Cell, Cell, Cell] };

const y = (note: string): Cell => ({ kind: "yes", note });
const p = (note: string): Cell => ({ kind: "part", note });
const n = (note: string): Cell => ({ kind: "no", note });

export const COLUMNS = ["Google Forms", "Typeform", "Formkit"] as const;

export const COMPARE_ROWS: CompareRow[] = [
  {
    label: "Unlimited forms and responses",
    cells: [y("Included"), p("Capped per month"), y("Included")],
  },
  {
    label: "Conditional logic",
    cells: [y("Section skipping"), y("Logic jumps"), y("Skip, show, hide")],
  },
  {
    label: "Your own colours, type and logo",
    cells: [p("Colour and header"), y("Themes"), y("Full theme editor")],
  },
  {
    label: "Publish under your own link",
    cells: [n("Shared domain"), p("Paid plans"), y("Personal and company handles")],
  },
  {
    label: "One question at a time",
    cells: [n("Page-based"), y("Conversational"), y("Classic or conversational")],
  },
  {
    label: "Partial responses kept",
    cells: [n("Submitted only"), y("Partials shown"), y("On every plan")],
  },
  {
    label: "Drop-off by question",
    cells: [n("Summary charts"), y("Completion reporting"), y("Per question, every plan")],
  },
  {
    label: "Version history with restore",
    cells: [n("Not offered"), n("Not offered"), y("30 days of publishes")],
  },
  {
    label: "CSV and spreadsheet export",
    cells: [y("Sheets and CSV"), y("CSV and XLSX"), y("CSV; Excel on Pro")],
  },
  {
    label: "Collaborators on the free tier",
    cells: [y("Editors"), p("Paid seats"), y("Three per form, unlimited on Pro")],
  },
];

export type Rival = {
  slug: string;
  name: string;
  /** Which column of COMPARE_ROWS this product occupies. */
  column: 0 | 1;
  line: string;
  meta: string;
  /** "Pick <them> when …" */
  when: string;
  /** "Pick Formkit when …" */
  ourWhen: string;
  faqs: { q: string; a: string }[];
};

export const RIVALS: Rival[] = [
  {
    slug: "google-forms",
    name: "Google Forms",
    column: 0,
    line: "Fast, familiar and practical. If you have a Google account you already have it, and for straightforward internal collection that is often the whole argument.",
    meta: "Formkit compared with Google Forms on the free tier: branding, conditional logic, partial responses, analytics and publishing under your own link.",
    when: "the form is internal, the look does not matter, and you want the answers in a spreadsheet in the next five minutes.",
    ourWhen:
      "the form goes to a client and carries your name, or you need to know which question people stop on.",
    faqs: [
      {
        q: "Is Formkit a replacement for Google Forms?",
        a: "For client-facing work, yes. For a quick internal poll, Google Forms is genuinely hard to beat on speed — you are already signed in.",
      },
      {
        q: "Can I move my existing forms across?",
        a: "There is no importer. Formkit templates cover the common cases, and rebuilding a short form takes a few minutes.",
      },
      {
        q: "Does Formkit export to Sheets?",
        a: "Formkit exports CSV, which Sheets opens directly. On Pro, new responses also flow into a Google Sheet as they arrive.",
      },
      {
        q: "Which one is better for a long form?",
        a: "Both support pages. On every plan, Formkit keeps partial responses and shows you the question people abandon on, which matters more the longer the form gets.",
      },
    ],
  },
  {
    slug: "typeform",
    name: "Typeform",
    column: 1,
    line: "Conversation-led forms with a polished respondent experience. It made one-question-at-a-time the default expectation for a considered form.",
    meta: "Formkit compared with Typeform on the free tier: response limits, conversational mode, branding, custom links, version history and collaborator cost.",
    when: "the conversational format is the point and you are happy within the free tier response cap.",
    ourWhen:
      "you need unlimited responses, your own link, or several people working on the form without paying per seat.",
    faqs: [
      {
        q: "Does Formkit do one question at a time?",
        a: "Yes. Conversational mode presents one question per screen with a sticky submit; classic mode puts everything on one page. It is a setting on the form.",
      },
      {
        q: "What about response limits?",
        a: "Formkit does not cap responses. Typeform's free tier does — check their current figure, as it changes.",
      },
      {
        q: "Can I publish under my own domain?",
        a: "Formkit gives you formkit.app/your-name free. A fully custom domain, like forms.acme.com, is on Formkit Pro from $3 a month; neither product offers one on a free tier.",
      },
      {
        q: "How many people can work on a form?",
        a: "Two per form on Formkit's free plan, as Editor, Commenter or Viewer, and a whole team with unlimited seats on Business at $10 a month.",
      },
    ],
  },
];

export function rivalBySlug(slug: string) {
  return RIVALS.find((r) => r.slug === slug) ?? null;
}
