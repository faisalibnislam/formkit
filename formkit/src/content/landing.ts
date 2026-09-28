/**
 * The landing page's content.
 *
 * One continuous story on Client onboarding / Maya Okafor / Northstar website
 * redesign — 8 of 11 questions, 72.5%, 2 minutes ago — reused across every
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

export const LOGIC_LINES = [
  { k: "When", v: "Have we worked together before?" },
  { k: "Is", v: "Yes — existing client" },
  { k: "Then", v: "Skip to Scope" },
];

export const RESPONDENT_QS = [
  "Who is the main contact?",
  "Which parts of the brand are fixed?",
  "Tell us about your audience",
  "What is the deadline?",
  "Who signs off?",
];

export const SHAPE_LABELS = [
  "Add a condition",
  "The path divides",
  "A question drops out",
  "Fewer questions to answer",
  "The paths merge",
];

export const PATH_ROWS = [
  {
    pct: "73%",
    label: "Existing clients · 8 questions",
    count: "182 of 248",
    filled: 47,
    total: 64,
    fill: "var(--green-400)",
  },
  {
    pct: "27%",
    label: "New clients · 11 questions",
    count: "66 of 248",
    filled: 17,
    total: 64,
    fill: "var(--blue-500)",
  },
];

export const BRAND_CHOICES = [
  {
    id: "northstar",
    name: "Northstar",
    mark: "radial-gradient(circle,var(--neutral-900) 38%,transparent 39%)",
    radius: "50%",
  },
  {
    id: "merrow",
    name: "Merrow",
    mark: "linear-gradient(var(--neutral-900) 0 34%,transparent 0 66%,var(--neutral-900) 0 100%)",
    radius: "0",
  },
  {
    id: "velto",
    name: "Velto",
    mark: "var(--neutral-950)",
    radius: "0",
    clip: "polygon(0 0,100% 0,50% 100%)",
  },
  {
    id: "fieldnote",
    name: "Fieldnote",
    mark: "transparent",
    radius: "4px",
    border: "3px solid var(--neutral-900)",
  },
];

export const LIVE_QUESTIONS = [
  "Which brand are you submitting this brief for?",
  "Anything we should read first?",
  "Thanks, Maya — that's everything.",
];

export const INBOX_ROWS = [
  {
    key: "maya",
    initials: "MO",
    name: "Maya Okafor",
    meta: "Northstar website redesign · 2 minutes ago",
    badge: "New" as const,
  },
  {
    key: "dele",
    initials: "DA",
    name: "Dele Adeyemi",
    meta: "Merrow packaging · 1 hour ago",
    badge: "Read" as const,
  },
  {
    key: "jonas",
    initials: "JS",
    name: "Jonas Sand",
    meta: "Fieldnote app · Yesterday",
    badge: "Partial" as const,
  },
  {
    key: "ana",
    initials: "AV",
    name: "Ana Vieira",
    meta: "Velto rebrand · Yesterday",
    badge: "Read" as const,
  },
];

export const ANSWER_ROWS = [
  { q: "Which brand are you submitting this brief for?", a: "Northstar" },
  { q: "What are we building, in one line?", a: "A new site for Northstar, launching in March" },
  { q: "Where does the budget sit?", a: "£24k – £40k" },
  { q: "Who signs off on the final work?", a: "Maya Okafor" },
];

export const COMPLETION_TICKS = [42, 55, 48, 61, 58, 66, 72, 69, 78, 74, 83, 88];

export const DROP_ROWS = [
  { label: "Q7 · Budget range", pctLabel: "62%", filled: 14, total: 22, fill: "var(--red-400)" },
  { label: "Q4 · File upload", pctLabel: "24%", filled: 5, total: 22, fill: "var(--yellow-400)" },
  { label: "Q9 · Sign-off", pctLabel: "11%", filled: 2, total: 22, fill: "var(--green-400)" },
];

export const RANGES = ["7 days", "30 days", "90 days", "Custom"];

export const STAT_CARDS = [
  { label: "Views", icon: "eye", count: 12483, suffix: "", delta: "+8%", up: true },
  {
    label: "Started",
    icon: "mouse-pointer-click",
    count: 8291,
    suffix: "",
    delta: "+11%",
    up: true,
  },
  {
    label: "Completed",
    icon: "circle-check",
    count: 5821,
    suffix: "",
    delta: "+14%",
    up: true,
    tone: "blue" as const,
  },
  {
    label: "Completion rate",
    icon: "chart-pie",
    count: 70.2,
    dec: 1,
    suffix: "%",
    delta: "+4pts",
    up: true,
    tone: "dark" as const,
  },
  {
    label: "Average time",
    icon: "timer",
    count: 4,
    suffix: "m 12s",
    delta: "−31s",
    up: false,
  },
];

export const WEEK_BARS = [18, 24, 31, 27, 42, 38, 51, 46, 58, 63, 49, 72];

export const FUNNEL = [
  { pct: "100%", label: "Views", count: "12,483", filled: 44, total: 44, fill: "var(--green-400)" },
  { pct: "66%", label: "Started", count: "8,291", filled: 29, total: 44, fill: "var(--yellow-400)" },
  {
    pct: "47%",
    label: "Completed",
    count: "5,821",
    filled: 21,
    total: 44,
    fill: "var(--blue-500)",
  },
];

export const FEATURES = [
  {
    icon: "layout-template",
    bg: "var(--blue-300)",
    title: "Drag-and-drop builder",
    body: "Sixteen question types. Drag a card to move it, copy it or split the form into pages. Everything saves as you type.",
    chip: "16 field types",
  },
  {
    icon: "git-branch",
    bg: "var(--mint-200)",
    title: "Conditional logic",
    body: "Rules in plain words: skip a page, ask a follow-up, or hide what does not apply to this person.",
    chip: "Skip · show · hide",
  },
  {
    icon: "palette",
    bg: "var(--yellow-200)",
    title: "Themes and branding",
    body: "Ten ready-made looks, then your own colours, type and logo. You can show two logos side by side for client work.",
    chip: "10 presets",
  },
  {
    icon: "link",
    bg: "var(--blue-200)",
    title: "Your own link",
    body: "Take formkit.app/your-name, or a name for each company — or, on Pro, your own domain like forms.acme.com.",
    chip: "Handles · custom domains",
  },
  {
    icon: "inbox",
    bg: "var(--neutral-150)",
    title: "Response inbox",
    body: "Read, filter and act on answers in bulk. On Pro, half-finished ones are kept too, and can be picked up again by link.",
    chip: "Bulk actions",
  },
  {
    icon: "chart-line",
    bg: "var(--green-200)",
    title: "Analytics",
    body: "Views, starts, finishes and average time over 7, 30 or 90 days — and on Pro, where people came from and the question they stop on.",
    chip: "7 · 30 · 90 days",
  },
  {
    icon: "bell",
    bg: "var(--red-200)",
    title: "Notifications and routing",
    body: "Get an email for each answer, send it to the right person based on what they picked, and reply with a receipt.",
    chip: "First matching rule wins",
  },
  {
    icon: "users",
    bg: "var(--blue-300)",
    title: "Collaborators",
    body: "Invite two people to any form as Editor, Commenter or Viewer, or your whole team on Business. Comments stay on the question they are about.",
    chip: "Three roles",
  },
  {
    icon: "history",
    bg: "var(--mint-200)",
    title: "Version history",
    body: "Every time you publish, the form is saved. Go back 30 days on Free, a year on Pro, or all the way on Business.",
    chip: "Restore a version",
  },
  {
    icon: "download",
    bg: "var(--yellow-200)",
    title: "Exports",
    body: "CSV matching whatever you have filtered, or just the rows you ticked. Excel, webhooks and Google Sheets on Pro.",
    chip: "CSV · Excel on Pro",
  },
  {
    icon: "shield",
    bg: "var(--neutral-150)",
    title: "Spam protection",
    body: "A check people never see, plus limits on how fast answers can arrive. Uploads go up to 10 MB, or 100 MB on Pro.",
    chip: "Invisible check",
  },
  {
    icon: "sparkles",
    bg: "var(--blue-200)",
    title: "Ask Formkit",
    body: "Turn a sentence into a draft form, reword questions, write rules or sum up answers. Five new forms a month free, 50 on Pro.",
    chip: "5 · 50 · 200 a month",
  },
];

export const LANDING_FAQS = [
  {
    q: "Is Formkit free?",
    a: "Yes — unlimited forms and unlimited responses, free for as long as you like. Pro, at $3 a month, adds your own domain, branding and integrations; Business, at $10 a month, adds your team.",
  },
  {
    q: "Can I use my own branding?",
    a: "Set the colours, type and logo, then send it out from your own link: formkit.app/your-name, or a name for each company you add.",
  },
  {
    q: "Does it do conditional logic?",
    a: "Rules read like sentences: when someone answers this way, skip ahead, or show or hide another question. The first rule that matches wins.",
  },
  {
    q: "Can I export the responses?",
    a: "CSV or Excel, matching whatever you have filtered, or just the rows you ticked.",
  },
  {
    q: "What about people who do not finish?",
    a: "Half-finished answers are kept and marked, left out of your finish rate, and each one has a link you can send back so they can carry on.",
  },
  {
    q: "How big can uploads be?",
    a: "Each file can be up to 10 MB, and a question can say which file types it takes.",
  },
];
