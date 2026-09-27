/**
 * The account the preview harness renders.
 *
 * The numbers match the reference renders in `project/shots/` so a screen can
 * be put side by side with the design it is meant to be.
 */

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

/* Anchored to the top of the hour, not to the moment this module loaded.
   The server and the browser load it at different instants, and a relative
   time computed from each ("2 hours ago" against "3 hours ago") is a
   hydration mismatch that belongs to the harness rather than to the app —
   which never server-renders this data, because a real `useQuery` has nothing
   to give during SSR. */
const now = Math.floor(Date.now() / HOUR) * HOUR;

type Row = Record<string, unknown>;

const FORMS: Row[] = [
  {
    _id: "f1",
    title: "Client Onboarding",
    slug: "client-onboarding",
    description: "Kickoff questionnaire we send every new client before the first call.",
    status: "published",
    brand: "c1",
    url: "formkit.app/studio-nine/client-onboarding",
    questions: 11,
    pages: 3,
    responses: 248,
    completed: 179,
    completionRate: 72,
    liveVersion: 4,
    closesAt: null,
    closesAfter: null,
    deletedAt: null,
    daysLeft: null,
    createdAt: now - 90 * DAY,
    updatedAt: now - 2 * HOUR,
  },
  {
    _id: "f2",
    title: "Website Project Questionnaire",
    slug: "website-project-questionnaire",
    description: "Scope, content and references — everything the proposal needs.",
    status: "published",
    brand: "c1",
    url: "formkit.app/studio-nine/website-project-questionnaire",
    questions: 7,
    pages: 2,
    responses: 86,
    completed: 55,
    completionRate: 64,
    liveVersion: 2,
    closesAt: null,
    closesAfter: null,
    deletedAt: null,
    daysLeft: null,
    createdAt: now - 60 * DAY,
    updatedAt: now - 28 * HOUR,
  },
  {
    _id: "f3",
    title: "Customer Feedback",
    slug: "customer-feedback",
    description: "Five questions, sent two weeks after handover.",
    status: "published",
    brand: "me",
    url: "formkit.app/maya/customer-feedback",
    questions: 5,
    pages: 1,
    responses: 612,
    completed: 496,
    completionRate: 81,
    liveVersion: 6,
    closesAt: null,
    closesAfter: null,
    deletedAt: null,
    daysLeft: null,
    createdAt: now - 150 * DAY,
    updatedAt: now - 3 * DAY,
  },
  {
    _id: "f4",
    title: "Event Registration",
    slug: "event-registration",
    description: "Guest list for the November studio night.",
    status: "draft",
    brand: "c1",
    url: "formkit.app/studio-nine/event-registration",
    questions: 6,
    pages: 2,
    responses: 0,
    completed: 0,
    completionRate: 0,
    liveVersion: null,
    closesAt: now + 21 * DAY,
    closesAfter: null,
    deletedAt: null,
    daysLeft: null,
    createdAt: now - 6 * DAY,
    updatedAt: now - 6 * DAY,
  },
  {
    _id: "f5",
    title: "Contact",
    slug: "contact",
    description: "The one on the studio site.",
    status: "published",
    brand: "c1",
    url: "formkit.app/studio-nine/contact",
    questions: 4,
    pages: 1,
    responses: 171,
    completed: 140,
    completionRate: 82,
    liveVersion: 3,
    closesAt: null,
    closesAfter: null,
    deletedAt: null,
    daysLeft: null,
    createdAt: now - 200 * DAY,
    updatedAt: now - 9 * DAY,
  },
  {
    _id: "f6",
    title: "Workshop Application",
    slug: "workshop-application",
    description: "Closed after the spring cohort filled up.",
    status: "closed",
    brand: "me",
    url: "formkit.app/maya/workshop-application",
    questions: 9,
    pages: 2,
    responses: 0,
    completed: 0,
    completionRate: 0,
    liveVersion: 1,
    closesAt: null,
    closesAfter: null,
    deletedAt: null,
    daysLeft: null,
    createdAt: now - 240 * DAY,
    updatedAt: now - 30 * DAY,
  },
];

