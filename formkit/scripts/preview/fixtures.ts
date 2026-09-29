/**
 * The account the preview harness renders.
 *
 * The numbers match the reference renders in `project/shots/` so a screen can
 * be put side by side with the design it is meant to be.
 */

import { planSummary } from "../../convex/model/plans";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

/* Anchored to the top of the hour, not to the moment this module loaded.
   The server and the browser load it at different instants, and a relative
   time computed from each ("2 hours ago" against "3 hours ago") is a
   hydration mismatch that belongs to the harness rather than to the app -
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
    description: "Scope, content and references - everything the proposal needs.",
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
    ending: i === 1 ? "e1" : null,
    quiz:
      partial || formId !== "f1"
        ? null
        : {
            score: [4, 3, 1][i] ?? 2,
            max: 5,
            percent: [80, 60, 20][i] ?? 40,
            passed: i === 1 ? null : [true, true, false][i] ?? false,
            pending: i === 1 ? 1 : 0,
            timedOut: i === 2,
            late: false,
            marks: [
              { blockId: "b5", got: 1, max: 1, manual: false },
              { blockId: "b6", got: i === 2 ? 0 : 1, max: 1, manual: false },
              { blockId: "b4", got: i === 1 ? 0 : [3, 0, 0][i] ?? 0, max: 3, manual: i === 1 },
            ],
          },
    aiReply:
      partial || formId !== "f1"
        ? null
        : {
            status: "ready",
            subject: `Your project with Studio Nine, ${name.split(" ")[0]}`,
            text: `Hi ${name.split(" ")[0]},\n\nThanks for telling us about the new marketing site and booking flow. Sites that let people book in two or three taps usually turn far more visits into enquiries, so you're right to put that first.\n\nWe'd start with a short discovery session, then design the booking flow alongside the pages so they feel like one thing. With your budget and an early-March launch, that's comfortably doable.\n\nIf it helps, book a free 20-minute call and we'll sketch a plan together.`,
            reason: null,
            at: now - ago + 40_000,
            emailedAt: now - ago + 45_000,
            emailState: "sent",
            rating: i === 0 ? "up" : null,
            needsHuman: i === 2,
            edited: false,
          },
    insight:
      partial || formId !== "f1"
        ? null
        : {
            sentiment: i === 2 ? "negative" : "positive",
            intent: "wants a new marketing site",
            topics: ["website", "booking flow"],
            score: [86, 74, 41][i] ?? 60,
            urgency: i === 2 ? "high" : "medium",
            summary: "A new marketing site with online booking, £20k–£35k, live by early March.",
          },
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
  /** ?fk_theme=dark|system shows the app in dark mode. */
  get appTheme() {
    return flag("fk_theme") ?? "light";
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
  /** ?fk_plan=free|pro|business, and ?fk_plan_state=cancelled|past_due. */
  get plan() {
    const id = (flag("fk_plan") ?? "pro") as "free" | "pro" | "business";
    const state = flag("fk_plan_state");
    return planSummary({
      plan: id,
      planInterval: "year",
      planStatus: state === "past_due" ? "past_due" : "active",
      planEndsAt: state ? now + 12 * DAY : undefined,
      planCancelAtPeriodEnd: state === "cancelled",
      polarCustomerId: id === "free" ? undefined : "cus_preview",
    } as unknown as Parameters<typeof planSummary>[0]);
  },
  ai: { allowed: true, used: 3, limit: 50, live: true },
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
  welcome: { title: "Let's start your project", message: "A few questions - it should take about two minutes.", button: "Start" },
  thanks: { title: "Thank you", message: "Your answers are in. We will be in touch." },
  theme: null,
  logos: [],
  identity: { kind: "company", name: "Studio Nine", logoUrl: null, handle: "studio-nine" },
  notify: null,
  security: { multiple: true, editAfter: false, password: false, passwordSet: false, spam: true, rateLimit: true, requireEmail: false },
  closing: { closeAfter: 400, timezone: "Pacific/Auckland" },
  blocks: BLOCKS,
  rules: [],
  calc: [],
  quiz: { enabled: true, timeLimit: 20, passMark: 60, shuffleOptions: true, oneAttempt: true, results: "later", showAnswers: true, emailResults: true },
  aiReply: {
    enabled: true,
    prompt: "You're replying for our digital agency.\n- Thank them by first name.\n- Look closely at the challenges they describe and respond positively and helpfully.\n- Share one or two useful insights that relate to their situation.\n- Explain briefly how we could help and invite them to book a free 20-minute call.",
    delivery: "both",
    style: "branded",
    senderName: "Maya at Studio Nine",
    signature: "Maya Ortiz\nFounder, Studio Nine\nstudionine.co",
  },
  endings: [
    { id: "e1", name: "Big project", title: "Let’s talk this week", message: "Projects like yours get a call from a partner within two days." },
    { id: "e2", name: "Not a fit yet", title: "Thanks for asking", message: "We’re not the right studio for this one - here are a few we trust." },
  ],
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
  "billing",
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
  plan: { id: i === 0 ? "pro" : "free", comp: null, billed: i === 0 ? "pro" : null, status: i === 0 ? "active" : null, interval: "year", endsAt: null },
}));

