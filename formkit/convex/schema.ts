import { defineSchema, defineTable } from "convex/server";
import { authTables } from "@convex-dev/auth/server";
import { v } from "convex/values";

/**
 * Formkit's data model.
 *
 * Identity is person-first: a user is a human being, companies are optional and
 * plural, and a form publishes under either. See PRODUCT_DECISIONS.md →
 * "Identity: one person, a personal link, any number of companies".
 */

const brandIdentity = v.union(v.literal("me"), v.id("companies"));

export const questionType = v.union(
  v.literal("short-text"),
  v.literal("long-text"),
  v.literal("email"),
  v.literal("phone"),
  v.literal("url"),
  v.literal("name"),
  v.literal("company"),
  v.literal("address"),
  v.literal("number"),
  v.literal("single-choice"),
  v.literal("multi-choice"),
  v.literal("dropdown"),
  v.literal("yes-no"),
  v.literal("date"),
  v.literal("time"),
  v.literal("rating"),
  v.literal("scale"),
  v.literal("file"),
  v.literal("signature"),
);

export default defineSchema({
  ...authTables,

  /**
   * `authTables.users` is extended rather than replaced — Convex Auth writes
   * name/email/image, and everything below is Formkit's own.
   */
  users: defineTable({
    // Written by Convex Auth.
    name: v.optional(v.string()),
    email: v.optional(v.string()),
    emailVerificationTime: v.optional(v.number()),
    image: v.optional(v.string()),
    isAnonymous: v.optional(v.boolean()),

    // Formkit's own profile.
    role: v.optional(v.string()), // what the person does, free text
    avatarId: v.optional(v.id("_storage")),
    handle: v.optional(v.string()), // the person's own formkit.app/<handle>
    timezone: v.optional(v.string()),
    onboardedAt: v.optional(v.number()),
    deactivatedAt: v.optional(v.number()), // suspended by staff, or deleted by the person
    /** Set only when the person deleted their own account: the 30-day restore window. */
    selfDeletedAt: v.optional(v.number()),

    // Staff access to the admin console. Absent for ordinary customers.
    staffRole: v.optional(
      v.union(v.literal("owner"), v.literal("admin"), v.literal("support")),
    ),

    // The plan (see model/plans.ts). Written by the Polar webhook; `planComp`
    // is a plan staff gave by hand, which wins over billing.
    plan: v.optional(v.union(v.literal("free"), v.literal("pro"), v.literal("business"))),
    planInterval: v.optional(v.union(v.literal("month"), v.literal("year"))),
    planStatus: v.optional(v.string()), // active, trialing, past_due, canceled…
    /** The end of the period paid for; a cancelled plan runs until then. */
    planEndsAt: v.optional(v.number()),
    planCancelAtPeriodEnd: v.optional(v.boolean()),
    planComp: v.optional(v.union(v.literal("pro"), v.literal("business"))),
    /** Pro: no "Made with Formkit" on forms published under the person's own name. */
    hideBadge: v.optional(v.boolean()),
    polarCustomerId: v.optional(v.string()),
    polarSubscriptionId: v.optional(v.string()),

    // Ask Formkit. Access is an admin-granted allow-list, off by default.
    aiUsed: v.optional(v.number()),
    aiLive: v.optional(v.boolean()),
    aiLiveSet: v.optional(v.boolean()),
    aiPeriod: v.optional(v.string()), // YYYY-MM, resets aiUsed on rollover

    // Settings → Preferences: the header sky follows the clock unless pinned.
    skyPref: v.optional(
      v.union(v.literal("sync"), v.literal("morning"), v.literal("afternoon"), v.literal("evening")),
    ),
    // Settings → General → Appearance, when the dark mode flag reaches them.
    appTheme: v.optional(v.union(v.literal("light"), v.literal("dark"), v.literal("system"))),

    // Settings → Account → Security.
    signInAlerts: v.optional(v.boolean()), // absent means on
    twoFactor: v.optional(
      v.object({
        secret: v.string(),
        enabledAt: v.number(),
        lastStep: v.optional(v.number()),
        /** SHA-256 of each unused recovery code. */
        recovery: v.array(v.string()),
      }),
    ),
    twoFactorPending: v.optional(v.object({ secret: v.string(), at: v.number() })),
    emailChange: v.optional(
      v.object({ email: v.string(), codeHash: v.string(), expiresAt: v.number(), tries: v.number() }),
    ),

    // Settings → Notifications: what the account emails about, and the
    // default recipient and wording every form starts from.
    emailPrefs: v.optional(
      v.object({
        newResponse: v.optional(v.boolean()),
        /** Email a reply or mention still unread after ten minutes. Absent means on. */
        comments: v.optional(v.boolean()),
        daily: v.optional(v.boolean()),
        weekly: v.optional(v.boolean()),
        to: v.optional(v.string()),
        subject: v.optional(v.string()),
        body: v.optional(v.string()),
      }),
    ),
    // Settings → Notifications → In the app: which kinds reach the bell.
    inAppPrefs: v.optional(
      v.object({
        responses: v.optional(v.boolean()), // on forms I own; absent means on
        sharedResponses: v.optional(v.boolean()), // on forms shared with me; absent means off
        comments: v.optional(v.boolean()),
        sharing: v.optional(v.boolean()),
        forms: v.optional(v.boolean()),
        security: v.optional(v.boolean()),
      }),
    ),
    // Settings → Exports → Email a copy: every new response, in full.
    emailCopy: v.optional(v.object({ on: v.boolean(), to: v.string() })),
    lastDaily: v.optional(v.string()), // YYYY-MM-DD in the person's zone
    lastWeekly: v.optional(v.string()),
  })
    .index("email", ["email"])
    .index("by_handle", ["handle"])
    .index("by_self_deleted", ["selfDeletedAt"])
    .index("by_polar_customer", ["polarCustomerId"]),

  companies: defineTable({
    ownerId: v.id("users"),
    name: v.string(),
    handle: v.optional(v.string()),
    legalName: v.optional(v.string()),
    tagline: v.optional(v.string()),
    industry: v.optional(v.string()),
    website: v.optional(v.string()),
    contactEmail: v.optional(v.string()),
    phone: v.optional(v.string()),
    taxId: v.optional(v.string()),
    address: v.optional(v.string()),
    brandColor: v.optional(v.string()),
    logoId: v.optional(v.id("_storage")),
    useBranding: v.optional(v.boolean()),
    badge: v.optional(v.boolean()),
  })
    .index("by_owner", ["ownerId"])
    .index("by_handle", ["handle"]),

  /**
   * One claim path for every identity's public link, so the same name cannot be
   * taken twice across an account. `formUrl()` reads this, never a concatenated
   * `formkit.app/f/`.
   */
  handles: defineTable({
    value: v.string(),
    ownerType: v.union(v.literal("user"), v.literal("company")),
    userId: v.id("users"),
    companyId: v.optional(v.id("companies")),
  })
    .index("by_value", ["value"])
    .index("by_user", ["userId"]),

  forms: defineTable({
    ownerId: v.id("users"),
    brand: brandIdentity,
    title: v.string(),
    slug: v.string(),
    description: v.optional(v.string()),
    /** Archived: put away, out of the lists and off the public link, kept whole. */
    status: v.union(
      v.literal("draft"),
      v.literal("published"),
      v.literal("closed"),
      v.literal("archived"),
    ),

    welcome: v.optional(
      v.object({
        title: v.string(),
        message: v.string(),
        button: v.optional(v.string()),
      }),
    ),
    thanks: v.optional(
      v.object({
        title: v.string(),
        message: v.string(),
        buttonLabel: v.optional(v.string()),
        buttonUrl: v.optional(v.string()),
        redirect: v.optional(v.string()),
      }),
    ),

    theme: v.optional(v.any()),
    notify: v.optional(v.any()),
    /** Who may answer, and how often. See `model/security.ts`. */
    security: v.optional(v.any()),
    closing: v.optional(
      v.object({
        message: v.optional(v.string()),
        closeAt: v.optional(v.number()),
        closeAfter: v.optional(v.number()),
        closedBy: v.optional(v.string()),
        closedAt: v.optional(v.number()),
        /** The zone a closing date is written in, and timestamps are read in. */
        timezone: v.optional(v.string()),
      }),
    ),

    /** Kept in step with the blocks by `recount`, so the forms list never reads them. */
    questionCount: v.optional(v.number()),
    pageCount: v.optional(v.number()),
    responsesCount: v.number(),
    completedCount: v.number(),
    views: v.optional(v.number()),
    starts: v.optional(v.number()),

    liveVersion: v.optional(v.number()),
    deletedAt: v.optional(v.number()), // 60-day bin
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_owner", ["ownerId"])
    .index("by_owner_status", ["ownerId", "status"])
    .index("by_slug", ["slug"])
    .index("by_status", ["status"])
    .index("by_deleted", ["deletedAt"]),

  /** Questions and page breaks share one ordered list, as in the builder. */
  blocks: defineTable({
    formId: v.id("forms"),
    order: v.number(),
    kind: v.union(v.literal("field"), v.literal("pagebreak")),
    type: v.optional(questionType),
    title: v.optional(v.string()),
    help: v.optional(v.string()),
    placeholder: v.optional(v.string()),
    required: v.optional(v.boolean()),
    options: v.optional(v.array(v.string())),
    /** Accepted file extensions, like ".pdf". Empty or absent takes anything. */
    accept: v.optional(v.array(v.string())),
    scaleMin: v.optional(v.number()),
    scaleMax: v.optional(v.number()),
    pageName: v.optional(v.string()),
  }).index("by_form_order", ["formId", "order"]),

  logicRules: defineTable({
    formId: v.id("forms"),
    name: v.string(),
    enabled: v.boolean(),
    join: v.union(v.literal("and"), v.literal("or")),
    conditions: v.array(
      v.object({
        blockId: v.optional(v.id("blocks")),
        operator: v.string(),
        value: v.optional(v.string()),
      }),
    ),
    action: v.union(
      v.literal("show"),
      v.literal("hide"),
      v.literal("require"),
      v.literal("jump"),
    ),
    targetId: v.optional(v.id("blocks")),
    order: v.number(),
  }).index("by_form", ["formId", "order"]),

  responses: defineTable({
    formId: v.id("forms"),
    ownerId: v.id("users"),
    submittedAt: v.number(),
    partial: v.boolean(),
    answeredCount: v.number(),
    totalCount: v.number(),
    answers: v.array(
      v.object({
        blockId: v.id("blocks"),
        question: v.string(),
        value: v.optional(v.string()),
        values: v.optional(v.array(v.string())),
        fileId: v.optional(v.id("_storage")),
        fileName: v.optional(v.string()),
      }),
    ),
    respondentName: v.optional(v.string()),
    respondentEmail: v.optional(v.string()),
    respondentPhone: v.optional(v.string()),
    respondentCompany: v.optional(v.string()),
    device: v.optional(v.string()),
    source: v.optional(v.string()),
    durationMs: v.optional(v.number()),
    status: v.union(v.literal("new"), v.literal("read"), v.literal("reviewed")),
    note: v.optional(v.string()),
    resumeToken: v.optional(v.string()),
    versionNumber: v.optional(v.number()),
    /** A random id the respondent's browser keeps, for the per-device rules. */
    deviceId: v.optional(v.string()),
    /** Sent from the builder's preview rather than the public link. */
    preview: v.optional(v.boolean()),
    /** The owner's own labels, shown on the response and on the contact. */
    tags: v.optional(v.array(v.string())),
  })
    .index("by_form", ["formId"])
    .index("by_form_device", ["formId", "deviceId"])
    .index("by_owner", ["ownerId"])
    .index("by_owner_status", ["ownerId", "status"])
    .index("by_owner_submitted", ["ownerId", "submittedAt"])
    .index("by_form_submitted", ["formId", "submittedAt"])
    .index("by_resume", ["resumeToken"]),

  /**
   * Each time a published form is opened or started, so views and starts can
   * be counted inside a date range and by where people came from.
   */
  formEvents: defineTable({
    formId: v.id("forms"),
    ownerId: v.id("users"),
    kind: v.union(v.literal("view"), v.literal("start")),
    at: v.number(),
    source: v.optional(v.string()),
  })
    .index("by_form_at", ["formId", "at"])
    .index("by_owner_at", ["ownerId", "at"]),

  /**
   * What Formkit knows about each signed-in session: the device it is on,
   * when it was last seen, and whether its two-factor code has been given.
   */
  sessionInfo: defineTable({
    sessionId: v.id("authSessions"),
    userId: v.id("users"),
    device: v.string(),
    firstSeen: v.number(),
    lastSeen: v.number(),
    twoFactorAt: v.optional(v.number()),
    failures: v.optional(v.number()),
    lockedUntil: v.optional(v.number()),
  })
    .index("by_session", ["sessionId"])
    .index("by_user", ["userId"]),

  /** Exports someone downloaded or emailed, so Settings can list them again. */
  exports: defineTable({
    userId: v.id("users"),
    formId: v.optional(v.id("forms")),
    what: v.union(v.literal("responses"), v.literal("contacts"), v.literal("analytics")),
    format: v.union(v.literal("csv"), v.literal("xlsx")),
    filename: v.string(),
    rows: v.number(),
    from: v.optional(v.number()),
    to: v.optional(v.number()),
    ids: v.optional(v.array(v.id("responses"))),
    emailedTo: v.optional(v.string()),
    at: v.number(),
  }).index("by_user_at", ["userId", "at"]),

  /** Every publish freezes the questions. Newest first when read. */
  versions: defineTable({
    formId: v.id("forms"),
    number: v.number(),
    label: v.string(),
    blocks: v.array(v.any()),
    publishedAt: v.number(),
    publishedBy: v.optional(v.string()),
  }).index("by_form", ["formId", "number"]),

  templates: defineTable({
    // Built-in templates have no owner; a saved one belongs to its author.
    ownerId: v.optional(v.id("users")),
    slug: v.string(),
    name: v.string(),
    topic: v.string(),
    blurb: v.string(),
    audience: v.optional(v.string()),
    blocks: v.array(v.any()),
    welcome: v.optional(v.any()),
    thanks: v.optional(v.any()),
    theme: v.optional(v.any()),
    /** Logic rules, pointing at questions by their position in `blocks`. */
    rules: v.optional(v.array(v.any())),
    keepsTheme: v.optional(v.boolean()),
    keepsLogic: v.optional(v.boolean()),
    keepsCopy: v.optional(v.boolean()),
    createdAt: v.number(),
  })
    .index("by_owner", ["ownerId"])
    .index("by_slug", ["slug"]),

  collaborators: defineTable({
    formId: v.id("forms"),
    email: v.string(),
    userId: v.optional(v.id("users")),
    role: v.union(v.literal("editor"), v.literal("commenter"), v.literal("viewer")),
    status: v.union(v.literal("active"), v.literal("pending")),
    invitedAt: v.number(),
    note: v.optional(v.string()),
    /** Who sent the invitation, so they hear when it is taken up. */
    invitedBy: v.optional(v.id("users")),
  })
    .index("by_form", ["formId"])
    .index("by_email", ["email"]),

  comments: defineTable({
    formId: v.id("forms"),
    blockId: v.optional(v.id("blocks")),
    parentId: v.optional(v.id("comments")),
    authorId: v.id("users"),
    body: v.string(),
    resolved: v.boolean(),
    createdAt: v.number(),
    /** People @mentioned in the body. */
    mentions: v.optional(v.array(v.id("users"))),
  }).index("by_form", ["formId"]),

  /**
   * The bell: one row per thing a person should know about. Responses to the
   * same form coalesce into one unread row with a count, so a busy form does
   * not bury everything else.
   */
  inbox: defineTable({
    userId: v.id("users"),
    kind: v.string(),
    title: v.string(),
    body: v.optional(v.string()),
    href: v.optional(v.string()),
    /** What the action button says, next to the link. */
    action: v.optional(v.string()),
    icon: v.optional(v.string()),
    formId: v.optional(v.id("forms")),
    commentId: v.optional(v.id("comments")),
    responseId: v.optional(v.id("responses")),
    actorId: v.optional(v.id("users")),
    count: v.optional(v.number()),
    at: v.number(),
    readAt: v.optional(v.number()),
    emailedAt: v.optional(v.number()),
  })
    .index("by_user_at", ["userId", "at"])
    .index("by_user_read", ["userId", "readAt"])
    .index("by_user_form_kind", ["userId", "formId", "kind"]),

  /** Which live announcements a person has already seen in the bell. */
  announcementReads: defineTable({
    userId: v.id("users"),
    announcementId: v.id("announcements"),
    at: v.number(),
  }).index("by_user", ["userId"]),

  activity: defineTable({
    formId: v.optional(v.id("forms")),
    userId: v.id("users"),
    what: v.string(),
    /** A lucide icon name for the mark beside the line. */
    icon: v.optional(v.string()),
    at: v.number(),
  })
    .index("by_form", ["formId"])
    .index("by_user", ["userId"]),

  /**
   * "Copy invite link": anyone who opens it while signed in joins the form in
   * the role it was made with. It lasts seven days.
   */
  joinLinks: defineTable({
    formId: v.id("forms"),
    token: v.string(),
    role: v.union(v.literal("editor"), v.literal("commenter"), v.literal("viewer")),
    createdBy: v.id("users"),
    expiresAt: v.number(),
  })
    .index("by_token", ["token"])
    .index("by_form", ["formId"]),

  /** Who has a form open right now, and on which question. */
  presence: defineTable({
    formId: v.id("forms"),
    userId: v.id("users"),
    blockId: v.optional(v.string()),
    at: v.number(),
  })
    .index("by_form", ["formId"])
    .index("by_form_user", ["formId", "userId"]),

  /** The customer-side record of what Formkit sent on their behalf. */
  emailLog: defineTable({
    userId: v.id("users"),
    formId: v.optional(v.id("forms")),
    kind: v.string(), // notification | confirmation | export | auth
    to: v.string(),
    subject: v.string(),
    state: v.string(), // sent | failed
    detail: v.optional(v.string()),
    at: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_form", ["formId"]),

  /**
   * Platform state the admin console owns. A single settings row plus per-user
   * AI access, so the customer app follows an admin change on the next read.
   */
  platform: defineTable({
    key: v.string(),
    value: v.any(),
  }).index("by_key", ["key"]),

  aiAccess: defineTable({
    userId: v.id("users"),
    enabled: v.boolean(),
    limitOverride: v.optional(v.number()),
    granted: v.optional(v.number()),
    changedBy: v.optional(v.id("users")),
    changedAt: v.number(),
  }).index("by_user", ["userId"]),

  auditLog: defineTable({
    actorId: v.optional(v.id("users")),
    actorName: v.string(),
    action: v.string(),
    subject: v.optional(v.string()),
    detail: v.optional(v.string()),
    at: v.number(),
  }).index("by_at", ["at"]),

  moderation: defineTable({
    formId: v.optional(v.id("forms")),
    formTitle: v.string(),
    ownerName: v.string(),
    reason: v.string(),
    state: v.union(v.literal("open"), v.literal("locked"), v.literal("dismissed")),
    reportedAt: v.number(),
    /** What the form was before a lock closed it, so unlocking can put it back. */
    statusBeforeLock: v.optional(v.string()),
  }).index("by_state", ["state"]),

  tickets: defineTable({
    userId: v.optional(v.id("users")),
    fromName: v.string(),
    fromEmail: v.string(),
    subject: v.string(),
    state: v.union(v.literal("open"), v.literal("answered"), v.literal("closed")),
    messages: v.array(
      v.object({ who: v.string(), body: v.string(), at: v.number() }),
    ),
    openedAt: v.number(),
  }).index("by_state", ["state"]),

  announcements: defineTable({
    title: v.string(),
    body: v.string(),
    audience: v.string(),
    state: v.union(v.literal("draft"), v.literal("live"), v.literal("ended")),
    createdAt: v.number(),
  }),

  featureFlags: defineTable({
    key: v.string(),
    label: v.string(),
    description: v.string(),
    enabled: v.boolean(),
    rollout: v.number(),
  }).index("by_key", ["key"]),
});
