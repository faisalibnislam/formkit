import { v } from "convex/values";
import { PLANS, compOf, planOf } from "./model/plans";
import { aiStatus, period as aiPeriodNow } from "./model/aiMeter";
import { personalSpace } from "./model/spaces";
import { modelConfigured } from "./model/gemini";
import { notify } from "./model/inbox";
import { FLAGS, isFlagKey } from "./model/flags";
import { mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { lastDays } from "./adminTally";
import { scanPage } from "./model/scan";
import type { Doc, Id } from "./_generated/dataModel";
import {
  PERMS,
  ROLE_DEFAULTS,
  aiAllowed,
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
 * console is unlinked from the product - `who()` is what decides whether
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
    detail: "Turn Ask Formkit off for one person, set their limit and grant extra credits.",
  },
  moderation: { label: "Moderate forms", detail: "Lock a reported form or dismiss the report." },
  support: { label: "Reply to support", detail: "Answer tickets as Formkit and close them." },
  announcements: {
    label: "Publish announcements",
    detail: "Push a message to every customer dashboard.",
  },
  flags: { label: "Change feature flags", detail: "Turn platform features on and off." },
  billing: {
    label: "Manage billing",
    detail: "Set up Polar, see who is paying, and give an account a plan free of charge.",
  },
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
  args: { range: v.optional(v.union(v.literal(30), v.literal(90))) },
  handler: async (ctx, { range = 30 }) => {
    await requireStaff(ctx);
    // Platform totals come from the last tally (adminTally.ts); what staff
    // act on straight away - reports, tickets, the AI switch - is read live.
    const snap = await ctx.db
      .query("adminSnapshot")
      .withIndex("by_key", (q) => q.eq("key", "overview"))
      .unique();
    const keys = lastDays(range);
    const days = new Map(
      (
        await ctx.db
          .query("adminDays")
          .withIndex("by_day", (q) => q.gte("day", keys[0]!))
          .collect()
      ).map((d) => [d.day, d]),
    );
    const week = keys.slice(-7);
    const signups = keys.map((k) => snap?.signups[k] ?? 0);
    const sum = (ks: string[], pick: (d: Doc<"adminDays">) => number) =>
      ks.reduce((n, k) => n + (days.get(k) ? pick(days.get(k)!) : 0), 0);
    const open = async (table: "moderation" | "tickets") =>
      (
        await ctx.db
          .query(table)
          .withIndex("by_state", (q) => q.eq("state", "open"))
          .take(OPEN_CAP)
      ).length;

    return {
      range,
      /** When the totals were counted; null until the first count has run. */
      asOf: snap?.at ?? null,
      users: snap?.users ?? 0,
      newUsers: week.reduce((n, k) => n + (snap?.signups[k] ?? 0), 0),
      newInRange: signups.reduce((a, b) => a + b, 0),
      deactivated: snap?.deactivated ?? 0,
      staff: snap?.staff ?? 0,
      standing: snap?.standing ?? { active: 0, suspended: 0, deleting: 0 },
      signups,
      forms: snap?.forms ?? 0,
      live: snap?.live ?? 0,
      responses: snap?.responses ?? 0,
      responsesWeek: sum(week, (d) => d.responses),
      responsesInRange: sum(keys, (d) => d.responses),
      aiFormsBuilt: sum(keys, (d) => d.aiForms),
      aiAllowed: snap?.aiAllowed ?? 0,
      aiUsed: snap?.aiUsed ?? 0,
      aiCapacity: snap?.aiCapacity ?? 0,
      aiOutOfCredits: snap?.aiOutOfCredits ?? 0,
      aiPaused: (await platformValue<boolean>(ctx, "aiPaused")) ?? false,
      aiDefault: (await platformValue<number>(ctx, "aiDefault")) ?? 5,
      aiDefaultPrevious: await platformValue<number>(ctx, "aiDefaultPrevious"),
      /** Whether the deployment has a model key; never the key itself. */
      aiModelReady: modelConfigured(),
      openReports: await open("moderation"),
      openTickets: await open("tickets"),
    };
  },
});