const PEOPLE: [string, string, string, number, boolean, string][] = [
  ["John Smith", "john@email.com", "f1", 2 * HOUR, false, "new"],
  ["Priya Shah", "priya@fable.studio", "f1", 5 * HOUR, false, "new"],
  ["Tom Okafor", "tom@grainhouse.com", "f1", 27 * HOUR, false, "new"],
  ["Lena Fischer", "lena@merrow.co", "f2", 2 * DAY, false, "read"],
  ["Dan Whitfield", "dan@northstar.io", "f3", 3 * DAY, true, "read"],
  ["Aoife Byrne", "aoife@velto.design", "f3", 4 * DAY, false, "read"],
  ["Marcus Hall", "marcus@fieldnote.app", "f2", 5 * DAY, false, "read"],
  ["Sara Nilsson", "sara@merrow.co", "f5", 6 * DAY, true, "read"],
  ["Ines Duarte", "ines@grainhouse.com", "f3", 8 * DAY, false, "read"],
  ["Ben Carter", "ben@northstar.io", "f5", 11 * DAY, false, "read"],
];

const FORM_TITLES: Record<string, string> = {
  f1: "Client Onboarding",
  f2: "Website Project Questionnaire",
  f3: "Customer Feedback",
  f5: "Contact",
};
const COMPANY_OF = ["Smith & Co", "Fable Studio", "Grainhouse", "Merrow", "Northstar", "Velto", "Fieldnote", "Merrow", "Grainhouse", "Northstar"];

const RESPONSES: Row[] = [
  ...PEOPLE.map(([name, email, formId, ago, partial, status], i) => ({
    _id: `r${i + 1}`,
    formId,
    formTitle: FORM_TITLES[formId] ?? "A form",
    submittedAt: now - ago,
    partial,
    preview: false,
    answeredCount: partial ? 3 : 5,
    totalCount: 5,
    answers: [
      { blockId: "b1", question: "What should we call you?", value: name, fileName: null },
      { blockId: "b2", question: "Where should we send the proposal?", value: email, fileName: null },
      { blockId: "b4", question: "What are we making?", value: "A new marketing site and a small booking flow.", fileName: null },
      ...(partial
        ? []
        : [
            { blockId: "b5", question: "Budget range", value: "£20k–£35k", fileName: null },
            { blockId: "b6", question: "When does it need to be live?", value: "Early March", fileName: null },
          ]),
    ],
    files: [],
    respondentName: name,
    respondentEmail: email,
    respondentPhone: i % 2 === 0 ? `+44 7700 900${String(100 + i * 7).slice(-3)}` : null,
    respondentCompany: COMPANY_OF[i] ?? null,
    device: i % 3 === 0 ? "Mobile · Safari" : "Desktop · Chrome",
    source: ["Direct link", "Instagram", "Email", "Embedded on studionine.co"][i % 4],
    durationMs: 120000 + i * 17000,
    status,
    note: null,
    tags: i === 0 ? ["Hot lead", "Retainer"] : i === 3 ? ["Follow up"] : [],
    versionNumber: 3,
    resumeToken: partial ? `tok${i}` : null,
  })),
  {
    _id: "r99",
    formId: "f1",
    formTitle: "Client Onboarding",
    submittedAt: now - 30 * 60 * 1000,
    partial: false,
    preview: true,
    answeredCount: 2,
    totalCount: 5,
    answers: [{ blockId: "b1", question: "What should we call you?", value: "Test", fileName: null }],
    files: [],
    respondentName: "Test",
    respondentEmail: null,
    respondentPhone: null,
    respondentCompany: null,
    device: "Desktop · Chrome",
    source: "Preview",
    durationMs: 9000,
    status: "new",
    note: null,
    tags: [],
    versionNumber: null,
    resumeToken: null,
  },
];

const CONTACTS = PEOPLE.map(([name, email, formId, ago, partial, status], i) => ({
  key: email,
  name,
  email,
  phone: i % 2 === 0 ? `+44 7700 900${String(100 + i * 7).slice(-3)}` : null,
  company: COMPANY_OF[i] ?? null,
  source: FORM_TITLES[formId] ?? "A form",
  created: now - ago - 20 * DAY,
  last: now - ago,
  responses: i === 0 ? 3 : 1,
  partialOnly: partial,
  unread: status === "new",
  tags: i === 0 ? ["Hot lead", "Retainer"] : i === 3 ? ["Follow up"] : [],
  forms: i === 0 ? [FORM_TITLES[formId]!, "Contact"] : [FORM_TITLES[formId]!],
}));

const COMPANIES = [
  {
    _id: "c1",
    name: "Studio Nine",
    handle: "studio-nine",
    logoUrl: null,
    brandColor: "#2e78bb",
    useBranding: true,
  },
];

/** Preview switches read from the page's own URL: ?fk_gate=2fa|deactivated, ?fk_sky=morning. */
function flag(name: string) {
  if (typeof window === "undefined") return null;
  return new URLSearchParams(window.location.search).get(name);
}

