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

const RESPONSES: Row[] = PEOPLE.map(([name, email, formId, ago, partial, status], i) => ({
  _id: `r${i + 1}`,
  formId,
  submittedAt: now - ago,
  partial,
  answeredCount: partial ? 4 : 11,
  totalCount: 11,
  answers: [
    { question: "What are we making?", value: "A new marketing site and a small booking flow.", fileName: null },
    { question: "When does it need to be live?", value: "Early March", fileName: null },
    { question: "Budget range", value: "£20k–£35k", fileName: null },
    { question: "Anything we should look at first?", value: "The current site, and two competitors.", fileName: null },
  ],
  files: [],
  respondentName: name,
  respondentEmail: email,
  device: i % 3 === 0 ? "Mobile" : "Desktop",
  source: i % 4 === 0 ? "Email" : "Direct",
  status,
  note: null,
  resumeToken: partial ? `tok${i}` : null,
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

export const VIEWER = {
  _id: "u1",
  name: "Maya Ortiz",
  email: "maya@studionine.co",
  image: null,
  handle: "maya",
  timezone: "Europe/London",
  onboarded: true,
  deactivated: false,
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
  ["client-onboarding", "Client onboarding", "Work", "Everything you need before the first call.", 11, 3],
  ["project-brief", "Project brief", "Work", "Scope, budget and references.", 7, 2],
  ["feedback", "Customer feedback", "Feedback", "Five questions, sent after handover.", 5, 1],
  ["contact", "Contact", "Sales", "Four fields and a reply address.", 4, 1],
  ["event-signup", "Event registration", "Events", "Names, numbers and dietary needs.", 6, 2],
  ["survey", "Research survey", "Research", "Ask a group the same thing, cleanly.", 8, 2],
].map(([slug, name, topic, blurb, questions, pages]) => ({
  slug,
  name,
  topic,
  blurb,
  audience: null,
  questions,
  pages,
  mine: false,
  _id: null,
}));

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
  "users:viewer": VIEWER,
  "companies:list": COMPANIES.map((c) => ({ ...c, formCount: 4, logoId: null, ownerId: "u1" })),
  "forms:list": {
    counts: { all: 6, draft: 1, published: 4, closed: 1, deleted: 0 },
    forms: FORMS,
  },
  "forms:get": FORM_DETAIL,
  "responses:list": {
    stats: { total: 1117, today: 2, week: 8, unread: 3, partial: 2, completed: 1115 },
    responses: RESPONSES,
  },
  "responses:get": RESPONSES[0],
  "responses:forExport": { rows: [], columns: [] },
  "templates:list": TEMPLATES,
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
  "notifications:log": [],
  "analytics:overview": {
    days: 30,
    views: 12483,
    starts: 8291,
    responses: 8291,
    completed: 5821,
    partial: 2470,
    completionRate: 70.2,
    finishRate: 46.6,
    medianSeconds: 252,
    buckets: BUCKETS,
    change: { responses: 11.4, completed: 14.2, completionRate: 4 },
    window: { responses: 8291, completed: 5821 },
    dropOff: BLOCKS.filter((b) => b.kind === "field").map((b, i) => ({
      title: b.title,
      reached: 1117 - i * 140,
      share: Math.round((100 - i * 12) * 10) / 10,
    })),
    devices: [
      { name: "Desktop", count: 742 },
      { name: "Mobile", count: 311 },
      { name: "Tablet", count: 64 },
    ],
    sources: [
      { name: "Direct", count: 508 },
      { name: "Email", count: 402 },
      { name: "Social", count: 207 },
    ],
    forms: FORMS.map((f) => ({
      _id: f._id,
      title: f.title,
      responses: f.responses,
      completed: f.completed,
      views: (f.responses as number) * 3,
      completionRate: f.completionRate,
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
        body: "Should this say where the proposal comes from? People will look for our name in their inbox.",
        createdAt: now - 40 * 60 * 1000, mine: false, canDelete: true, resolved: false,
        replies: [{ _id: "c2", blockId: "b2", author: "You", image: null, color: "#2e78bb", body: "Good call — adding a line of help text.", createdAt: now - 20 * 60 * 1000, mine: true, canDelete: true }],
      },
      { _id: "c3", blockId: null, author: "Ben Carter", image: null, color: "#c4614f", body: "Looks ready from my side.", createdAt: now - DAY, mine: false, canDelete: true, resolved: true, replies: [] },
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
export function fixtureFor(name: string) {
  if (name in QUERIES) return QUERIES[name];
  return null;
}