/** Reports and tickets waiting, counted and listed up to this. */
const OPEN_CAP = 500;
/** Reports, tickets and announcements already dealt with, listed up to this many, newest first. */
const HISTORY = 200;
/** Refresh waits this long after the last count before counting again. */
const REFRESH_EVERY_MS = 60_000;

/** Count the overview's numbers and the reports again now, rather than at the next hourly run. */
export const refreshOverview = mutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    await requireStaff(ctx);
    const job = await ctx.db
      .query("jobs")
      .withIndex("by_key", (q) => q.eq("key", "adminTally"))
      .unique();
    if (job && Date.now() - job.at < REFRESH_EVERY_MS) return null;
    if (job) await ctx.db.patch(job._id, { at: Date.now() });
    else await ctx.db.insert("jobs", { key: "adminTally", cursor: null, done: false, at: Date.now() });
    await ctx.scheduler.runAfter(0, internal.adminTally.run, {});
    await ctx.scheduler.runAfter(0, internal.adminReports.run, {});
    return null;
  },
});

/** An account's monthly builds on their own company without a read per account. */
function localAiLimit(
  u: Doc<"users">,
  row: { limitOverride?: number; granted?: number } | undefined,
  freeDefault: number,
) {
  const plan = planOf(u);
  const allowance = plan === "free" ? freeDefault : PLANS[plan].ai.builds;
  return (row?.limitOverride ?? allowance) + (row?.granted ?? 0);
}

/* ------------------------------------------------------------------ */
/* Users                                                               */
/* ------------------------------------------------------------------ */

/** Forms counted per person, at most; past it the count says "+". */
const FORMS_COUNTED = 2000;

async function describeUser(ctx: Parameters<typeof aiStatus>[0], u: Doc<"users">) {
  const forms = await ctx.db
    .query("forms")
    .withIndex("by_owner", (q) => q.eq("ownerId", u._id))
    .take(FORMS_COUNTED);
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
    /** More forms than were counted. */
    formsMore: forms.length === FORMS_COUNTED,
    ai: {
      allowed: await aiAllowed(ctx, u._id),
      ...(await (async () => {
        const s = await aiStatus(ctx, personalSpace(u._id));
        return { limit: s.pool.builds, used: s.used.builds };
      })()),
    },
    plan: {
      id: planOf(u),
      comp: compOf(u),
      billed: u.plan && u.plan !== "free" ? u.plan : null,
      status: u.planStatus ?? null,
      interval: u.planInterval ?? null,
      endsAt: u.planEndsAt ?? null,
    },
  };
}

/** People on one page of Admin → Users. */
const USERS_PAGE = 20;
/** Accounts read for one page at most; past it the pager carries on from there. */
const USERS_SCAN = 2000;
/** A short list (suspended, staff, AI turned off, a search) is read whole up to this. */
const USERS_SET = 2000;
/** Matches a search gathers from each place it looks. */
const SEARCH_EACH = 100;

/**
 * One page of people, filtered, newest first. Everyone is read a stretch at a
 * time through the sign-up order; the short lists (suspended, staff, AI
 * turned off, a search) through their own index. The total is known for
 * everybody (from the hourly count) and for the short lists.
 */