export const VIEWER = {
  _id: "u1",
  name: "Maya Ortiz",
  email: "maya@studionine.co",
  image: null,
  handle: "maya",
  timezone: "Europe/London",
  role: "Independent designer",
  get skyPref() {
    return flag("fk_sky") ?? "sync";
  },
  get twoFactorNeeded() {
    return flag("fk_gate") === "2fa";
  },
  onboarded: true,
  get deactivated() {
    return flag("fk_gate") === "deactivated" || flag("fk_gate") === "suspended";
  },
  get suspended() {
    return flag("fk_gate") === "suspended";
  },
  restoreUntil: Date.now() + 23 * 24 * 60 * 60 * 1000,
  inAppPrefs: { responses: true, sharedResponses: false, comments: true, sharing: true, forms: true, security: true },
  emailPrefs: {
    newResponse: true,
    comments: true,
    daily: false,
    weekly: true,
    to: "maya@studionine.co",
    subject: "New response to {{form_name}}",
    body: "{{name}} ({{email}}) just submitted {{form_name}}.",
  },
  emailCopy: { on: true, to: "inbox@studionine.co" },
  staffRole: "owner",
  ai: { allowed: true, used: 3, limit: 25, live: true },
  companies: COMPANIES,
};

const BUCKETS = [18, 24, 31, 27, 42, 38, 51, 46, 58, 63, 49, 72, 40, 35, 44, 52, 61, 39, 47, 55, 33, 41, 50, 58, 29, 37, 45, 53, 60, 68].map(
  (count, i) => ({
    at: now - (29 - i) * DAY,
    label: new Date(now - (29 - i) * DAY).toLocaleDateString("en-US", { day: "numeric", month: "short" }),
    count,
  }),
);

const TEMPLATES = [
  ["contact-form", "Contact Form", "Business", "Name, email, subject and message. The one every site needs.", 5, 1, "mail", "var(--blue-300)"],
  ["client-onboarding", "Client Onboarding", "Agency", "Everything you need before a kickoff call, across three pages.", 11, 4, "briefcase", "var(--blue-300)"],
  ["website-questionnaire", "Website Questionnaire", "Agency", "Scope, pages, references and budget for a site build.", 14, 4, "layout-template", "var(--blue-200)"],
  ["branding-questionnaire", "Branding Questionnaire", "Agency", "Positioning, audience and taste, without the jargon.", 12, 4, "palette", "var(--mint-200)"],
  ["customer-feedback", "Customer Feedback", "Business", "A rating, an NPS scale and room to say what went wrong.", 6, 1, "message-square", "var(--mint-200)"],
  ["job-application", "Job Application", "HR", "Eligibility, role, availability, portfolio and resume upload.", 16, 4, "user-round", "var(--neutral-150)"],
  ["event-registration", "Event Registration", "Events", "Days, sessions, guest count and dietary requirements.", 9, 3, "calendar", "var(--yellow-200)"],
  ["rsvp", "RSVP", "Personal", "Coming or not, headcount, and a line for a message.", 5, 1, "party-popper", "var(--yellow-200)"],
  ["lead-qualification", "Lead Generation", "Marketing", "Qualifies in seven questions people will actually finish.", 7, 1, "magnet", "var(--blue-200)"],
  ["product-research", "Product Survey", "Marketing", "Usage, fit, satisfaction and what is missing.", 10, 3, "chart-pie", "var(--mint-200)"],
  ["project-discovery", "Project Discovery", "Agency", "A longer intake for complex or multi-phase work.", 13, 4, "compass", "var(--blue-300)"],
  ["support-request", "Support Request", "Business", "Triage by topic and urgency, with a screenshot upload.", 7, 1, "life-buoy", "var(--neutral-150)"],
  ["order-form", "Order Form", "Business", "Product, quantity, specification, artwork and delivery.", 11, 3, "shopping-bag", "var(--yellow-200)"],
].map(([slug, name, topic, blurb, questions, pages, icon, accent]) => ({
  slug,
  name,
  topic,
  blurb,
  audience: null,
  questions,
  pages,
  icon,
  accent,
  mine: false,
  _id: null,
  keeps: null,
  createdAt: null,
}));
TEMPLATES.push({
  slug: "studio-intake-x1",
  name: "Studio intake",
  topic: "Agency",
  blurb: "Saved from Client Onboarding.",
  audience: null,
  questions: 9,
  pages: 3,
  icon: "bookmark",
  accent: "var(--blue-100)",
  mine: true,
  _id: "t-mine" as never,
  keeps: ["Questions & pages", "Theme", "Welcome & thanks"] as never,
  createdAt: now - 3 * DAY as never,
});


