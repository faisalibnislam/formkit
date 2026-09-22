import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import {
  PERMS,
  ROLE_DEFAULTS,
  aiAllowed,
  aiLimit,
  currentUser,
  platformValue,
  requireStaff,
  setPlatformValue,
  staffPermissions,
  writeAudit,
} from "./model/identity";

/**
 * The admin console.
 *
 * Nothing here is reachable without a staff role, and every destructive or
 * account-touching action is written to the audit log with who did it. The
 * console is unlinked from the product — `who()` is what decides whether
 * formkit.app/admin shows anything at all.
 */

export const PERM_LABELS: Record<string, { label: string; detail: string }> = {
  "users.view": {
    label: "See users",
    detail: "Open anyone and read their forms, responses and usage.",
  },
  "users.suspend": {
    label: "Suspend users",
    detail: "Deactivate an account without destroying anything.",
  },
  "users.delete": {
    label: "Delete users",
    detail: "Destroy an account and everything in it. This cannot be undone.",
  },
  "ai.access": {
    label: "Manage AI access",
    detail: "Turn Ask Formkit on for one person, set their limit and grant extra credits.",
  },
  moderation: { label: "Moderate forms", detail: "Lock a reported form or dismiss the report." },
  support: { label: "Reply to support", detail: "Answer tickets as Formkit and close them." },
  announcements: {
    label: "Publish announcements",
    detail: "Push a message to every customer dashboard.",
  },
  flags: { label: "Change feature flags", detail: "Turn platform features on and off." },
  team: { label: "Manage team access", detail: "Invite staff, change roles and set permissions." },
};

/** Who is looking, and what they may do. Null for anybody who is not staff. */
export const who = query({
  args: {},
  handler: async (ctx) => {
    const user = await currentUser(ctx);
    if (!user) return { signedIn: false, staff: null };
    if (!user.staffRole) return { signedIn: true, staff: null };
    return {
      signedIn: true,
      staff: {
        _id: user._id,
        name: user.name ?? user.email ?? "Staff",
        email: user.email ?? "",
        role: user.staffRole,
        permissions: await staffPermissions(ctx, user),
      },
    };
  },
});

/* ------------------------------------------------------------------ */
/* Overview                                                            */
/* ------------------------------------------------------------------ */

export const overview = query({
  args: {},
  handler: async (ctx) => {
    await requireStaff(ctx);
    const users = await ctx.db.query("users").collect();
    const forms = await ctx.db.query("forms").collect();
    const responses = await ctx.db.query("responses").collect();
    const access = await ctx.db.query("aiAccess").collect();
    const reports = await ctx.db.query("moderation").collect();
    const tickets = await ctx.db.query("tickets").collect();

    const week = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const period = new Date().toISOString().slice(0, 7);

    return {
      users: users.length,
      newUsers: users.filter((u) => u._creationTime >= week).length,
      deactivated: users.filter((u) => u.deactivatedAt).length,
      staff: users.filter((u) => u.staffRole).length,
      forms: forms.filter((f) => !f.deletedAt).length,
      live: forms.filter((f) => f.status === "published" && !f.deletedAt).length,
      responses: responses.length,
      responsesWeek: responses.filter((r) => r.submittedAt >= week).length,
      aiAllowed: access.filter((a) => a.enabled).length,
      aiUsed: users
        .filter((u) => u.aiPeriod === period)
        .reduce((n, u) => n + (u.aiUsed ?? 0), 0),
      aiPaused: (await platformValue<boolean>(ctx, "aiPaused")) ?? false,
      aiDefault: (await platformValue<number>(ctx, "aiDefault")) ?? 5,
      openReports: reports.filter((r) => r.state === "open").length,
      openTickets: tickets.filter((t) => t.state === "open").length,
    };
  },
});

/* ------------------------------------------------------------------ */
/* Users                                                               */
/* ------------------------------------------------------------------ */

async function describeUser(ctx: Parameters<typeof aiLimit>[0], u: Doc<"users">) {
  const forms = await ctx.db
    .query("forms")
    .withIndex("by_owner", (q) => q.eq("ownerId", u._id))
    .collect();
  const period = new Date().toISOString().slice(0, 7);
  return {
    _id: u._id,
    name: u.name ?? "",
    email: u.email ?? "",
    handle: u.handle ?? null,
    joinedAt: u._creationTime,
    staffRole: u.staffRole ?? null,
    deactivatedAt: u.deactivatedAt ?? null,
    forms: forms.filter((f) => !f.deletedAt).length,
    responses: forms.reduce((n, f) => n + f.responsesCount, 0),
    ai: {
      allowed: await aiAllowed(ctx, u._id),
      limit: await aiLimit(ctx, u._id),
      used: u.aiPeriod === period ? (u.aiUsed ?? 0) : 0,
    },
  };
}