export const usersPage = query({
  args: {
    search: v.optional(v.string()),
    status: v.optional(v.union(v.literal("all"), v.literal("active"), v.literal("suspended"), v.literal("staff"))),
    ai: v.optional(v.union(v.literal("all"), v.literal("on"), v.literal("off"))),
    plan: v.optional(
      v.union(v.literal("all"), v.literal("free"), v.literal("pro"), v.literal("business"), v.literal("paying"), v.literal("comped")),
    ),
    cursor: v.optional(v.union(v.string(), v.null())),
  },
  handler: async (ctx, { search, status = "all", ai = "all", plan = "all", cursor = null }) => {
    await requireStaff(ctx, "users.view");
    const term = search?.trim().toLowerCase();
    // Ask Formkit is on unless staff turned it off for someone.
    const aiOff = async (u: Doc<"users">) =>
      (
        await ctx.db
          .query("aiAccess")
          .withIndex("by_user", (q) => q.eq("userId", u._id))
          .unique()
      )?.enabled === false;
    const keep = async (u: Doc<"users">) => {
      if (status === "active" && (u.deactivatedAt || u.staffRole)) return null;
      if (status === "suspended" && !u.deactivatedAt) return null;
      if (status === "staff" && !u.staffRole) return null;
      if (plan === "comped" && !compOf(u)) return null;
      if (plan === "paying" && (planOf(u) === "free" || compOf(u))) return null;
      if ((plan === "free" || plan === "pro" || plan === "business") && planOf(u) !== plan) return null;
      if (ai !== "all" && (await aiOff(u)) !== (ai === "off")) return null;
      return u;
    };

    // The short lists, read whole and paged here.
    let set: Doc<"users">[] | null = null;
    let capped = false;
    if (term) {
      const raw = search!.trim();
      const upTo = `${term}\uffff`;
      const found = new Map<string, Doc<"users">>();
      const lists = [
        await ctx.db
          .query("users")
          .withSearchIndex("search_name", (q) => q.search("name", raw))
          .take(SEARCH_EACH),
        await ctx.db
          .query("users")
          .withIndex("email", (q) => q.gte("email", term).lt("email", upTo))
          .take(SEARCH_EACH),
        await ctx.db
          .query("users")
          .withIndex("by_handle", (q) => q.gte("handle", term).lt("handle", upTo))
          .take(SEARCH_EACH),
      ];
      capped = lists.some((l) => l.length === SEARCH_EACH);
      for (const u of lists.flat()) found.set(u._id, u);
      set = [...found.values()];
      const id = ctx.db.normalizeId("users", raw);
      const exact = id ? await ctx.db.get(id) : null;
      if (exact && !found.has(exact._id)) set.push(exact);
    } else if (status === "suspended") {
      set = await ctx.db
        .query("users")
        .withIndex("by_deactivated", (q) => q.gt("deactivatedAt", 0))
        .take(USERS_SET);
      capped = set.length === USERS_SET;
    } else if (status === "staff") {
      set = (
        await ctx.db
          .query("users")
          .withIndex("by_staff", (q) => q.gt("staffRole", undefined))
          .take(USERS_SET)
      ).filter((u) => u.staffRole);
      capped = set.length === USERS_SET;
    } else if (ai === "off") {
      const rows = await ctx.db.query("aiAccess").take(USERS_SET);
      capped = rows.length === USERS_SET;
      const off = rows.filter((a) => a.enabled === false);
      set = (await Promise.all(off.map((a) => ctx.db.get(a.userId)))).filter((u): u is Doc<"users"> => !!u);
    }

    let rows: Doc<"users">[];
    let next: string | null;
    let total: number | null = null;
    if (set) {
      const matched: Doc<"users">[] = [];
      for (const u of set) if (await keep(u)) matched.push(u);
      matched.sort((a, b) => b._creationTime - a._creationTime);
      const at = cursor ? Number(cursor) : 0;
      rows = matched.slice(at, at + USERS_PAGE);
      next = at + USERS_PAGE < matched.length ? String(at + USERS_PAGE) : null;
      total = capped ? null : matched.length;
    } else {
      const before = cursor ? Number(cursor) : null;
      const page = await scanPage(
        ctx.db
          .query("users")
          .withIndex("by_creation_time", (q) => (before === null ? q : q.lt("_creationTime", before)))
          .order("desc"),
        keep,
        (u) => String(u._creationTime),
        USERS_PAGE,
        USERS_SCAN,
      );
      rows = page.rows;
      next = page.next;
      if (status === "all" && ai === "all" && plan === "all") {
        const snap = await ctx.db
          .query("adminSnapshot")
          .withIndex("by_key", (q) => q.eq("key", "overview"))
          .unique();
        total = snap?.users ?? null;
      }
    }
    return {
      total,
      next,
      pageSize: USERS_PAGE,
      rows: await Promise.all(rows.map((u) => describeUser(ctx, u))),
    };
  },
});