/** The form as the runner receives it - for the preview and the public link. */
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
  "flags:mine": { "ai.live": true, "ai.brief": true, "forms.partials": true, "app.dark": true, "exports.xlsx": true },
  "companies:list": COMPANIES.map((c) => ({ ...c, formCount: 4, logoId: null, ownerId: "u1" })),
  "forms:list": {
    counts: { all: 6, draft: 1, published: 4, closed: 1, archived: 0, deleted: 2, shared: 1 },
    forms: FORMS.map((f) => ({ ...f, sharedAs: null })),
  },
  get "forms:get"() {
    const p = VIEWER.plan;
    return { ...FORM_DETAIL, ownerPlan: { id: p.id, name: p.name, features: p.features, limits: p.limits } };
  },
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
    { _id: "e2", subject: "We have your answers - Client Onboarding", kind: "confirmation", to: "john@email.com", form: "Client Onboarding", state: "sent", detail: null, at: now - 2 * HOUR },
    { _id: "e3", subject: "Your week on Formkit: 38 responses", kind: "weekly report", to: "maya@studionine.co", form: null, state: "sent", detail: null, at: now - 3 * DAY },
  ],
  "collaborators:sharedWithMe": [
    { _id: "sw1", formId: "f9", title: "Northstar Partner Intake", owner: "Ben Carter", role: "editor", status: "active" },
  ],
  "analytics:overview": {
    from: now - 30 * DAY,
    to: now,
    days: 30,
    get full() {
      return (flag("fk_plan") ?? "pro") !== "free";
    },
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
  /** ?fk_css=1 shows the published form with sample custom CSS; ?fk_smart=1 turns on keys and piping. */
  get "publicForm:bySlug"() {
    if (flag("fk_smart")) {
      return {
        ...RUNNER,
        smart: { hidden: true, piping: true, calc: true, redirect: true },
        calc: [{ name: "total", formula: "budget * 2" }],
        blocks: [
          ...RUNNER.blocks.slice(0, 2).map((b, i) => ({ ...b, key: i === 0 ? "name" : "email" })),
          { ...RUNNER.blocks[0]!, _id: "b1h", type: "hidden", title: "Where they came from", key: "utm_source", defaultValue: "direct", required: false },
          { ...RUNNER.blocks[1]!, _id: "b2p", title: "Thanks {{name}} - where should the proposal for you go?", key: null },
          ...RUNNER.blocks.slice(2),
        ],
      };
    }
    if (flag("fk_quiz")) {
      return {
        ...RUNNER,
        welcome: null,
        quiz: { timeLimit: 20, shuffleQuestions: false, shuffleOptions: true, results: "instant", passMark: 60, oneAttempt: true },
        blocks: RUNNER.blocks.map((b) => (b._id === "b5" ? { ...b, type: "single-choice", marks: 2 } : b._id === "b6" ? { ...b, marks: 1 } : b)),
      };
    }
    if (flag("fk_logic")) {
      // Places left on the budget, an option hidden until the project mentions a website.
      return {
        ...RUNNER,
        blocks: RUNNER.blocks.map((b) =>
          b._id === "b5" ? { ...b, type: "single-choice", left: [3, 0, null, 12] } : b,
        ),
        endings: FORM_DETAIL.endings,
        logic: [
          { _id: "r4", join: "and", conditions: [{ blockId: "b4", operator: "not-contains", value: "website" }], action: "hide-options", targetId: "b5", options: ["More than £35k"] },
          { _id: "r3", join: "and", conditions: [{ blockId: "b5", operator: "is", value: "£20k–£35k" }], action: "ending", endingId: "e1" },
        ],
      };
    }
    return flag("fk_css")
      ? { ...RUNNER, custom: { font: null, css: ".fk-live-q-title { color: #c4614f; text-transform: uppercase; letter-spacing: .04em; } body { background: red; }" } }
      : RUNNER;
  },
  "comments:counts": { b2: 1 },
  "comments:list": {
    canComment: true,
    threads: [
      {
        _id: "c1", blockId: "b2", author: "Ravi Menon", image: null, color: "#4b9d6e",
        body: "@Maya Ortiz should this say where the proposal comes from? People will look for our name in their inbox.",
        createdAt: now - 40 * 60 * 1000, mine: false, canDelete: true, resolved: false, mentions: ["Maya Ortiz"],
        replies: [{ _id: "c2", blockId: "b2", author: "You", image: null, color: "#2e78bb", body: "Good call @Ravi Menon - adding a line of help text.", createdAt: now - 20 * 60 * 1000, mine: true, canDelete: true, mentions: ["Ravi Menon"] }],
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
    {
      _id: "r3",
      formId: "f1",
      name: "Serious enquiries",
      enabled: true,
      join: "or",
      conditions: [{ blockId: "b5", operator: "any-of", value: "£20k–£35k|More than £35k" }],
      groups: [
        { join: "and", conditions: [{ blockId: "b5", operator: "any-of", value: "£20k–£35k|More than £35k" }, { blockId: "b2", operator: "email-domain", value: "studionine.co" }] },
        { join: "and", conditions: [{ id: "ai1", source: "ai", blockId: "b4", operator: "yes", value: "Is this a large, multi-page website?", fallback: false }] },
      ],
      action: "ending",
      endingId: "e1",
      order: 2,
    },
    {
      _id: "r4",
      formId: "f1",
      name: "No rush options for small budgets",
      enabled: true,
      join: "and",
      conditions: [{ blockId: "b4", operator: "not-contains", value: "website" }],
      action: "hide-options",
      targetId: "b5",
      options: ["More than £35k"],
      order: 3,
    },
  ],
  "ai:usage": { used: 3, limit: 25, allowed: true },
  "insights:overview": {
    locked: false,
    total: 184,
    read: 171,
    sentiment: [
      { key: "positive", count: 112 },
      { key: "neutral", count: 41 },
      { key: "negative", count: 18 },
    ],
    urgency: [
      { key: "high", count: 9 },
      { key: "medium", count: 77 },
      { key: "low", count: 85 },
    ],
    averageScore: 63,
    scores: [
      { label: "0–19", count: 8 },
      { label: "20–39", count: 22 },
      { label: "40–59", count: 44 },
      { label: "60–79", count: 61 },
      { label: "80–100", count: 36 },
    ],
    topics: [
      { name: "website redesign", count: 64, positive: 44, negative: 5, averageScore: 71 },
      { name: "online booking", count: 41, positive: 30, negative: 3, averageScore: 78 },
      { name: "seo", count: 33, positive: 19, negative: 6, averageScore: 58 },
      { name: "slow site", count: 21, positive: 4, negative: 11, averageScore: 49 },
      { name: "branding", count: 18, positive: 13, negative: 1, averageScore: 66 },
      { name: "paid ads", count: 12, positive: 7, negative: 2, averageScore: 55 },
    ],
    intents: [
      { name: "wants a website quote", count: 58 },
      { name: "wants to book a call", count: 31 },
      { name: "comparing agencies", count: 19 },
      { name: "asking about pricing", count: 14 },
    ],
    daily: Array.from({ length: 30 }, (_, i) => ({ at: now - (29 - i) * DAY, count: 3 + ((i * 7) % 6), positive: 2 + ((i * 5) % 3), negative: i % 9 === 4 ? 3 : i % 4 === 0 ? 1 : 0 })),
    leads: [
      { _id: "r1", name: "John Smith", at: now - 2 * HOUR, score: 92, intent: "wants a website quote", urgency: "medium", sentiment: "positive", summary: "A new marketing site with online booking, £20k–£35k, live by early March." },
      { _id: "r2", name: "Priya Shah", at: now - 5 * HOUR, score: 88, intent: "wants to book a call", urgency: "high", sentiment: "positive", summary: "Rebrand and site for a 40-person studio; ready to start next month." },
      { _id: "r3", name: "Tom Okafor", at: now - 27 * HOUR, score: 81, intent: "comparing agencies", urgency: "medium", sentiment: "neutral", summary: "E-commerce rebuild; talking to two other agencies." },
      { _id: "r6", name: "Aoife Byrne", at: now - 4 * DAY, score: 77, intent: "wants a website quote", urgency: "low", sentiment: "positive", summary: "Portfolio site with a client area, flexible on timing." },
    ],
    followUp: [
      { _id: "r2", name: "Priya Shah", at: now - 5 * HOUR, score: 88, intent: "wants to book a call", urgency: "high", sentiment: "positive", summary: "Wants to start within a month - asked for a call this week." },
      { _id: "r9", name: "Ines Duarte", at: now - 8 * DAY, score: 34, intent: "complaint", urgency: "high", sentiment: "negative", summary: "Unhappy with a previous agency's slow site; worried about cost." },
    ],
    replies: { written: 168, emailed: 161, failed: 1, skipped: 3, helpful: 54, unhelpful: 4 },
    report: {
      at: now - 3 * HOUR,
      count: 171,
      headline: "Most people want a faster, bookable website, and those asking for online booking are your most promising leads.",
      themes: [
        { title: "Redesigns with booking", detail: "Two in five mention letting customers book or buy online; they score highest and are usually ready within a quarter.", share: 38 },
        { title: "Slow, dated sites", detail: "A steady group describe sites that are slow on phones and bring in few enquiries. They're frustrated but motivated.", share: 21 },
        { title: "Price-sensitive enquiries", detail: "Some ask about cost before anything else and compare several agencies.", share: 14 },
      ],
      opportunities: ["Offer a fixed-price booking-site package - it matches the most common and most promising request."],
      risks: ["People comparing agencies often go quiet; a same-day personal follow-up helps."],
      suggestions: ["Add a budget question with ranges so replies can be more specific.", "Put two short case studies in the reply background for booking projects."],
    },
  },
  "mutation:publicForm:startQuiz": () => ({ attemptId: "qa1", startedAt: Date.now(), endsAt: Date.now() + 20 * 60_000 }),
  "quiz:summary": {
    count: 64,
    toMark: 5,
    average: 71.4,
    passRate: 78,
    timedOut: 3,
    spread: [
      { label: "0–19%", count: 2 },
      { label: "20–39%", count: 4 },
      { label: "40–59%", count: 9 },
      { label: "60–79%", count: 21 },
      { label: "80–100%", count: 23 },
    ],
    questions: [
      { _id: "b5", title: "Budget range", keyed: true, right: 84 },
      { _id: "b6", title: "When does it need to be live?", keyed: true, right: 37 },
      { _id: "b4", title: "What are we making?", keyed: false, right: null },
    ],
    released: false,
    releasedAt: null,
    releaseAt: null,
  },
  "quiz:result": {
    title: "Client Onboarding",
    brand: { name: "Studio Nine", logoUrl: null, color: null },
    name: "John Smith",
    submittedAt: now - 2 * HOUR,
    released: true,
    score: 4,
    max: 5,
    percent: 80,
    passed: true,
    passMark: 60,
    pending: 0,
    timedOut: false,
    questions: [
      { title: "Which planet is known as the red planet?", given: "Mars", got: 1, max: 1, manual: false, answer: "Mars" },
      { title: "What is 7 × 8?", given: "54", got: 0, max: 1, manual: false, answer: "56" },
      { title: "Explain photosynthesis in a sentence.", given: "Plants turn light, water and CO₂ into sugar and oxygen.", got: 3, max: 3, manual: false, answer: null },
    ],
  },
  "aiReply:usage": { plan: "business", replies: { monthly: 30, used: 22, credits: 100, left: 108 }, checks: { limit: 1000, used: 318 }, pack: { price: 5, replies: 100 } },
  "action:aiReply:tryIt": {
    subject: "Your project with Studio Nine, John",
    reply: "Hi John,\n\nThanks for telling us about the new marketing site and booking flow. Sites that let people book in two or three taps usually turn far more visits into enquiries, so you're right to put that first.\n\nWe'd start with a short discovery session, then design the booking flow alongside the pages so they feel like one thing.\n\nIf it helps, book a free 20-minute call and we'll sketch a plan together.",
    needsHuman: false,
    insight: { sentiment: "positive", intent: "wants a new marketing site", topics: ["website", "booking flow"], score: 86, urgency: "medium", summary: "A new marketing site with online booking, live by early March." },
    sample: [
      { question: "What should we call you?", answer: "John Smith" },
      { question: "What are we making?", answer: "A new marketing site and a small booking flow." },
      { question: "Budget range", answer: "£20k–£35k" },
    ],
    made: false,
  },
  /** What "Describe a rule" writes in the preview. */
  "action:aiLogic:describe": {
    rules: [
      {
        name: "Fast track big budgets",
        explain: "People with a budget over £20k who write from a company address go straight to the “Big project” ending.",
        join: "and",
        groups: [
          {
            join: "and",
            conditions: [
              { blockId: "b5", operator: "any-of", value: "£20k–£35k|More than £35k" },
              { blockId: "b2", operator: "email-domain", value: "studionine.co" },
            ],
          },
        ],
        action: "ending",
        endingId: "e1",
      },
      {
        name: "Ask for a date on websites",
        explain: "When the project is a website, the launch date becomes required.",
        join: "and",
        groups: [{ join: "and", conditions: [{ blockId: "b4", operator: "contains", value: "website" }] }],
        action: "require",
        targetId: "b6",
      },
    ],
  },
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
    aiDefaultPrevious: 3,
    aiModelReady: true,
    openReports: 3,
    openTickets: 7,
    range: 30,
    newInRange: 612,
    responsesInRange: 91204,
    aiFormsBuilt: 388,
    aiCapacity: 1270,
    aiOutOfCredits: 12,
    standing: { active: 9920, suspended: 37, deleting: 57 },
    signups: [14, 18, 22, 19, 25, 31, 12, 9, 17, 21, 26, 28, 24, 30, 11, 8, 19, 23, 27, 22, 29, 33, 15, 10, 21, 24, 26, 31, 28, 35],
  },
  "admin:users": STAFF_USERS,
  "admin:usersPage": { total: 10020, page: 0, pageSize: 20, rows: STAFF_USERS },
  "admin:user": STAFF_USERS[0],
  "action:domains:inspect": {
    provider: { id: "namecheap", name: "Namecheap" },
    nameservers: ["dns1.registrar-servers.com", "dns2.registrar-servers.com"],
    cname: [],
    a: [],
    pointsHere: false,
    proxied: false,
  },
  "domains:mine": {
    configured: true,
    domains: [
      {
        _id: "d1",
        owner: "me",
        host: "forms.mayaortiz.design",
        apex: "mayaortiz.design",
        status: "pending",
        records: [{ type: "CNAME", name: "forms", value: "cname.vercel-dns.com" }],
        detail: "Waiting for the DNS record. Changes can take up to a few hours to spread.",
        checkedAt: now,
        identity: { name: "Maya Ortiz", handle: "maya" },
      },
    ],
  },
  "emailDomains:mine": {
    _id: "e1",
    domain: "studionine.co",
    status: "pending",
    fromLocal: "hello",
    fromName: "Studio Nine",
    checkedAt: now,
    detail: "Add these records where your domain's DNS is managed, then check again.",
    records: [
      { type: "MX", name: "send", value: "feedback-smtp.ap-northeast-1.amazonses.com", priority: 10 },
      { type: "TXT", name: "send", value: "v=spf1 include:amazonses.com ~all" },
      { type: "TXT", name: "resend._domainkey", value: "p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQC…" },
    ],
  },
  "connections:forForm": [
    {
      _id: "c1",
      kind: "webhook",
      label: "Zapier - add to HubSpot",
      url: "https://hooks.zapier.com/hooks/catch/1234567/abcdef/",
      feed: null,
      enabled: true,
      last: { at: now - 3600_000, ok: true, status: 200 },
      recent: [
        { at: now - 3600_000, ok: true, status: 200, attempt: 1, detail: null },
        { at: now - 7200_000, ok: false, status: 502, attempt: 1, detail: "Bad gateway" },
        { at: now - 7140_000, ok: true, status: 200, attempt: 2, detail: null },
      ],
    },
    {
      _id: "c2",
      kind: "sheets",
      label: null,
      url: null,
      feed: "https://formal-terrier-849.convex.site/sheets/3f9a1c0b7d2e4a5b8c6d9e0f1a2b3c4d5e6f7a8b",
      enabled: true,
      last: null,
      recent: [],
    },
  ],
  "payments:settings": {
    mine: true,
    account: { live: false, name: "Studio Nine", last4: "x9Qe", addedAt: now },
    payment: { enabled: true, currency: "usd", amount: 2500, label: "Workshop seat" },
    calcNames: ["total"],
    currencies: ["usd", "eur", "gbp", "cad", "aud", "inr", "bdt", "jpy"],
  },
  "team:overview": {
    members: [
      { _id: "t1", email: "ravi@studionine.co", name: "Ravi Menon", role: "admin", status: "active", invitedAt: now - 20 * DAY },
      { _id: "t2", email: "priya@studionine.co", name: "Priya Shah", role: "editor", status: "active", invitedAt: now - 9 * DAY },
      { _id: "t3", email: "leo@studionine.co", name: null, role: "viewer", status: "pending", invitedAt: now - 2 * HOUR },
    ],
    teams: [],
    approvals: true,
    enabled: true,
  },
  "approvals:waiting": [
    { formId: "f2", title: "Event RSVP", by: "Priya Shah", at: now - 3 * HOUR, note: "New venue details added" },
  ],
  "controls:auditLog": {
    enabled: true,
    more: false,
    rows: [
      { _id: "a1", at: now - 2 * HOUR, who: "Maya Ortiz", action: "Invited leo@studionine.co as Viewer", subject: null },
      { _id: "a2", at: now - 5 * HOUR, who: "Ravi Menon", action: "Approved and published", subject: "Client Onboarding" },
      { _id: "a3", at: now - 26 * HOUR, who: "Maya Ortiz", action: "Created an API key", subject: "Warehouse sync" },
      { _id: "a4", at: now - 3 * DAY, who: "Formkit", action: "Erased 12 responses past the retention period", subject: null },
    ],
  },
  "controls:retention": { days: 365, choices: [30, 90, 180, 365, 730] },
  "controls:apiKeys": [
    { _id: "k1", name: "Warehouse sync", prefix: "fk_live_3f9a", createdAt: now - 26 * HOUR, lastUsedAt: now - HOUR },
  ],
  "sso:settings": {
    sso: {
      domain: "studionine.co",
      verified: true,
      enforce: false,
      providers: ["google"],
      record: { type: "TXT", name: "_formkit.studionine.co", value: "formkit-verify=8c1f0a3b9d2e4f5a6b7c8d9e" },
    },
    available: ["google", "microsoft-entra-id"],
  },
  "sso:providers": [],
  "support:mine": { priority: true, tickets: [] },
  "revenue:overview": (() => {
    const months = Array.from({ length: 12 }, (_, i) => {
      const d = new Date();
      const m = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - 11 + i, 1));
      return `${m.getUTCFullYear()}-${String(m.getUTCMonth() + 1).padStart(2, "0")}`;
    });
    const mrr = [0, 0, 0, 0, 0, 12, 29, 41, 58, 77, 101, 121.5];
    return {
      generatedAt: now,
      totals: { users: 1284, paying: 31, comped: 2, conversion: 2.41, mrr: 121.5, arr: 1458, arpu: 3.92, monthlyPayers: 19, yearlyPayers: 12, cancelling: 2, cancellingMrr: 6, pastDue: 1, pastDueMrr: 10, collectedAll: 689, collected30: 187 },
      byPlan: [
        { plan: "free", total: 1251, monthly: 0, yearly: 0, comped: 0, mrr: 0 },
        { plan: "pro", total: 26, monthly: 15, yearly: 9, comped: 2, mrr: 70.25 },
        { plan: "business", total: 7, monthly: 4, yearly: 3, comped: 0, mrr: 51.25 },
      ],
      mrrSeries: months.map((m, i) => ({ month: m, mrr: mrr[i] })),
      revenueSeries: months.map((m, i) => ({ month: m, amount: [0, 0, 0, 0, 0, 16, 44, 71, 95, 118, 158, 187][i] })),
      moves: months.map((m, i) => ({ month: m, started: [0, 0, 0, 0, 0, 3, 5, 4, 5, 6, 7, 6][i], upgraded: i > 8 ? 1 : 0, downgraded: i === 10 ? 1 : 0, ended: i > 7 ? 1 : 0, cancelling: i === 11 ? 2 : 0 })),
      signups: months.map((m, i) => ({ month: m, free: [40, 52, 61, 70, 88, 94, 101, 117, 125, 139, 156, 142][i], pro: [0, 0, 0, 0, 0, 1, 2, 2, 3, 4, 5, 4][i], business: i > 8 ? 1 : 0, paying: 0 })),
      potential: {
        activeFree: 412,
        freeTotal: 1251,
        scenarios: [
          { pct: 5, accounts: 21, mrr: 63 },
          { pct: 10, accounts: 41, mrr: 123 },
          { pct: 25, accounts: 103, mrr: 309 },
        ],
        yearly: { payers: 19, cashUpfront: 877, yearValueChange: -103, monthlyMrr: 97 },
        businessUpside: 21,
      },
      leads: [
        { _id: "u2", name: "Ravi Menon", email: "ravi@studionine.co", responses: 1840, forms: 7, reasons: ["Used every AI credit", "1,840 responses", "3+ live forms"], score: 1 },
        { _id: "u5", name: "Priya Shah", email: "priya@lumen.studio", responses: 420, forms: 4, reasons: ["420 responses", "3+ live forms"], score: 1 },
      ],
      businessLeads: [{ _id: "u1", name: "Maya Ortiz", email: "maya@studionine.co", forms: 14, responses: 2210 }],
      risk: [
        { _id: "u7", name: "Leo Kim", email: "leo@example.com", plan: "business", interval: "month", why: "Payment failed", endsAt: now + 6 * DAY, mrr: 10 },
        { _id: "u8", name: "Ana Ruiz", email: "ana@example.com", plan: "pro", interval: "month", why: "Cancelling", endsAt: now + 12 * DAY, mrr: 3 },
      ],
      recent: [
        { at: now - 2 * HOUR, kind: "started", plan: "pro", prevPlan: "free", interval: "year", delta: 2.92, who: "sam@acme.co" },
        { at: now - 26 * HOUR, kind: "upgraded", plan: "business", prevPlan: "pro", interval: "month", delta: 7, who: "maya@studionine.co" },
        { at: now - 3 * DAY, kind: "cancelling", plan: "pro", prevPlan: "pro", interval: "month", delta: -3, who: "ana@example.com" },
      ],
    };
  })(),
  "billing:adminStatus": {
    token: true,
    secret: false,
    server: "sandbox",
    webhookUrl: "https://formal-terrier-849.convex.site/polar/webhook",
    products: {},
    lastEvent: null,
    counts: { pro: 38, business: 6, comped: 2, paying: 42 },
    mrr: 163.5,
  },
  "admin:aiStats": {
    rows: [
      { _id: "u1", name: "Maya Ortiz", email: "maya@studionine.co", enabled: true, limit: 25, override: 25, granted: 0, used: 19 },
      { _id: "u2", name: "Ravi Menon", email: "ravi@studionine.co", enabled: true, limit: 5, override: null, granted: 0, used: 5 },
      { _id: "u5", name: "Priya Shah", email: "priya@lumen.studio", enabled: true, limit: 10, override: null, granted: 5, used: 3 },
    ],
    overrides: [{ _id: "u1", name: "Maya Ortiz", email: "maya@studionine.co", enabled: true, limit: 25, override: 25, granted: 0, used: 19 }],
    heaviest: [
      { _id: "u1", name: "Maya Ortiz", email: "maya@studionine.co", enabled: true, limit: 25, override: 25, granted: 0, used: 19 },
      { _id: "u2", name: "Ravi Menon", email: "ravi@studionine.co", enabled: true, limit: 5, override: null, granted: 0, used: 5 },
      { _id: "u5", name: "Priya Shah", email: "priya@lumen.studio", enabled: true, limit: 10, override: null, granted: 5, used: 3 },
    ],
  },
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
  "admin:flags": [
    { key: "ai.live", label: "Live AI generation", description: "Ask Formkit calls the model. Off, it still answers simple questions, but writes and changes nothing, and spends no credits.", enabled: true, rollout: 100, changed: false },
    { key: "ai.brief", label: "Build from a brief", description: "Ask Formkit can work from a pasted brief, an uploaded document or an existing form.", enabled: true, rollout: 40, changed: true },
    { key: "forms.partials", label: "Save partial responses", description: "When somebody leaves a form half-way, what they answered is kept with a link to carry on. Decided by the form owner's account.", enabled: true, rollout: 100, changed: false },
    { key: "app.dark", label: "Dark mode", description: "A dark theme for the app, chosen under Settings → General → Appearance.", enabled: false, rollout: 100, changed: false },
    { key: "exports.xlsx", label: "Excel export", description: "Responses, contacts and analytics download as .xlsx as well as CSV.", enabled: true, rollout: 100, changed: false },
  ],
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

/** Queries that are slices of another fixture. */
function derived(name: string): unknown {
  if (name === "forms:summary") {
    const list = QUERIES["forms:list"] as { counts: unknown; forms: { responses: number }[] };
    return { counts: list.counts, responses: list.forms.reduce((n, f) => n + f.responses, 0) };
  }
  if (name === "forms:picker") {
    const list = QUERIES["forms:list"] as { forms: { _id: string; title: string; status: string; responses: number }[] };
    return list.forms.map((f) => ({ _id: f._id, title: f.title, status: f.status, responses: f.responses }));
  }
  if (name === "responses:recent") {
    const list = QUERIES["responses:list"] as { stats: Record<string, number>; responses: { preview?: boolean }[] };
    return { stats: list.stats, responses: list.responses.filter((r) => !r.preview).slice(0, 6) };
  }
  return undefined;
}

export function fixtureFor(name: string) {
  if (name in QUERIES) return QUERIES[name];
  const d = derived(name);
  return d === undefined ? null : d;
}