const BLOCKS = [
  { _id: "b1", kind: "field", type: "short-text", order: 0, title: "What should we call you?", help: "", required: true, options: [] },
  { _id: "b2", kind: "field", type: "email", order: 1, title: "Where should we send the proposal?", help: "", required: true, options: [] },
  { _id: "b3", kind: "pagebreak", order: 2, pageName: "The project" },
  { _id: "b4", kind: "field", type: "long-text", order: 3, title: "What are we making?", help: "A sentence or two is plenty.", required: true, options: [] },
  { _id: "b5", kind: "field", type: "single-select", order: 4, title: "Budget range", help: "", required: false, options: ["Under £10k", "£10k–£20k", "£20k–£35k", "More than £35k"] },
  { _id: "b6", kind: "field", type: "date", order: 5, title: "When does it need to be live?", help: "", required: false, options: [] },
];

const FORM_DETAIL = {
  ...FORMS[0],
  welcome: { title: "Let's start your project", message: "A few questions — it should take about two minutes.", button: "Start" },
  thanks: { title: "Thank you", message: "Your answers are in. We will be in touch." },
  theme: null,
  logos: [],
  identity: { kind: "company", name: "Studio Nine", logoUrl: null, handle: "studio-nine" },
  notify: null,
  security: { multiple: true, editAfter: false, password: false, passwordSet: false, spam: true, rateLimit: true, requireEmail: false },
  closing: { closeAfter: 400, timezone: "Pacific/Auckland" },
  blocks: BLOCKS,
  rules: [],
};

const PERMS = [
  "users.view",
  "users.suspend",
  "users.delete",
  "ai.access",
  "moderation",
  "support",
  "announcements",
  "flags",
  "team",
];

const STAFF_USERS = PEOPLE.slice(0, 6).map(([name, email], i) => ({
  _id: `u${i + 2}`,
  name,
  email,
  handle: null,
  joinedAt: now - (i + 3) * 30 * DAY,
  staffRole: null,
  deactivatedAt: i === 5 ? now - 4 * DAY : null,
  forms: 6 - i,
  responses: 300 - i * 40,
  ai: { allowed: i < 2, limit: 25, used: i < 2 ? 3 : 0 },
}));

/** The form as the runner receives it — for the preview and the public link. */
const RUNNER = {
  state: "open",
  formId: "f1",
  title: "Client Onboarding",
  brand: { name: "Studio Nine", logoUrl: null, color: null },
  logos: [],
  welcome: FORM_DETAIL.welcome,
  thanks: FORM_DETAIL.thanks,
  theme: null,
  closedMessage: "This form is closed. Thank you to everyone who answered.",
  uploadCapMb: 10,
  rules: { spam: true, requireEmail: false, editAfter: true, multiple: true },
  blocks: BLOCKS.map((b) => ({
    _id: b._id,
    kind: b.kind,
    type: b.type ?? null,
    title: b.title ?? null,
    help: b.help || null,
    placeholder: null,
    required: !!b.required,
    options: b.options?.length ? b.options : null,
    accept: null,
    scaleMin: null,
    scaleMax: null,
    pageName: b.pageName ?? null,
  })),
  logic: [],
  status: "published",
  url: "formkit.app/studio-nine/client-onboarding",
};