/** One person, for the side panel - whether or not they are on the current page. */
export const user = query({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    await requireStaff(ctx, "users.view");
    const u = await ctx.db.get(userId);
    return u ? describeUser(ctx, u) : null;
  },
});

/** A note from Formkit, into one person's bell. */
export const messageUser = mutation({
  args: { userId: v.id("users"), title: v.string(), body: v.string() },
  returns: v.null(),
  handler: async (ctx, { userId, title, body }) => {
    const staff = await requireStaff(ctx, "support");
    const target = await ctx.db.get(userId);
    if (!target) throw new Error("That account no longer exists.");
    const t = title.trim().slice(0, 120);
    const b = body.trim().slice(0, 1200);
    if (!t || !b) throw new Error("Write a subject and a message.");
    await notify(ctx, userId, { kind: "support", title: t, body: b, icon: "life-buoy" });
    await writeAudit(ctx, staff, "Messaged somebody", target.email ?? target.name, t);
    return null;
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

    await ctx.db.patch(
      userId,
      // Reactivating from the console also ends a pending self-deletion.
      deactivated ? { deactivatedAt: Date.now() } : { deactivatedAt: undefined, selfDeletedAt: undefined },
    );
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
    /** Drop their own limit, so the platform default applies again. */
    useDefault: v.optional(v.boolean()),
  },
  returns: v.null(),
  handler: async (ctx, { userId, enabled, limitOverride, grant, resetUsage, useDefault }) => {
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
      limitOverride: useDefault ? undefined : (limitOverride ?? row?.limitOverride),
      granted: (row?.granted ?? 0) + (grant ?? 0),
      changedBy: staff._id,
      changedAt: Date.now(),
    };
    if (row) await ctx.db.patch(row._id, next);
    else await ctx.db.insert("aiAccess", next);
    // Only a grant is announced. Taking access away is silent: an account
    // without it sees no mention of the AI anywhere.
    if (enabled === true && !row?.enabled) {
      await notify(ctx, userId, {
        kind: "ai",
        title: "Ask Formkit is on for your account",
        body: "Describe a form in a sentence and Formkit writes it.",
        href: "/app/ask",
        action: "Open Ask Formkit",
        icon: "sparkles",
      });
    } else if (grant && (row?.enabled ?? false)) {
      await notify(ctx, userId, {
        kind: "ai",
        title: `${grant} more AI form builds`,
        body: "Formkit added them to this month.",
        href: "/app/ask",
        action: "Open Ask Formkit",
        icon: "sparkles",
      });
    }

    if (resetUsage) {
      const row = await ctx.db
        .query("aiAllowance")
        .withIndex("by_space_period", (q) => q.eq("space", `me:${userId}`).eq("period", aiPeriodNow()))
        .unique();
      if (row) await ctx.db.patch(row._id, { builds: 0 });
    }

    const what =
      enabled === true
        ? "Turned on Ask Formkit"
        : enabled === false
          ? "Turned off Ask Formkit"
          : grant
            ? `Granted ${grant} extra credits`
            : resetUsage
              ? "Reset this month's AI usage"
              : useDefault
                ? "Put somebody back on the default AI limit"
                : `Set somebody's AI limit to ${limitOverride}`;
    await writeAudit(ctx, staff, what, target.email ?? target.name);
    return null;
  },
});

