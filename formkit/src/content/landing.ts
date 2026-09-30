/**
 * The landing page's content.
 *
 * One continuous story on Client onboarding / Maya Okafor / Northstar website
 * redesign - 8 of 11 questions, 72.5%, 2 minutes ago - reused across every
 * section, so the page reads as one form travelling through the product.
 *
 * The four brand marks (Northstar, Merrow, Velto, Fieldnote) are invented and
 * appear only as selectable answers inside a form question. They are never
 * presented as customer proof.
 */

export const FLOATIES = [
  { kind: "check", depth: 26, pos: { left: "6%", top: "24%" } },
  { kind: "toggle", depth: 40, pos: { right: "9%", top: "20%" } },
  { kind: "radio", depth: 18, pos: { left: "11%", bottom: "24%" } },
  { kind: "stars", depth: 34, pos: { right: "12%", bottom: "27%" } },
  { kind: "field", depth: 14, pos: { left: "3%", top: "52%" } },
  { kind: "upload", depth: 30, pos: { right: "4%", top: "56%" } },
] as const;

export const EDITOR_TABS = [
  { icon: "list-checks", label: "Build", note: "Questions", on: true },
  { icon: "palette", label: "Design", note: "Theme and branding" },
  { icon: "git-branch", label: "Logic", note: "Conditional rules" },
  { icon: "inbox", label: "Responses", note: "Submissions" },
  { icon: "chart-pie", label: "Analytics", note: "Views and drop-off" },
  { icon: "settings-2", label: "Settings", note: "Access and replies" },
];

/** Groups and order as the app's field library presents them. */
export const FIELD_GROUPS = [
  { group: "Text", items: ["Short text", "Long text", "Number"] },
  { group: "Contact", items: ["Email", "Phone", "Website", "Name"] },
  { group: "Choice", items: ["Multiple choice", "Dropdown", "Rating"] },
];

export const FIELD_ICONS: Record<string, string> = {
  "Short text": "type",
  "Long text": "message-square",
  Number: "sliders-horizontal",
  Email: "at-sign",
  Phone: "user",
  Website: "globe",
  Name: "user",
  "Multiple choice": "list-checks",
  Dropdown: "compass",
  Rating: "star",
};

export const PAGES_PANEL = [
  { no: "01", name: "Welcome screen", count: "Intro" },
  { no: "02", name: "About you", count: "3" },
  { no: "03", name: "Your project", count: "5" },
];

/** The builder canvas: three cards, cropped at the foot. */
export const HERO_ROWS = [
  {
    no: "01",
    type: "Email",
    q: "Where should we send the proposal?",
    required: true,
    selected: true,
    placeholder: "you@company.com",
  },
  {
    no: "02",
    type: "Multiple choice",
    q: "Which brand is this brief for?",
    required: true,
    placeholder: "Northstar · Merrow · Velto · Fieldnote",
  },
  {
    no: "03",
    type: "File upload",
    q: "Anything we should read first?",
    placeholder: "Select a file, or drop it here",
  },
];

export const RANGES = ["7 days", "30 days", "90 days", "Custom"];

/**
 * The feature cards, desktop track and mobile grid alike. Each chip says
 * which plan has it, in the same words as the pricing page.
 */