/** Every query the application reads, by its Convex function name. */
export const QUERIES: Record<string, unknown> = {
  "admin:supportView": {
    who: "Jonas Sand",
    email: "jonas@fieldnote.app",
    forms: [
      { _id: "sv1", title: "Fieldnote beta feedback", status: "published", responses: 64, updatedAt: Date.now() - 3 * 3600_000 },
      { _id: "sv2", title: "App store survey", status: "draft", responses: 0, updatedAt: Date.now() - 4 * 86400_000 },
      { _id: "sv3", title: "Launch waitlist", status: "closed", responses: 312, updatedAt: Date.now() - 21 * 86400_000 },
    ],
  },
  "users:viewer": VIEWER,
  "companies:list": COMPANIES.map((c) => ({ ...c, formCount: 4, logoId: null, ownerId: "u1" })),
  "forms:list": {
    counts: { all: 6, draft: 1, published: 4, closed: 1, archived: 0, deleted: 2, shared: 1 },
    forms: FORMS.map((f) => ({ ...f, sharedAs: null })),
  },
  "forms:get": FORM_DETAIL,
  "responses:list": {
    stats: { total: 1117, today: 2, todayChange: 1, week: 8, weekChange: 14, unread: 3, partial: 2, completed: 1115, previews: 1 },
    forms: Object.entries(FORM_TITLES).map(([_id, title]) => ({ _id, title })),
    responses: RESPONSES,
  },
  "responses:get": RESPONSES[0],
  "responses:contacts": CONTACTS,
  "responses:tagsInUse": ["Hot lead", "Follow up", "Retainer", "Not a fit"],
  "responses:forExport": { filename: "client-onboarding-responses", title: "Client Onboarding", rows: [["a"]], columns: ["A"] },
  "responses:contactsForExport": { filename: "contacts", rows: [["a"]], columns: ["A"] },
  "responses:count": 248,
  "responses:unreadCount": 3,
  "comments:mentionable": [
    { _id: "u2", name: "Ravi Menon", email: "ravi@studionine.co", color: "#4b9d6e" },
    { _id: "u4", name: "Ben Carter", email: "ben@northstar.co", color: "#c4614f" },
  ],
  "inbox:list": {
    unread: 4,
    announcements: [
      { _id: "a1", title: "Conversational forms are out of beta", body: "One question at a time, for everyone. Existing forms are untouched until you switch them over.", at: now - 3 * DAY, read: false },
    ],
    items: [
      { _id: "i1", kind: "invited", title: "Ben Carter added you to Northstar Partner Intake", body: "As an Editor. You can edit its questions and read its responses.", href: "/app/forms/f9", action: "Open the form", icon: "user-plus", at: now - 20 * 60 * 1000, read: false, actor: { name: "Ben Carter", image: null, color: "#c4614f" } },
      { _id: "i2", kind: "mention", title: "Ravi Menon mentioned you on “Budget range” in Client Onboarding", body: "@Maya Ortiz should we add a “not sure yet” option here?", href: "/app/forms/f1?open=comments", action: "Open the comment", icon: "at-sign", at: now - 2 * HOUR, read: false, actor: { name: "Ravi Menon", image: null, color: "#4b9d6e" } },
      { _id: "i3", kind: "response", title: "3 new responses to Client Onboarding", body: "The latest from John Smith.", href: "/app/forms/f1?tab=responses", action: "View responses", icon: "inbox", at: now - 2 * HOUR - 5 * 60 * 1000, read: false, actor: null },
      { _id: "i4", kind: "closed", title: "Customer Feedback closed itself", body: "It reached its limit of 400 responses.", href: "/app/forms/f3", action: "Open the form", icon: "lock", at: now - 27 * HOUR, read: true, actor: null },
      { _id: "i5", kind: "joined", title: "Ravi Menon joined Website Project Questionnaire", body: "As an Editor, from your invitation.", href: "/app/forms/f2?open=share", action: "See who has access", icon: "user-check", at: now - 3 * DAY, read: true, actor: { name: "Ravi Menon", image: null, color: "#4b9d6e" } },
      { _id: "i6", kind: "security", title: "New sign-in: Safari on iPhone", body: "If this was not you, change your password and sign out everywhere.", href: "/app/settings", action: "Review security", icon: "shield", at: now - 4 * DAY, read: true, actor: null },
    ],
  },
  "security:status": {
    twoFactor: { on: true, enabledAt: now - 40 * DAY, recoveryLeft: 7 },
    signInAlerts: true,
    emailChange: null,
    sessions: [
      { _id: "s1", device: "Chrome on Mac", firstSeen: now - 9 * DAY, lastSeen: now, current: true },
      { _id: "s2", device: "Safari on iPhone", firstSeen: now - 30 * DAY, lastSeen: now - 2 * HOUR, current: false },
    ],
  },
  "collaborators:people": {
    people: [
      { key: "u2", name: "Ravi Menon", email: "ravi@studionine.co", color: "#4b9d6e", role: "editor", forms: [
        { collaboratorId: "c1", formId: "f1", title: "Client Onboarding", role: "editor", status: "active" },
        { collaboratorId: "c2", formId: "f2", title: "Website Project Questionnaire", role: "editor", status: "active" },
      ] },
      { key: "u4", name: "Ben Carter", email: "ben@northstar.co", color: "#c4614f", role: "mixed", forms: [
        { collaboratorId: "c3", formId: "f1", title: "Client Onboarding", role: "commenter", status: "active" },
        { collaboratorId: "c4", formId: "f3", title: "Customer Feedback", role: "viewer", status: "active" },
      ] },
    ],
    pending: [
      { _id: "c5", email: "freelance@grainhouse.com", role: "viewer", formId: "f1", formTitle: "Client Onboarding", invitedAt: now - 2 * DAY },
    ],
  },
  "exports:recent": [
    { _id: "x1", formId: "f1", formTitle: "Client Onboarding", what: "responses", format: "xlsx", filename: "client-onboarding-responses.xlsx", rows: 248, from: null, to: null, ids: null, emailedTo: null, at: now - 3 * HOUR },
    { _id: "x2", formId: null, formTitle: "All forms", what: "contacts", format: "csv", filename: "contacts.csv", rows: 64, from: null, to: null, ids: null, emailedTo: "maya@studionine.co", at: now - 2 * DAY },
  ],
  "templates:list": TEMPLATES,
  "templates:get": {
    slug: "client-onboarding",
    name: "Client Onboarding",
    topic: "Agency",
    blurb: "Everything you need before a kickoff call, across three pages.",
    welcome: { title: "Let's start your project", message: "Eleven questions, about four minutes." },
    blocks: BLOCKS.map((b) => ({ kind: b.kind, type: b.type ?? null, title: b.title ?? b.pageName ?? "", help: null, required: !!b.required, options: b.options ?? null })),
  },
  "notifications:recent": {
    items: RESPONSES.slice(0, 8).map((r) => ({
      _id: r._id,
      formId: r.formId,
      form: FORMS.find((f) => f._id === r.formId)?.title ?? "A form",
      who: r.respondentName,
      partial: r.partial,
      unread: r.status === "new",
      at: r.submittedAt,
    })),
    unread: 3,
  },
  "notifications:log": [
    { _id: "e1", subject: "New response to Client Onboarding", kind: "notification", to: "maya@studionine.co", form: "Client Onboarding", state: "sent", detail: null, at: now - 2 * HOUR },
    { _id: "e2", subject: "We have your answers — Client Onboarding", kind: "confirmation", to: "john@email.com", form: "Client Onboarding", state: "sent", detail: null, at: now - 2 * HOUR },
    { _id: "e3", subject: "Your week on Formkit: 38 responses", kind: "weekly report", to: "maya@studionine.co", form: null, state: "sent", detail: null, at: now - 3 * DAY },
  ],
  "collaborators:sharedWithMe": [
    { _id: "sw1", formId: "f9", title: "Northstar Partner Intake", owner: "Ben Carter", role: "editor", status: "active" },
  ],
  "analytics:overview": {
    from: now - 30 * DAY,
    to: now,
    days: 30,
    views: 12483,
    starts: 8291,
    responses: 8291,
    completed: 5821,
    partial: 2470,
    completionRate: 70.2,
    medianSeconds: 252,
    change: { views: 8, starts: 11, completed: 14.2, completionRate: 4, medianSeconds: -31 },
    daily: Array.from({ length: 30 }, (_, i) => ({
      at: now - (29 - i) * DAY,
      views: 300 + ((i * 37) % 140),
      starts: 200 + ((i * 29) % 90),
      responses: 140 + ((i * 53) % 120) + i * 3,
      completed: 100 + ((i * 41) % 80),
    })),
    dropOff: BLOCKS.filter((b) => b.kind === "field").map((b, i) => ({
      title: b.title,
      left: [160, 410, 1490, 330, 910][i] ?? 0,
      share: [2, 5, 18, 4, 11][i] ?? 0,
    })),
    devices: [
      { name: "Desktop", count: 742 },
      { name: "Mobile", count: 311 },
    ],
    sources: [
      { name: "Direct link", views: 5420, responses: 4100, completed: 3848, completion: 71 },
      { name: "Email", views: 3860, responses: 2600, completed: 2470, completion: 64 },
      { name: "Instagram", views: 2610, responses: 1500, completed: 1357, completion: 52 },
      { name: "Embedded on studionine.co", views: 1320, responses: 1100, completed: 1016, completion: 77 },
    ],
    lifetime: { views: 40210, starts: 30102, responses: 11020 },
    formCount: 6,
    forms: FORMS.map((f) => ({
      _id: f._id,
      title: f.title,
      status: f.status,
      responses: f.responses,
      completed: f.completed,
      views: (f.responses as number) * 3,
      completionRate: f.completionRate,
      inRange: Math.round((f.responses as number) / 4),
    })),
  },
  "collaborators:list": {
    myRole: "owner",
    owner: { _id: "u1", name: "Maya Ortiz", email: "maya@studionine.co", image: null, color: "#2e78bb", you: true, online: true, seen: "Here now" },
    people: [
      { _id: "m2", userId: "u2", name: "Ravi Menon", email: "ravi@studionine.co", image: null, color: "#4b9d6e", role: "editor", status: "active", invitedAt: now - 9 * DAY, note: null, you: false, online: true, seen: "Editing a question now" },
      { _id: "m4", userId: "u4", name: "Ben Carter", email: "ben@northstar.co", image: null, color: "#c4614f", role: "commenter", status: "active", invitedAt: now - 5 * DAY, note: null, you: false, online: false, seen: "Last here 2 hours ago" },
      { _id: "m3", userId: null, name: null, email: "freelance@grainhouse.com", image: null, color: "#6b8f9c", role: "viewer", status: "pending", invitedAt: now - 2 * DAY, note: null, you: false, online: false, seen: "Has not opened it yet" },
    ],
  },
  "collaborators:activity": [
    { _id: "a1", who: "Ravi Menon", image: null, color: "#4b9d6e", what: "left a comment", icon: "message-square", at: now - 40 * 60 * 1000 },
    { _id: "a2", who: "You", image: null, color: "#2e78bb", what: "published version 3", icon: "rocket", at: now - 5 * 60 * 60 * 1000 },
    { _id: "a3", who: "You", image: null, color: "#2e78bb", what: "invited freelance@grainhouse.com as Viewer", icon: "user-plus", at: now - 2 * DAY },
  ],
  "publicForm:preview": RUNNER,
  "publicForm:bySlug": RUNNER,
  "comments:counts": { b2: 1 },
  "comments:list": {
    canComment: true,
    threads: [
      {
        _id: "c1", blockId: "b2", author: "Ravi Menon", image: null, color: "#4b9d6e",
        body: "@Maya Ortiz should this say where the proposal comes from? People will look for our name in their inbox.",
        createdAt: now - 40 * 60 * 1000, mine: false, canDelete: true, resolved: false, mentions: ["Maya Ortiz"],
        replies: [{ _id: "c2", blockId: "b2", author: "You", image: null, color: "#2e78bb", body: "Good call @Ravi Menon — adding a line of help text.", createdAt: now - 20 * 60 * 1000, mine: true, canDelete: true, mentions: ["Ravi Menon"] }],
      },
      { _id: "c3", blockId: null, author: "Ben Carter", image: null, color: "#c4614f", body: "Looks ready from my side.", createdAt: now - DAY, mine: false, canDelete: true, resolved: true, mentions: [], replies: [] },
    ],
  },
  "presence:here": [
    { userId: "u2", name: "Ravi Menon", image: null, color: "#4b9d6e", blockId: "b4" },
  ],
  "handles:mine": { handle: "maya", available: null },
  "blocks:list": BLOCKS,
  "logic:list": [
    {
      _id: "r1",
      formId: "f1",
      name: "Website projects only",
      enabled: true,
      join: "and",
      conditions: [{ blockId: "b4", operator: "contains", value: "website" }],
      action: "show",
      targetId: "b5",
      order: 0,
    },
    {
      _id: "r2",
      formId: "f1",
      name: "Budget before a date",
      enabled: false,
      join: "or",
      conditions: [
        { blockId: "b5", operator: "is-empty" },
        { blockId: "b2", operator: "contains", value: "studio" },
      ],
      action: "require",
      targetId: "b6",
      order: 1,
    },
  ],
  "ai:usage": { used: 3, limit: 25, allowed: true },
  "admin:who": {
    signedIn: true,
    staff: {
      _id: "u1",
      name: "Maya Ortiz",
      email: "maya@studionine.co",
      role: "owner",
      permissions: PERMS,
    },
  },
  "admin:overview": {
    users: 10020,
    newUsers: 184,
    deactivated: 37,
    staff: 6,
    forms: 41288,
    live: 18442,
    responses: 1284119,
    responsesWeek: 22841,
    aiAllowed: 214,
    aiUsed: 1902,
    aiPaused: false,
    aiDefault: 5,
    openReports: 3,
    openTickets: 7,
  },
  "admin:users": STAFF_USERS,
  "admin:reports": [],
  "admin:tickets": [],
  "admin:team": {
    perms: PERMS.map((key) => ({ key, label: key, detail: "" })),
    roles: [
      { role: "owner", permissions: PERMS },
      { role: "admin", permissions: PERMS.filter((p) => p !== "team") },
      { role: "support", permissions: ["users.view", "support"] },
    ],
    members: [
      { _id: "u1", name: "Maya Ortiz", email: "maya@studionine.co", role: "owner", custom: false, permissions: PERMS },
      { _id: "u9", name: "Ravi Menon", email: "ravi@formkit.app", role: "support", custom: false, permissions: ["users.view", "support"] },
    ],
  },
  "admin:flags": [],
  "admin:audit": [],
  "admin:announcements": [],
  "admin:mail": [],
};