/** The platform pause suspends everyone at once, without forgetting who was allowed. */
export const setAiPlatform = mutation({
  args: {
    paused: v.optional(v.boolean()),
    defaultLimit: v.optional(v.number()),
    /** Also drop every personal limit, so the new default reaches everyone. */
    applyToAll: v.optional(v.boolean()),
    /** Go back to the default before the last change. */
    revert: v.optional(v.boolean()),
  },
  returns: v.null(),
  handler: async (ctx, { paused, defaultLimit, applyToAll, revert }) => {
    const staff = await requireStaff(ctx, "ai.access");
    if (paused !== undefined) {
      await setPlatformValue(ctx, "aiPaused", paused);
      await writeAudit(ctx, staff, paused ? "Paused Ask Formkit everywhere" : "Resumed Ask Formkit");
    }
    const current = (await platformValue<number>(ctx, "aiDefault")) ?? 5;
    const next = revert ? await platformValue<number>(ctx, "aiDefaultPrevious") : defaultLimit;
    if (next !== undefined && next !== null && next !== current) {
      const limit = Math.max(0, Math.min(1000, Math.round(next)));
      await setPlatformValue(ctx, "aiDefaultPrevious", current);
      await setPlatformValue(ctx, "aiDefault", limit);
      await writeAudit(ctx, staff, `${revert ? "Reverted" : "Set"} the AI default to ${limit} a month`, undefined, `Was ${current}`);
    }
    if (applyToAll) {
      const rows = (await ctx.db.query("aiAccess").collect()).filter((r) => r.limitOverride !== undefined);
      for (const r of rows) await ctx.db.patch(r._id, { limitOverride: undefined, changedBy: staff._id, changedAt: Date.now() });
      await writeAudit(ctx, staff, "Applied the AI default to everyone", undefined, `${rows.length} personal limits cleared`);
    }
    return null;
  },
});

/** Accounts read for each part of Admin → AI access, at most. */
const AI_SET = 2000;

/**
 * Who has Ask Formkit, how much they use, and who is on a limit of their own.
 * "on": everyone who has used Ask Formkit this month. "off": accounts staff
 * turned it off for. "all": both, plus anyone with a personal limit or grant.
 */
export const aiStats = query({
  args: { search: v.optional(v.string()), show: v.optional(v.union(v.literal("on"), v.literal("off"), v.literal("all"))) },
  handler: async (ctx, { search, show = "on" }) => {
    await requireStaff(ctx, "ai.access");
    // Only the accounts that can show up are read: who built forms with AI
    // this month, and who staff turned off or gave a different allowance.
    const builders = await ctx.db
      .query("aiAllowance")
      .withIndex("by_period_builds", (q) => q.eq("period", aiPeriodNow()).gt("builds", 0))
      .order("desc")
      .take(AI_SET);
    const spentBy = new Map(
      builders.filter((r) => r.space.startsWith("me:")).map((r) => [r.space.slice(3), r.builds]),
    );
    const access = show === "on" ? [] : await ctx.db.query("aiAccess").take(AI_SET);
    const byUser = new Map(access.map((a) => [a.userId as string, a]));
    const freeDefault = (await platformValue<number>(ctx, "aiDefault")) ?? PLANS.free.ai.builds;
    const term = search?.trim().toLowerCase();
    const ids = new Set<string>([...(show === "off" ? [] : spentBy.keys()), ...byUser.keys()]);
    const rows = [];
    for (const id of ids) {
      const userId = ctx.db.normalizeId("users", id);
      const u = userId ? await ctx.db.get(userId) : null;
      if (!u) continue;
      const row =
        byUser.get(id) ??
        (await ctx.db
          .query("aiAccess")
          .withIndex("by_user", (q) => q.eq("userId", u._id))
          .order("desc")
          .first()) ??
        undefined;
      const spent = spentBy.get(id) ?? 0;
      const enabled = row?.enabled !== false;
      const touched = !!row && (row.enabled === false || row.limitOverride !== undefined || (row.granted ?? 0) > 0);
      if (show === "on" && !(enabled && spent > 0)) continue;
      if (show === "off" && enabled) continue;
      if (show === "all" && !(spent > 0 || touched)) continue;
      if (term && !`${u.name ?? ""} ${u.email ?? ""}`.toLowerCase().includes(term)) continue;
      rows.push({
        _id: u._id,
        name: u.name ?? "",
        email: u.email ?? "",
        enabled,
        plan: planOf(u),
        limit: localAiLimit(u, row, freeDefault),
        override: row?.limitOverride ?? null,
        granted: row?.granted ?? 0,
        used: spent,
      });
    }
    rows.sort((a, b) => b.used - a.used || a.name.localeCompare(b.name));
    return {
      rows,
      overrides: rows.filter((r) => r.override !== null),
      heaviest: rows.filter((r) => r.used > 0).slice(0, 5),
    };
  },
});

