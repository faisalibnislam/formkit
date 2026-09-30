/**
 * The comparisons with other form builders.
 *
 * Standing rule: competitors are named only here, with no logos, brand colours,
 * screenshots or claims we cannot back up. Every row is sourced to each
 * product's published pricing page as of September 2026 (the free plan unless
 * the row says otherwise), and a dash means "offered but narrower".
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
  /** When this page last changed (YYYY-MM-DD), for the sitemap. */
  updated?: string;
  name: string;
  /** Which column of COMPARE_ROWS this product occupies, for the two on the hub table. */
  column?: 0 | 1;
  /**
   * The rest have their own rows: only what we could check on their pricing
   * page, set against Formkit's free plan unless the label says otherwise.
   */
  rows?: { label: string; them: Cell; us: Cell }[];
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
        a: "For client-facing work, yes. For a quick internal poll, Google Forms is genuinely hard to beat on speed. You are already signed in.",
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
        a: "Formkit does not cap responses. Typeform's free tier does. Check their current figure, as it changes.",
      },
      {
        q: "Can I publish under my own domain?",
        a: "Formkit gives you formkit.app/your-name free. A fully custom domain, like forms.acme.com, is on Formkit Pro from $6 a seat a month; neither product offers one on a free tier.",
      },
      {
        q: "How many people can work on a form?",
        a: "Three guests per form on Formkit's free plan, as Editor, Commenter or Viewer, plus unlimited members in each company. Pro and Business allow unlimited guests.",
      },
    ],
  },
  {
    slug: "jotform",
    updated: "2026-09-30",
    name: "Jotform",
    line: "A huge form builder with thousands of templates, widgets and integrations. It has been around for years and covers almost every kind of form.",
    meta: "Formkit compared with Jotform on the free plan: form and submission limits, logic, AI building, collaborators and publishing under your own link.",
    when: "you need a very specific widget or integration from its large catalogue and a few forms with modest traffic will do.",
    ourWhen: "you need more than five forms or a hundred answers a month without paying, or a team working on the same forms.",
    rows: [
      { label: "Forms and responses", them: p("5 forms, 100 submissions a month"), us: y("Unlimited") },
      { label: "Conditional logic", them: y("Conditions"), us: y("Skip, show, hide") },
      { label: "Build a form with AI", them: y("AI form builder"), us: y("3 builds and 10 edits a month") },
      { label: "Publish under your own link", them: n("Shared domain"), us: y("formkit.app/your-name") },
      { label: "People working on a form", them: p("One user on Starter"), us: y("Unlimited members, 3 guests per form") },
      { label: "Take payments", them: y("10 payments a month free"), us: p("Pro, with your own Stripe") },
      { label: "Price of the first paid plan", them: p("Bronze, $39 a month"), us: y("Pro, $6 a seat a month") },
    ],
    faqs: [
      {
        q: "Is Formkit as big as Jotform?",
        a: "No. Jotform has far more widgets, templates and integrations. Formkit covers the forms most teams run and keeps the builder simpler.",
      },
      {
        q: "Why does the response limit matter?",
        a: "Jotform's free Starter plan allows 100 submissions a month across 5 active forms. Formkit's free plan has no cap on forms or responses.",
      },
      {
        q: "Can I take payments on the free plan?",
        a: "Not on Formkit. Payments through your own Stripe account are on Pro. Jotform lets you take a small number of payments on its free plan.",
      },
      {
        q: "Can I move my Jotform forms across?",
        a: "There is no importer. Describe the form to Formkit's AI builder or start from a template, and a short form takes a few minutes.",
      },
    ],
  },
  {
    slug: "tally",
    updated: "2026-09-30",
    name: "Tally",
    line: "A generous free form builder that feels like writing a document. Type your questions and it becomes a form.",
    meta: "Formkit compared with Tally on the free plan: logic, partial responses, drop-off analytics, collaborators, version history and your own link.",
    when: "you work alone, you like the document-style editor, and you want many integrations on the free plan.",
    ourWhen: "several people work on your forms, or you want partial responses, drop-off by question and version history without paying.",
    rows: [
      { label: "Unlimited forms and responses", them: y("Within fair use"), us: y("Included") },
      { label: "Conditional logic", them: y("Logic and calculations"), us: y("Skip, show, hide; calculations on Pro") },
      { label: "Partial responses kept", them: n("Pro"), us: y("On every plan") },
      { label: "Drop-off by question", them: n("Pro"), us: y("On every plan") },
      { label: "Version history with restore", them: n("Pro"), us: y("30 days on Free") },
      { label: "People working on a form", them: n("Pro"), us: y("Unlimited members, 3 guests per form") },
      { label: "Sheets, Zapier and webhooks", them: y("On the free plan"), us: p("Pro") },
      { label: "Publish under your own link", them: n("Custom domain on Pro"), us: y("formkit.app/your-name") },
    ],
    faqs: [
      {
        q: "Tally is free too. Why switch?",
        a: "If you work alone and your forms are simple, you may not need to. Formkit's free plan adds things Tally keeps for Pro: partial responses, drop-off by question, version history and people working together.",
      },
      {
        q: "Which one has more integrations for free?",
        a: "Tally. It connects to Google Sheets, Notion, Airtable, Zapier, Make and webhooks on its free plan. On Formkit, Sheets, Slack, Zapier, Make and webhooks are on Pro.",
      },
      {
        q: "How do the paid plans compare?",
        a: "Tally Pro is $24 a month. Formkit Pro is $6 a seat a month, so a team of three or fewer pays less on Formkit.",
      },
      {
        q: "Does Formkit build forms with AI?",
        a: "Yes. Describe the form and Formkit writes the questions. The free plan includes 3 builds and 10 edits a month, and Pro can also build from a brief or a document.",
      },
    ],
  },
  {
    slug: "fillout",
    updated: "2026-09-30",
    name: "Fillout",
    line: "A capable form builder with a generous free response limit and strong ties to Airtable, Notion and other databases.",
    meta: "Formkit compared with Fillout on the free plan: response limits, logic, partial responses, collaborators and custom domains.",
    when: "your forms read from or write to Airtable or Notion and a thousand responses a month is enough.",
    ourWhen: "you want unlimited responses, partial responses on the free plan, and a custom domain without the top plan.",
    rows: [
      { label: "Responses", them: p("1,000 a month"), us: y("Unlimited") },
      { label: "Conditional logic", them: y("Included"), us: y("Skip, show, hide") },
      { label: "People working on a form", them: y("Unlimited seats"), us: y("Unlimited members, 3 guests per form") },
      { label: "Partial responses kept", them: n("Paid plans"), us: y("On every plan") },
      { label: "Publish under your own link", them: n("Shared domain"), us: y("formkit.app/your-name") },
      { label: "Custom domain", them: p("Business plan, $75 a month"), us: p("Pro, $6 a seat a month") },
    ],
    faqs: [
      {
        q: "Which is better with Airtable or Notion?",
        a: "Fillout. It is built around those tools. Formkit connects to Google Sheets, Slack, Zapier, Make and webhooks on Pro.",
      },
      {
        q: "What happens after 1,000 responses?",
        a: "On Fillout's free plan, that is the monthly limit. Formkit does not cap responses on any plan.",
      },
      {
        q: "Can I use my own domain?",
        a: "On Formkit, a domain like forms.acme.com is on Pro from $6 a seat a month. On Fillout, custom domains are on the Business plan.",
      },
      {
        q: "Does Formkit do one question at a time?",
        a: "Yes. Conversational mode shows one question per screen, and classic mode shows the whole page. It is a setting on each form.",
      },
    ],
  },
  {
    slug: "microsoft-forms",
    updated: "2026-09-30",
    name: "Microsoft Forms",
    line: "Simple forms and quizzes built into Microsoft 365. If your school or company runs on Microsoft, it is already there.",
    meta: "Formkit compared with Microsoft Forms for personal accounts: response limits, branching, themes, your own link and export.",
    when: "everyone filling it in is inside your Microsoft 365 organisation and the answers belong in Excel.",
    ourWhen: "the form goes outside your organisation, carries your brand, or needs more than a couple of hundred answers on a personal account.",
    rows: [
      { label: "Responses", them: p("200 per form on personal accounts"), us: y("Unlimited") },
      { label: "Conditional logic", them: y("Branching"), us: y("Skip, show, hide") },
      { label: "Your own colours, type and logo", them: p("Built-in themes"), us: y("Full theme editor") },
      { label: "Publish under your own link", them: n("Shared domain"), us: y("formkit.app/your-name") },
      { label: "Export", them: y("Excel"), us: y("CSV; Excel on Pro") },
    ],
    faqs: [
      {
        q: "Microsoft Forms comes with our subscription. Why pay for anything else?",
        a: "For internal forms you may not need to. Formkit is for forms people outside your organisation see: your brand, your link, and logic that sends each person down the right path.",
      },
      {
        q: "Does Formkit do quizzes?",
        a: "Yes, on Pro: marking, a timer and results. See the quizzes page for how it works.",
      },
      {
        q: "Are there response limits?",
        a: "Microsoft Forms on a personal account allows 200 responses per form. Work and school accounts allow far more. Formkit does not cap responses on any plan.",
      },
      {
        q: "Can I get the answers into Excel?",
        a: "Yes. Every plan exports CSV, which Excel opens. Pro adds a native Excel export.",
      },
    ],
  },
  {
    slug: "surveymonkey",
    updated: "2026-09-30",
    name: "SurveyMonkey",
    line: "A long-standing survey tool with deep analysis, benchmarks and panels for research at scale.",
    meta: "Formkit compared with SurveyMonkey's free Basic plan: questions per survey, responses you can see, logic and export.",
    when: "you run large research surveys and need statistical analysis, benchmarks or a panel of respondents.",
    ourWhen: "you want every answer you collect, logic and export without a paid plan, and a form that looks like your brand.",
    rows: [
      { label: "Questions per form", them: p("10 per survey on Basic"), us: y("No limit") },
      { label: "Responses you can see", them: p("A limited number per survey"), us: y("All of them") },
      { label: "Conditional logic", them: n("Paid plans"), us: y("Skip, show, hide") },
      { label: "Export", them: n("Paid plans"), us: y("CSV on every plan") },
      { label: "Publish under your own link", them: n("Shared domain"), us: y("formkit.app/your-name") },
    ],
    faqs: [
      {
        q: "Is Formkit a survey tool?",
        a: "It works well for surveys: NPS, satisfaction, event and course feedback all have templates. For panels, benchmarks and statistical tests, SurveyMonkey goes further.",
      },
      {
        q: "Can I see every response on the free plan?",
        a: "On Formkit, yes, however many come in. SurveyMonkey's Basic plan collects responses but only shows a limited number per survey.",
      },
      {
        q: "How do the prices compare?",
        a: "SurveyMonkey's team plans start at $30 a user a month, billed yearly, with a minimum of three users. Formkit Pro is $6 a seat a month.",
      },
      {
        q: "Can AI read the responses for me?",
        a: "Yes, on Pro. For forms with AI replies on, Formkit sums up what people said and what they want. See the AI insights page.",
      },
    ],
  },
  {
    slug: "paperform",
    updated: "2026-09-30",
    name: "Paperform",
    line: "A form builder that works like a page editor, with rich layouts, payments and bookings, aimed at small businesses.",
    meta: "Formkit compared with Paperform on the free plan: submission limits, logic, users and building with AI.",
    when: "the form is really a landing page with products or bookings on it and you have a paid plan in the budget.",
    ourWhen: "you need more than 30 answers a month for free, or a paid plan priced by seat rather than a flat monthly fee.",
    rows: [
      { label: "Submissions", them: p("30 a month"), us: y("Unlimited") },
      { label: "Conditional logic", them: y("Included"), us: y("Skip, show, hide") },
      { label: "People working on a form", them: y("Unlimited users"), us: y("Unlimited members, 3 guests per form") },
      { label: "Build a form with AI", them: y("AI form creation"), us: y("3 builds and 10 edits a month") },
      { label: "Price of the first paid plan", them: p("Pro, $49 a month billed yearly"), us: y("Pro, $6 a seat a month") },
    ],
    faqs: [
      {
        q: "Which one is better for selling things?",
        a: "Paperform has more for products, bookings and page-style layouts. Formkit takes payments through your own Stripe account on Pro, which covers deposits, fees and simple orders.",
      },
      {
        q: "How many answers can I collect for free?",
        a: "Paperform's free plan allows 30 submissions a month. Formkit's free plan does not cap them.",
      },
      {
        q: "Do both build forms with AI?",
        a: "Yes. On Formkit you describe the form and it writes the questions. The free plan includes 3 AI builds and 10 AI edits a month, and Pro can also build from a brief or a document.",
      },
      {
        q: "Can I remove the badge?",
        a: "Neither free plan removes it. On Formkit, Pro removes “Made with Formkit” from $6 a seat a month.",
      },
    ],
  },
];

export function rivalBySlug(slug: string) {
  return RIVALS.find((r) => r.slug === slug) ?? null;
}