/** Read by name, with the shape a still-loading query would have otherwise. */
/** What Ask Formkit answers in the preview, chosen by what was asked. */
export function aiReply({ text, formId, draft }: { text: string; formId?: string; draft?: unknown }) {
  const t = text.toLowerCase();
  const items = [
    { kind: "field", type: "name", title: "What is your name?", required: true },
    { kind: "field", type: "email", title: "Where should we send the proposal?", required: true },
    { kind: "field", type: "company", title: "Which company is this for?", required: false },
    { kind: "pagebreak", pageName: "The project" },
    { kind: "field", type: "single-choice", title: "What do you need most?", required: true, options: ["A new website", "A brand refresh", "Both", "Not sure yet"] },
    { kind: "field", type: "dropdown", title: "Roughly what budget do you have in mind?", required: false, options: ["Under £5k", "£5k–£15k", "£15k–£40k", "Over £40k"] },
    { kind: "field", type: "long-text", title: "Tell us about the project in a few lines.", help: "What it is, who it is for, and when it needs to be live.", required: true },
    { kind: "field", type: "file", title: "Anything we should read first?", required: false },
  ];
  const d = {
    title: "Client intake",
    description: "For new clients of a small design studio, before the first call.",
    welcome: { title: "Tell us about your project", message: "It takes about three minutes." },
    thanks: { title: "Thank you", message: "We will be in touch within two working days." },
    items,
    rules: [{ name: "Only for a new website", when: 4, operator: "is", value: "A new website", action: "show", target: 5 }],
    theme: "sky",
  };
  if (/^(hi|hello|hey)\b/.test(t) || t.endsWith("?")) {
    return { kind: "chat", text: "Hello. Describe the form you need in a sentence and I will write it, or pick one of yours and ask for a change." };
  }
  if (/summar|responses/.test(t)) {
    return {
      kind: "insight",
      formId: formId ?? "f1",
      title: "Client Onboarding",
      text: "Most people finish in under four minutes, but a quarter stop at the budget question. Offering a “Not sure yet” answer there would likely help.",
      items: [
        { k: "Responses", v: "248", n: "12 not read yet" },
        { k: "Finished", v: "73%", n: "67 stopped part of the way" },
        { k: "Median time to finish", v: "3m 41s", n: "short enough to hold attention" },
        { k: "Where people stop", v: "41", n: "at “Where does the budget sit?”" },
      ],
    };
  }
  if (/warmer|tone|rewrite|shorter/.test(t) && formId && !draft) {
    return {
      kind: "diff",
      formId,
      title: "Client Onboarding",
      mode: "warmer",
      items: [
        { blockId: "b1", before: "Full name", after: "What should we call you?" },
        { blockId: "b2", before: "Company website URL", after: "Where can we see what you do now?" },
        { blockId: "b3", before: "Project deadline", after: "When would you love this to be live?" },
      ],
    };
  }
  if (/logic|rule/.test(t) && formId && !draft) {
    return {
      kind: "rules",
      formId,
      title: "Client Onboarding",
      items: [
        { name: "Only for existing clients", when: "Have we worked together before?", operator: "is", value: "Yes", action: "hide", target: "How did you hear about us?" },
        { name: "Budget for new sites", when: "What do you need most?", operator: "is", value: "A new website", action: "require", target: "Roughly what budget do you have in mind?" },
      ],
    };
  }
  if (/theme|dark|colour/.test(t) && formId && !draft) {
    return { kind: "theme", formId, title: "Client Onboarding", name: "Midnight", swatches: ["#21282E", "#2b333a", "#ffffff", "#a3c8e7"], brand: false };
  }
  if (/add|also ask/.test(t) && formId && !draft) {
    return {
      kind: "added",
      formId,
      title: "Client Onboarding",
      items: [{ type: "dropdown", title: "How did you hear about us?", options: ["A friend or colleague", "Search", "Social", "An event"] }],
    };
  }
  return { kind: "draft", draft: d, revised: Boolean(draft), note: draft ? "Made it shorter." : undefined, used: 4, limit: 25 };
}

export function fixtureFor(name: string) {
  if (name in QUERIES) return QUERIES[name];
  return null;
}
