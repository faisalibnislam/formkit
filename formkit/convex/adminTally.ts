import { v } from "convex/values";
import { internalAction, internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import { PLANS, planOf } from "./model/plans";
import { period as aiPeriodNow } from "./model/aiMeter";
import { platformValue } from "./model/identity";

/**
 * The admin overview's numbers, worked out in pages.
 *
 * The overview used to read every user, form, response and activity line on
 * each load, which stops working once a table outgrows what one query may
 * read. Instead this walks the tables a page at a time, hourly or when staff
 * press Refresh, and keeps the totals in adminSnapshot. Responses and AI-built
 * forms are counted per day into adminDays; a day is counted again until two
 * days after it ends, then left alone, so an hourly run only reads the last
 * couple of days of responses.
 */

const DAY = 24 * 60 * 60 * 1000;
/** Days of history the overview offers (its widest range). */
const DAYS = 90;
const USERS_PAGE = 200;
const FORMS_PAGE = 500;
const ROWS_PAGE = 1000;
const AI_BUILT = "created the form with Ask Formkit";

/** "2026-10-03" for the UTC day `at` falls on. */
export function dayKey(at: number) {
  return new Date(at).toISOString().slice(0, 10);
}

/** The last `n` UTC days, oldest first, ending today. */
export function lastDays(n: number, now = Date.now()) {
  const today = Date.parse(dayKey(now));
  return Array.from({ length: n }, (_, i) => dayKey(today - (n - 1 - i) * DAY));
}

/** One page of users, summed: standing, sign-ups by day, and Ask Formkit use. */
export const usersPage = internalQuery({
  args: { cursor: v.union(v.string(), v.null()) },
  handler: async (ctx, { cursor }) => {
    const page = await ctx.db.query("users").paginate({ numItems: USERS_PAGE, cursor });
    const since = Date.parse(lastDays(DAYS)[0]!);
    const period = aiPeriodNow();
    const freeDefault = (await platformValue<number>(ctx, "aiDefault")) ?? PLANS.free.ai.builds;
    const t = {
      users: 0,
      staff: 0,
      deactivated: 0,
      active: 0,
      suspended: 0,
      deleting: 0,
      signups: {} as Record<string, number>,
      aiAllowed: 0,
      aiUsed: 0,
      aiCapacity: 0,
      aiOutOfCredits: 0,
    };
    for (const u of page.page) {
      t.users += 1;
      if (u.deactivatedAt) t.deactivated += 1;
      if (u.staffRole) {
        t.staff += 1;
        continue;
      }
      if (u.selfDeletedAt) t.deleting += 1;
      else if (u.deactivatedAt) t.suspended += 1;
      else t.active += 1;
      if (u._creationTime >= since) {
        const k = dayKey(u._creationTime);
        t.signups[k] = (t.signups[k] ?? 0) + 1;
      }
      // Ask Formkit: on for every customer unless turned off, builds by plan.
      const access = await ctx.db
        .query("aiAccess")
        .withIndex("by_user", (q) => q.eq("userId", u._id))
        .first();
      if (access?.enabled === false || u.deactivatedAt) continue;
      const plan = planOf(u);
      const limit =
        (access?.limitOverride ?? (plan === "free" ? freeDefault : PLANS[plan].ai.builds)) + (access?.granted ?? 0);
      const used =
        (
          await ctx.db
            .query("aiAllowance")
            .withIndex("by_space_period", (q) => q.eq("space", `me:${u._id}`).eq("period", period))
            .first()
        )?.builds ?? 0;
      t.aiAllowed += 1;
      t.aiCapacity += limit;
      t.aiUsed += used;
      if (used > 0 && used >= limit) t.aiOutOfCredits += 1;
    }
    return { ...t, cursor: page.continueCursor, done: page.isDone };
  },
});

/** One page of forms, summed: forms not in the bin, live ones, and their responses. */
export const formsPage = internalQuery({
  args: { cursor: v.union(v.string(), v.null()) },
  handler: async (ctx, { cursor }) => {
    const page = await ctx.db.query("forms").paginate({ numItems: FORMS_PAGE, cursor });
    let forms = 0;
    let live = 0;
    let responses = 0;
    for (const f of page.page) {
      responses += f.responsesCount;
      if (f.deletedAt) continue;
      forms += 1;
      if (f.status === "published") live += 1;
    }
    return { forms, live, responses, cursor: page.continueCursor, done: page.isDone };
  },
});

/** Responses (not previews) sent in [from, to), one page at a time. */
export const responsesInDay = internalQuery({
  args: { from: v.number(), to: v.number(), cursor: v.union(v.string(), v.null()) },
  handler: async (ctx, { from, to, cursor }) => {
    const page = await ctx.db
      .query("responses")
      .withIndex("by_preview_submitted", (q) => q.eq("preview", undefined).gte("submittedAt", from).lt("submittedAt", to))
      .paginate({ numItems: ROWS_PAGE, cursor });
    return { n: page.page.length, cursor: page.continueCursor, done: page.isDone };
  },
});

/** Forms built with Ask Formkit in [from, to), one page at a time. */
export const aiFormsInDay = internalQuery({
  args: { from: v.number(), to: v.number(), cursor: v.union(v.string(), v.null()) },
  handler: async (ctx, { from, to, cursor }) => {
    const page = await ctx.db
      .query("activity")
      .withIndex("by_at", (q) => q.gte("at", from).lt("at", to))
      .paginate({ numItems: ROWS_PAGE, cursor });
    return {
      n: page.page.filter((a) => a.what === AI_BUILT).length,
      cursor: page.continueCursor,
      done: page.isDone,
    };
  },
});

/** The days already counted for good. */
export const finalDays = internalQuery({
  args: { from: v.string() },
  handler: async (ctx, { from }) =>
    (
      await ctx.db
        .query("adminDays")
        .withIndex("by_day", (q) => q.gte("day", from))
        .collect()
    )
      .filter((d) => d.final)
      .map((d) => d.day),
});

const totals = v.object({
  users: v.number(),
  staff: v.number(),
  deactivated: v.number(),
  standing: v.object({ active: v.number(), suspended: v.number(), deleting: v.number() }),
  signups: v.record(v.string(), v.number()),
  forms: v.number(),
  live: v.number(),
  responses: v.number(),
  aiAllowed: v.number(),
  aiUsed: v.number(),
  aiCapacity: v.number(),
  aiOutOfCredits: v.number(),
});

export const save = internalMutation({
  args: {
    totals,
    days: v.array(v.object({ day: v.string(), responses: v.number(), aiForms: v.number(), final: v.boolean() })),
  },
  returns: v.null(),
  handler: async (ctx, { totals: t, days }) => {
    const row = { key: "overview", at: Date.now(), ...t };
    const existing = await ctx.db
      .query("adminSnapshot")
      .withIndex("by_key", (q) => q.eq("key", "overview"))
      .unique();
    if (existing) await ctx.db.replace(existing._id, row);
    else await ctx.db.insert("adminSnapshot", row);
    for (const d of days) {
      const had = await ctx.db
        .query("adminDays")
        .withIndex("by_day", (q) => q.eq("day", d.day))
        .unique();
      if (had) await ctx.db.replace(had._id, d);
      else await ctx.db.insert("adminDays", d);
    }
    // Days older than the widest range are never shown again.
    const old = await ctx.db
      .query("adminDays")
      .withIndex("by_day", (q) => q.lt("day", lastDays(DAYS)[0]!))
      .take(100);
    for (const d of old) await ctx.db.delete(d._id);
    return null;
  },
});

/** Counts everything the overview shows and stores it. Hourly, and on Refresh. */
export const run = internalAction({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const t = {
      users: 0,
      staff: 0,
      deactivated: 0,
      standing: { active: 0, suspended: 0, deleting: 0 },
      signups: {} as Record<string, number>,
      forms: 0,
      live: 0,
      responses: 0,
      aiAllowed: 0,
      aiUsed: 0,
      aiCapacity: 0,
      aiOutOfCredits: 0,
    };

    let cursor: string | null = null;
    for (;;) {
      const p: { cursor: string; done: boolean } & Omit<typeof t, "standing" | "forms" | "live" | "responses"> & {
        active: number;
        suspended: number;
        deleting: number;
      } = await ctx.runQuery(internal.adminTally.usersPage, { cursor });
      t.users += p.users;
      t.staff += p.staff;
      t.deactivated += p.deactivated;
      t.standing.active += p.active;
      t.standing.suspended += p.suspended;
      t.standing.deleting += p.deleting;
      for (const [k, n] of Object.entries(p.signups)) t.signups[k] = (t.signups[k] ?? 0) + n;
      t.aiAllowed += p.aiAllowed;
      t.aiUsed += p.aiUsed;
      t.aiCapacity += p.aiCapacity;
      t.aiOutOfCredits += p.aiOutOfCredits;
      if (p.done) break;
      cursor = p.cursor;
    }

    cursor = null;
    for (;;) {
      const p: { forms: number; live: number; responses: number; cursor: string; done: boolean } = await ctx.runQuery(
        internal.adminTally.formsPage,
        { cursor },
      );
      t.forms += p.forms;
      t.live += p.live;
      t.responses += p.responses;
      if (p.done) break;
      cursor = p.cursor;
    }

    const now = Date.now();
    const keys = lastDays(DAYS, now);
    const done = new Set<string>(await ctx.runQuery(internal.adminTally.finalDays, { from: keys[0]! }));
    const days: { day: string; responses: number; aiForms: number; final: boolean }[] = [];
    for (const day of keys) {
      if (done.has(day)) continue;
      const from = Date.parse(day);
      const to = from + DAY;
      const count = async (fn: typeof internal.adminTally.responsesInDay) => {
        let n = 0;
        let c: string | null = null;
        for (;;) {
          const p: { n: number; cursor: string; done: boolean } = await ctx.runQuery(fn, { from, to, cursor: c });
          n += p.n;
          if (p.done) return n;
          c = p.cursor;
        }
      };
      days.push({
        day,
        responses: await count(internal.adminTally.responsesInDay),
        aiForms: await count(internal.adminTally.aiFormsInDay),
        final: to < now - 2 * DAY,
      });
    }

    await ctx.runMutation(internal.adminTally.save, { totals: t, days });
    return null;
  },
});