export const users = query({
  args: { search: v.optional(v.string()), only: v.optional(v.string()) },
  handler: async (ctx, { search, only }) => {
    await requireStaff(ctx, "users.view");
    const term = search?.trim().toLowerCase();
    const rows = (await ctx.db.query("users").collect())
      .filter((u) =>
        term
          ? `${u.name ?? ""} ${u.email ?? ""} ${u.handle ?? ""}`.toLowerCase().includes(term)
          : true,
      )
      .sort((a, b) => b._creationTime - a._creationTime);

    const described = await Promise.all(rows.map((u) => describeUser(ctx, u)));
    if (only === "ai") return described.filter((u) => u.ai.allowed);
    if (only === "suspended") return described.filter((u) => u.deactivatedAt);
    return described;
  },
});

export const setStanding = mutation({
  args: { userId: v.id("users"), deactivated: v.boolean() },
  returns: v.null(),
  handler: async (ctx, { userId, deactivated }) => {
    const staff = await requireStaff(ctx, "users.suspend");
    const target = await ctx.db.get(userId);
    if (!target) throw new Error("That account no longer exists.");
    if (target.staffRole === "owner") throw new Error("An owner cannot be suspended.");

    await ctx.db.patch(userId, { deactivatedAt: deactivated ? Date.now() : undefined });
    await writeAudit(
      ctx,
      staff,
      deactivated ? "Suspended an account" : "Reactivated an account",
      target.email ?? target.name,
    );
    return null;
  },
});