/* ------------------------------------------------------------------ */
/* Moderation                                                          */
/* ------------------------------------------------------------------ */

export const reports = query({
  args: {},
  handler: async (ctx) => {
    await requireStaff(ctx, "moderation");
    // Every open report, and the latest of the ones dealt with.
    const open = await ctx.db
      .query("moderation")
      .withIndex("by_state", (q) => q.eq("state", "open"))
      .take(OPEN_CAP);
    const recent = await ctx.db.query("moderation").order("desc").take(HISTORY);
    const rows = [...new Map([...open, ...recent].map((r) => [r._id as string, r])).values()].sort(
      (a, b) => b.reportedAt - a.reportedAt,
    );
    return Promise.all(
      rows.map(async (r) => ({ ...r, ownerId: r.formId ? ((await ctx.db.get(r.formId))?.ownerId ?? null) : null })),
    );
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
    const form = report.formId ? await ctx.db.get(report.formId) : null;
    await ctx.db.patch(reportId, {
      state,
      ...(state === "locked" && form ? { statusBeforeLock: form.status } : {}),
    });

    // Unlocking puts the form back the way the lock found it.
    if (report.state === "locked" && state !== "locked" && form && form.status === "closed" && form.closing?.closedBy === "Formkit") {
      const back = report.statusBeforeLock === "published" ? "published" : report.statusBeforeLock === "draft" ? "draft" : "closed";
      // The lock's own closing note goes; any schedule the owner set stays.
      const { closedBy: _by, closedAt: _at, message: _msg, ...kept } = form.closing;
      void _by;
      void _at;
      void _msg;
      await ctx.db.patch(form._id, { status: back, closing: kept });
      await notify(ctx, form.ownerId, {
        kind: "locked",
        title: `Formkit reopened ${form.title}`,
        body: back === "published" ? "The review is done and it is collecting again." : "The review is done.",
        href: `/app/forms/${form._id}`,
        action: "Open the form",
        icon: "shield-check",
        formId: form._id,
      });
    }

    // Locking a form stops it collecting; it is not deleted, and its responses stay.
    if (state === "locked" && report.formId) {
      const locked = await ctx.db.get(report.formId);
      if (locked) {
        await notify(ctx, locked.ownerId, {
          kind: "locked",
          title: `Formkit closed ${locked.title}`,
          body: "It was reported, and it stays closed while Formkit reviews the report. Its responses are kept.",
          href: `/app/forms/${locked._id}`,
          action: "Open the form",
          icon: "shield-alert",
          formId: locked._id,
        });
      }
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
    // Open Business tickets first, then everything newest first.
    const rank = (t: { state: string; priority?: boolean }) => (t.state === "open" && t.priority ? 0 : 1);
    // Every open ticket, and the latest of the rest.
    const open = await ctx.db
      .query("tickets")
      .withIndex("by_state", (q) => q.eq("state", "open"))
      .take(OPEN_CAP);
    const recent = await ctx.db.query("tickets").order("desc").take(HISTORY);
    return [...new Map([...open, ...recent].map((t) => [t._id as string, t])).values()].sort(
      (a, b) => rank(a) - rank(b) || b.openedAt - a.openedAt,
    );
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
    if (ticket.userId) {
      await notify(ctx, ticket.userId, {
        kind: "support",
        title: `Formkit replied: ${ticket.subject}`,
        body: body.trim().length > 160 ? `${body.trim().slice(0, 157)}…` : body.trim(),
        icon: "life-buoy",
      });
    }
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
    return (await ctx.db.query("announcements").order("desc").take(HISTORY)).sort((a, b) => b.createdAt - a.createdAt);
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

/** Emails listed at most. */
const MAIL_CAP = 1000;

export const mail = query({
  args: { limit: v.optional(v.number()), userId: v.optional(v.id("users")), days: v.optional(v.number()) },
  handler: async (ctx, { limit = 100, userId, days = 30 }) => {
    await requireStaff(ctx);
    const since = Date.now() - days * 24 * 60 * 60 * 1000;
    // Newest first, and only as many as are shown.
    const rows = await (userId
      ? ctx.db.query("emailLog").withIndex("by_user_at", (q) => q.eq("userId", userId).gte("at", since))
      : ctx.db.query("emailLog").withIndex("by_at", (q) => q.gte("at", since))
    )
      .order("desc")
      .take(Math.max(1, Math.min(MAIL_CAP, Math.floor(limit))));
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
    const rows = (
      await ctx.db
        .query("users")
        .withIndex("by_staff", (q) => q.gt("staffRole", undefined))
        .collect()
    ).filter((u) => u.staffRole);
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

/** Bring an existing Formkit account onto the team by its email. */
export const inviteStaff = mutation({
  args: { email: v.string(), role: v.union(v.literal("admin"), v.literal("support")) },
  returns: v.null(),
  handler: async (ctx, { email, role }) => {
    const staff = await requireStaff(ctx, "team");
    const wanted = email.trim().toLowerCase();
    // Addresses are kept lower case (auth.ts); an older one may not be.
    const byEmail = (address: string) =>
      ctx.db
        .query("users")
        .withIndex("email", (q) => q.eq("email", address))
        .first();
    const target = (await byEmail(wanted)) ?? (await byEmail(email.trim()));
    if (!target) throw new Error("There is no Formkit account with that email. They need to sign up first.");
    if (target.staffRole) throw new Error(`They are already on the team as ${target.staffRole}.`);
    await ctx.db.patch(target._id, { staffRole: role });
    await notify(ctx, target._id, {
      kind: "support",
      title: "You have been added to the Formkit team",
      body: `As ${role === "admin" ? "an admin" : "support"}. The console is at formkit.app/admin.`,
      icon: "shield-check",
    });
    await writeAudit(ctx, staff, `Added somebody to the team as ${role}`, target.email ?? target.name);
    return null;
  },
});

/** The console records staff coming and going, like every other action. */
export const noteSession = mutation({
  args: { what: v.union(v.literal("in"), v.literal("out")) },
  returns: v.null(),
  handler: async (ctx, { what }) => {
    const staff = await requireStaff(ctx);
    await writeAudit(ctx, staff, what === "in" ? "Signed in to the console" : "Signed out of the console");
    return null;
  },
});

/**
 * A per-person permission snapshots the role grant at the first change. Once
 * somebody is customised, later changes to their role no longer reach them -
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

/**
 * The flags, as the console shows them: every flag the product reads, with
 * what it does, whether anyone has changed it, and its current setting.
 */
export const flags = query({
  args: {},
  handler: async (ctx) => {
    await requireStaff(ctx, "flags");
    const rows = await ctx.db.query("featureFlags").collect();
    return FLAGS.map((f) => {
      const row = rows.find((r) => r.key === f.key);
      return {
        key: f.key,
        label: f.label,
        description: f.description,
        enabled: row ? row.enabled : f.defaultOn,
        rollout: row ? row.rollout : 100,
        changed: Boolean(row),
      };
    });
  },
});

export const saveFlag = mutation({
  args: { key: v.string(), enabled: v.boolean(), rollout: v.number() },
  returns: v.null(),
  handler: async (ctx, { key, enabled, rollout }) => {
    const staff = await requireStaff(ctx, "flags");
    if (!isFlagKey(key)) throw new Error("There is no flag by that name.");
    const def = FLAGS.find((f) => f.key === key)!;
    const pct = Math.max(0, Math.min(100, Math.round(rollout)));
    const row = await ctx.db
      .query("featureFlags")
      .withIndex("by_key", (q) => q.eq("key", key))
      .unique();
    const fields = { key, label: def.label, description: def.description, enabled, rollout: pct };
    if (row) await ctx.db.patch(row._id, fields);
    else await ctx.db.insert("featureFlags", fields);
    await writeAudit(
      ctx,
      staff,
      `${enabled ? "Turned on" : "Turned off"} “${def.label}”`,
      undefined,
      enabled ? `${pct}% of accounts` : undefined,
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