export const FEATURES = [
  {
    icon: "sparkles",
    bg: "var(--blue-200)",
    title: "Build with AI",
    body: "Describe the form and Ask Formkit drafts it: questions, pages and logic. On Pro it can start from a brief or a document too.",
    chip: "3 a month free · 50 a seat on Pro",
  },
  {
    icon: "layout-template",
    bg: "var(--blue-300)",
    title: "Drag-and-drop builder",
    body: "Sixteen question types. Drag a card to move it, copy it or split the form into pages. Everything saves as you type.",
    chip: "Every plan",
  },
  {
    icon: "git-branch",
    bg: "var(--mint-200)",
    title: "Logic in plain words",
    body: "Skip a page, ask a follow-up, or hide what does not apply. Pro adds several endings, hidden options and limited places.",
    chip: "Every plan",
  },
  {
    icon: "brain",
    bg: "var(--yellow-200)",
    title: "AI logic",
    body: "Let the AI read an answer and decide where someone goes next, or pull facts out of it, like a budget or a company size.",
    chip: "Pro",
  },
  {
    icon: "calculator",
    bg: "var(--blue-200)",
    title: "Calculations and quizzes",
    body: "Add answers up into a price or a score. Quizzes add right answers, a timer, marking by hand and results released when you choose.",
    chip: "Pro",
  },
  {
    icon: "mail",
    bg: "var(--mint-200)",
    title: "AI replies",
    body: "A personal reply to every response, written from your instructions and your own facts, on the thank-you screen or by email.",
    chip: "Pro",
  },
  {
    icon: "scan-search",
    bg: "var(--neutral-150)",
    title: "AI insights",
    body: "How people feel, what they want and how promising each lead is, plus a written report of what stands out across responses.",
    chip: "Pro",
  },
  {
    icon: "credit-card",
    bg: "var(--yellow-200)",
    title: "Payments",
    body: "Charge a fixed amount or a calculated total through your own Stripe account. The money goes straight to you; Formkit takes nothing.",
    chip: "Pro",
  },
  {
    icon: "webhook",
    bg: "var(--blue-300)",
    title: "Connections",
    body: "Slack, Google Sheets, Zapier, Make and signed webhooks, the moment a response lands.",
    chip: "Pro",
  },
  {
    icon: "palette",
    bg: "var(--red-200)",
    title: "Your brand, your domain",
    body: "Ten ready-made looks, then your colours, type and logo, at formkit.app/you. Pro puts it on forms.yourcompany.com with no Formkit badge.",
    chip: "Domain on Pro",
  },
  {
    icon: "inbox",
    bg: "var(--neutral-150)",
    title: "Response inbox",
    body: "Read, tag and act on answers in bulk. Half-finished responses are kept, with a link the person can use to carry on.",
    chip: "Every plan",
  },
  {
    icon: "chart-line",
    bg: "var(--green-200)",
    title: "Analytics",
    body: "Views, starts, finishes, time taken and the question people stop on. Pro adds where they came from and their devices.",
    chip: "Every plan",
  },
  {
    icon: "building-2",
    bg: "var(--blue-200)",
    title: "Companies and members",
    body: "A workspace for each business or client, with its own forms, members and plan. Members are free and unlimited on Free.",
    chip: "Every plan",
  },
  {
    icon: "bell",
    bg: "var(--mint-200)",
    title: "Notifications and routing",
    body: "An email for each answer, sent to the right person by what they picked, and a receipt for the person who answered.",
    chip: "Every plan",
  },
  {
    icon: "history",
    bg: "var(--yellow-200)",
    title: "Version history and exports",
    body: "Every publish is saved and can be restored. Export to CSV any time; Excel and a copy of every response by email on Pro.",
    chip: "CSV on every plan",
  },
];

export const LANDING_FAQS = [
  {
    q: "Is Formkit free?",
    a: "Yes. Unlimited forms, responses and members, free for as long as you like, with AI for 3 new forms and 10 edits a month. Pro is $6 a seat a month and Business $19, paid for each company on its own.",
  },
  {
    q: "What can the AI do?",
    a: "Build a form from a sentence (or, on Pro, a brief or a document); edit questions, logic and themes when you ask; decide where someone goes next from what they wrote; write a personal reply to every response; and report on what your responses say.",
  },
  {
    q: "What happens when the AI allowance runs out?",
    a: "Each seat adds to one monthly pool the company shares. Past it, AI credits keep things going, from $5 for 100, and they last a year. Nothing stops working without you knowing.",
  },
  {
    q: "Does it do conditional logic?",
    a: "Rules read like sentences: when someone answers this way, skip ahead, or show or hide a question. Pro adds calculations, several endings and AI logic that reads what people wrote.",
  },
  {
    q: "Can I take payments?",
    a: "On Pro, through your own Stripe account: a fixed amount or the total your form works out. The money goes straight to you and Formkit takes no cut.",
  },
  {
    q: "Can my team work on forms together?",
    a: "Each company has members who work on every form, as Admin, Editor or Viewer. Members are free on Free; on paid plans each is a seat. Guests invited to one form are always free.",
  },
  {
    q: "What about people who do not finish?",
    a: "Half-finished answers are kept and marked, left out of your finish rate, and each one has a link you can send back so they can carry on. That is on every plan.",
  },
  {
    q: "How do I cancel?",
    a: "Turn off auto-renew in Settings → Plan. One click, no survey, no call. The plan runs to the end of the period you paid for, and nothing is deleted.",
  },
];

/** Things people want to know before they trust a form builder with their answers. */
export const TRUST_POINTS = [
  { icon: "receipt", title: "Billing by Polar", body: "Polar is the merchant of record: they take the card, add the tax and send the receipt." },
  { icon: "credit-card", title: "Your money, your Stripe", body: "Payments go straight to your own Stripe account. Formkit never holds them and takes no cut." },
  { icon: "check", title: "Cancel in one click", body: "Turn off auto-renew and the plan runs to the end of what you paid for. No survey, no call." },
  { icon: "shield", title: "Spam kept out", body: "An invisible check and limits on floods, on every form, on every plan." },
];