/** Deleting an account destroys its forms, questions, rules and responses. */
export const deleteUser = mutation({
  args: { userId: v.id("users"), confirm: v.string() },
  returns: v.null(),
  handler: async (ctx, { userId, confirm }) => {
    const staff = await requireStaff(ctx, "users.delete");
    const target = await ctx.db.get(userId);
    if (!target) return null;
    if (target.staffRole === "owner") throw new Error("An owner cannot be deleted.");
    if (confirm !== (target.email ?? "")) {
      throw new Error("Type the account's email address exactly to confirm.");
    }

    const forms = await ctx.db
      .query("forms")
      .withIndex("by_owner", (q) => q.eq("ownerId", userId))
      .collect();
    for (const form of forms) {
      const blocks = await ctx.db
        .query("blocks")
        .withIndex("by_form_order", (q) => q.eq("formId", form._id))
        .collect();
      for (const b of blocks) await ctx.db.delete(b._id);
      for (const table of ["logicRules", "responses", "versions"] as const) {
        const rows = await ctx.db
          .query(table)
          .withIndex("by_form", (q) => q.eq("formId", form._id))
          .collect();
        for (const r of rows) await ctx.db.delete(r._id);
      }
      await ctx.db.delete(form._id);
    }

    const companies = await ctx.db
      .query("companies")
      .withIndex("by_owner", (q) => q.eq("ownerId", userId))
      .collect();
    for (const c of companies) await ctx.db.delete(c._id);

    const handles = await ctx.db
      .query("handles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    for (const h of handles) await ctx.db.delete(h._id);

    await ctx.db.delete(userId);
    await writeAudit(
      ctx,
      staff,
      "Deleted an account and all of its data",
      target.email ?? target.name,
      `${forms.length} forms`,
    );
    return null;
  },
});

/* ------------------------------------------------------------------ */
/* AI access                                                           */
/* ------------------------------------------------------------------ */

export const setAiAccess = mutation({
  args: {
    userId: v.id("users"),
    enabled: v.optional(v.boolean()),
    limitOverride: v.optional(v.number()),
    grant: v.optional(v.number()),
    resetUsage: v.optional(v.boolean()),
  },
  returns: v.null(),
  handler: async (ctx, { userId, enabled, limitOverride, grant, resetUsage }) => {
    const staff = await requireStaff(ctx, "ai.access");
    const target = await ctx.db.get(userId);
    if (!target) throw new Error("That account no longer exists.");

    const row = await ctx.db
      .query("aiAccess")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();

    const next = {
      userId,
      enabled: enabled ?? row?.enabled ?? false,
      limitOverride: limitOverride ?? row?.limitOverride,
      granted: (row?.granted ?? 0) + (grant ?? 0),
      changedBy: staff._id,
      changedAt: Date.now(),
    };
    if (row) await ctx.db.patch(row._id, next);
    else await ctx.db.insert("aiAccess", next);

    if (resetUsage) await ctx.db.patch(userId, { aiUsed: 0 });

    const what =
      enabled === true
        ? "Turned on Ask Formkit"
        : enabled === false
          ? "Turned off Ask Formkit"
          : grant
            ? `Granted ${grant} extra credits`
            : resetUsage
              ? "Reset this month's AI usage"
              : "Changed the AI limit";
    await writeAudit(ctx, staff, what, target.email ?? target.name);
    return null;
  },
});

/** The platform pause suspends everyone at once, without forgetting who was allowed. */
export const setAiPlatform = mutation({
  args: { paused: v.optional(v.boolean()), defaultLimit: v.optional(v.number()) },
  returns: v.null(),
  handler: async (ctx, { paused, defaultLimit }) => {
    const staff = await requireStaff(ctx, "ai.access");
    if (paused !== undefined) {
      await setPlatformValue(ctx, "aiPaused", paused);
      await writeAudit(ctx, staff, paused ? "Paused Ask Formkit everywhere" : "Resumed Ask Formkit");
    }
    if (defaultLimit !== undefined) {
      await setPlatformValue(ctx, "aiDefault", defaultLimit);
      await writeAudit(ctx, staff, `Set the AI default to ${defaultLimit} a month`);
    }
    return null;
  },
});

/* ------------------------------------------------------------------ */
/* Moderation                                                          */
/* ------------------------------------------------------------------ */

export const reports = query({
  args: {},
  handler: async (ctx) => {
    await requireStaff(ctx, "moderation");
    return (await ctx.db.query("moderation").collect()).sort((a, b) => b.reportedAt - a.reportedAt);
  },
});

export const resolveReport = mutation({
  args: {
    reportId: v.id("moderation"),
    state: v.union(v.literal("locked"), v.literal("dismissed"), v.literal("open")),
  },
  returns: v.null(),
  handler: async (ctx, { reportId, state }) => {
    const staff = await requireStaff(ctx, "moderation");
    const report = await ctx.db.get(reportId);
    if (!report) return null;
    await ctx.db.patch(reportId, { state });

    // Locking a form stops it collecting; it is not deleted, and its responses stay.
    if (state === "locked" && report.formId) {
      await ctx.db.patch(report.formId, {
        status: "closed",
        closing: {
          message: "This form has been closed while Formkit reviews a report about it.",
          closedBy: "Formkit",
          closedAt: Date.now(),
        },
      });
    }
    await writeAudit(
      ctx,
      staff,
      state === "locked" ? "Locked a reported form" : state === "dismissed" ? "Dismissed a report" : "Reopened a report",
      report.formTitle,
    );
    return null;
  },
});

/* ------------------------------------------------------------------ */
/* Support                                                             */
/* ------------------------------------------------------------------ */

export const tickets = query({
  args: {},
  handler: async (ctx) => {
    await requireStaff(ctx, "support");
    return (await ctx.db.query("tickets").collect()).sort((a, b) => b.openedAt - a.openedAt);
  },
});

export const replyToTicket = mutation({
  args: { ticketId: v.id("tickets"), body: v.string(), close: v.optional(v.boolean()) },
  returns: v.null(),
  handler: async (ctx, { ticketId, body, close }) => {
    const staff = await requireStaff(ctx, "support");
    const ticket = await ctx.db.get(ticketId);
    if (!ticket) throw new Error("That ticket no longer exists.");

    await ctx.db.patch(ticketId, {
      messages: [
        ...ticket.messages,
        { who: staff.name ?? "Formkit", body: body.trim(), at: Date.now() },
      ],
      state: close ? "closed" : "answered",
    });
    await writeAudit(ctx, staff, close ? "Answered and closed a ticket" : "Answered a ticket", ticket.subject);
    return null;
  },
});

/* ------------------------------------------------------------------ */
/* Announcements                                                       */
/* ------------------------------------------------------------------ */

export const announcements = query({
  args: {},
  handler: async (ctx) => {
    await requireStaff(ctx, "announcements");
    return (await ctx.db.query("announcements").collect()).sort(
      (a, b) => b.createdAt - a.createdAt,
    );
  },
});

export const saveAnnouncement = mutation({
  args: {
    announcementId: v.optional(v.id("announcements")),
    title: v.string(),
    body: v.string(),
    audience: v.optional(v.string()),
    state: v.union(v.literal("draft"), v.literal("live"), v.literal("ended")),
  },
  returns: v.null(),
  handler: async (ctx, { announcementId, title, body, audience, state }) => {
    const staff = await requireStaff(ctx, "announcements");
    const fields = { title: title.trim(), body: body.trim(), audience: audience ?? "Everyone", state };
    if (announcementId) await ctx.db.patch(announcementId, fields);
    else await ctx.db.insert("announcements", { ...fields, createdAt: Date.now() });
    await writeAudit(
      ctx,
      staff,
      state === "live" ? "Published an announcement" : "Saved an announcement",
      fields.title,
    );
    return null;
  },
});

/* ------------------------------------------------------------------ */
/* Email log, platform-wide                                            */
/* ------------------------------------------------------------------ */

export const mail = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit = 100 }) => {
    await requireStaff(ctx);
    const rows = (await ctx.db.query("emailLog").collect())
      .sort((a, b) => b.at - a.at)
      .slice(0, limit);
    return Promise.all(
      rows.map(async (r) => ({
        _id: r._id,
        kind: r.kind,
        to: r.to,
        subject: r.subject,
        state: r.state,
        detail: r.detail ?? null,
        at: r.at,
        account: (await ctx.db.get(r.userId))?.email ?? "",
      })),
    );
  },
});

/* ------------------------------------------------------------------ */
/* Team access                                                         */
/* ------------------------------------------------------------------ */

export const team = query({
  args: {},
  handler: async (ctx) => {
    await requireStaff(ctx, "team");
    const rows = (await ctx.db.query("users").collect()).filter((u) => u.staffRole);
    const overrides = (await platformValue<Record<string, string[]>>(ctx, "staffPerms")) ?? {};
    const roles = (await platformValue<Record<string, string[]>>(ctx, "rolePerms")) ?? {};

    return {
      perms: PERMS.map((p) => ({ key: p, ...PERM_LABELS[p]! })),
      roles: (["owner", "admin", "support"] as const).map((r) => ({
        role: r,
        permissions: r === "owner" ? [...PERMS] : (roles[r] ?? ROLE_DEFAULTS[r]!),
      })),
      members: await Promise.all(
        rows.map(async (u) => ({
          _id: u._id,
          name: u.name ?? u.email ?? "Staff",
          email: u.email ?? "",
          role: u.staffRole!,
          custom: !!overrides[u._id],
          permissions: await staffPermissions(ctx, u),
        })),
      ),
    };
  },
});

export const setStaffRole = mutation({
  args: {
    userId: v.id("users"),
    role: v.union(v.literal("owner"), v.literal("admin"), v.literal("support"), v.literal("none")),
  },
  returns: v.null(),
  handler: async (ctx, { userId, role }) => {
    const staff = await requireStaff(ctx, "team");
    const target = await ctx.db.get(userId);
    if (!target) throw new Error("That account no longer exists.");
    if (target._id === staff._id) throw new Error("You cannot change your own role.");

    await ctx.db.patch(userId, { staffRole: role === "none" ? undefined : role });
    await writeAudit(
      ctx,
      staff,
      role === "none" ? "Removed admin access" : `Gave the ${role} role`,
      target.email ?? target.name,
    );
    return null;
  },
});

/**
 * A per-person permission snapshots the role grant at the first change. Once
 * somebody is customised, later changes to their role no longer reach them —
 * the team screen says so next to their name.
 */
export const setStaffPermission = mutation({
  args: { userId: v.id("users"), permission: v.string(), on: v.boolean() },
  returns: v.null(),
  handler: async (ctx, { userId, permission, on }) => {
    const staff = await requireStaff(ctx, "team");
    const target = await ctx.db.get(userId);
    if (!target?.staffRole) throw new Error("That person is not on the team.");
    if (target.staffRole === "owner") {
      throw new Error("Owners hold every permission. Move them to Admin to change this.");
    }

    const overrides = (await platformValue<Record<string, string[]>>(ctx, "staffPerms")) ?? {};
    const held = overrides[userId] ?? (await staffPermissions(ctx, target));
    const next = on ? [...new Set([...held, permission])] : held.filter((p) => p !== permission);

    await setPlatformValue(ctx, "staffPerms", { ...overrides, [userId]: next });
    await writeAudit(
      ctx,
      staff,
      `${on ? "Gave" : "Took away"} “${PERM_LABELS[permission]?.label ?? permission}”`,
      target.email ?? target.name,
    );
    return null;
  },
});

/** Putting somebody back on their role's permissions drops their override. */
export const clearStaffOverride = mutation({
  args: { userId: v.id("users") },
  returns: v.null(),
  handler: async (ctx, { userId }) => {
    const staff = await requireStaff(ctx, "team");
    const overrides = (await platformValue<Record<string, string[]>>(ctx, "staffPerms")) ?? {};
    delete overrides[userId];
    await setPlatformValue(ctx, "staffPerms", overrides);
    const target = await ctx.db.get(userId);
    await writeAudit(
      ctx,
      staff,
      "Put somebody back on their role's permissions",
      target?.email ?? target?.name,
    );
    return null;
  },
});

export const setRolePermission = mutation({
  args: {
    role: v.union(v.literal("admin"), v.literal("support")),
    permission: v.string(),
    on: v.boolean(),
  },
  returns: v.null(),
  handler: async (ctx, { role, permission, on }) => {
    const staff = await requireStaff(ctx, "team");
    const roles = (await platformValue<Record<string, string[]>>(ctx, "rolePerms")) ?? {};
    const held = roles[role] ?? ROLE_DEFAULTS[role]!;
    const next = on ? [...new Set([...held, permission])] : held.filter((p) => p !== permission);
    await setPlatformValue(ctx, "rolePerms", { ...roles, [role]: next });
    await writeAudit(
      ctx,
      staff,
      `${on ? "Gave" : "Took away"} “${PERM_LABELS[permission]?.label ?? permission}” for ${role}s`,
      undefined,
      "Anyone with their own permissions is unaffected.",
    );
    return null;
  },
});

/* ------------------------------------------------------------------ */
/* Feature flags and the audit log                                     */
/* ------------------------------------------------------------------ */

export const flags = query({
  args: {},
  handler: async (ctx) => {
    await requireStaff(ctx, "flags");
    return (await ctx.db.query("featureFlags").collect()).sort((a, b) =>
      a.label.localeCompare(b.label),
    );
  },
});

export const saveFlag = mutation({
  args: {
    flagId: v.optional(v.id("featureFlags")),
    key: v.string(),
    label: v.string(),
    description: v.string(),
    enabled: v.boolean(),
    rollout: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, { flagId, ...fields }) => {
    const staff = await requireStaff(ctx, "flags");
    if (flagId) await ctx.db.patch(flagId, fields);
    else await ctx.db.insert("featureFlags", fields);
    await writeAudit(
      ctx,
      staff,
      `${fields.enabled ? "Turned on" : "Turned off"} the flag ${fields.key}`,
      undefined,
      `${fields.rollout}% of accounts`,
    );
    return null;
  },
});

export const audit = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit = 120 }) => {
    await requireStaff(ctx);
    return await ctx.db.query("auditLog").withIndex("by_at").order("desc").take(limit);
  },
});

/**
 * Support view: staff open a customer's dashboard read-only. The flag lives on
 * the request, and every mutation re-checks it, so nothing can be changed from
 * inside somebody else's account.
 */
export const supportView = query({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    await requireStaff(ctx, "users.view");
    const target = await ctx.db.get(userId);
    if (!target) return null;
    const forms = await ctx.db
      .query("forms")
      .withIndex("by_owner", (q) => q.eq("ownerId", userId))
      .collect();

    return {
      who: target.name ?? target.email ?? "this account",
      email: target.email ?? "",
      forms: forms
        .filter((f) => !f.deletedAt)
        .map((f) => ({
          _id: f._id,
          title: f.title,
          status: f.status,
          responses: f.responsesCount,
          updatedAt: f.updatedAt,
        }))
        .sort((a, b) => b.updatedAt - a.updatedAt),
    };
  },
});

export type AdminUser = Awaited<ReturnType<typeof describeUser>>;
export type AdminUserId = Id<"users">;
