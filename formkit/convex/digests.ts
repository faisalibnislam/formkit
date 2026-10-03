import { v } from "convex/values";
import { internalAction, internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { notifyDefaults, send } from "./notifications";
import { renderDigest } from "./emails/response";

/**
 * Settings → Notifications: the daily summary at 8am, and the weekly report
 * on Monday at 8am, both in the person's own time zone. A form can opt in or
 * out of each on its own; otherwise the account's choice stands. Nobody is
 * sent an email that would only say nothing happened.
 */

const SITE = process.env.SITE_URL ?? "https://formkit.app";
const DAY = 24 * 60 * 60 * 1000;
const HOUR_TO_SEND = 8;

function localParts(at: number, zone: string) {
  try {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: zone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      hourCycle: "h23",
      weekday: "short",
    }).formatToParts(at);
    const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
    return { date: `${get("year")}-${get("month")}-${get("day")}`, hour: Number(get("hour")), weekday: get("weekday") };
  } catch {
    return localParts(at, "UTC");
  }
}

/** People read for one page of a time zone's digests. */
const DUE_PAGE = 200;
/** Time zones looked at per read. */
const ZONES_PAGE = 100;

/**
 * The next time zones people have set, in order, after `after` (null: from
 * the start). Read through the time zone index one zone at a time, so a run
 * reads one row per zone rather than every account. Accounts with no zone
 * set are sent at 8am UTC and are not listed here.
 */
export const zones = internalQuery({
  args: { after: v.union(v.string(), v.null()) },
  handler: async (ctx, { after }) => {
    const out: string[] = [];
    let from = after;
    while (out.length < ZONES_PAGE) {
      const next = await ctx.db
        .query("users")
        .withIndex("by_timezone", (q) => (from === null ? q.gte("timezone", "") : q.gt("timezone", from)))
        .first();
      if (!next || next.timezone === undefined) return { zones: out, done: true };
      out.push(next.timezone);
      from = next.timezone;
    }
    return { zones: out, done: false };
  },
});

/** One page of the people in a time zone (null: those who never set one). */
export const inZone = internalQuery({
  args: { zone: v.union(v.string(), v.null()), cursor: v.union(v.string(), v.null()) },
  handler: async (ctx, { zone, cursor }) => {
    const page = await ctx.db
      .query("users")
      .withIndex("by_timezone", (q) => q.eq("timezone", zone ?? undefined))
      .paginate({ numItems: DUE_PAGE, cursor });
    return {
      ids: page.page.filter((u) => u.email && !u.deactivatedAt).map((u) => u._id),
      cursor: page.continueCursor,
      done: page.isDone,
    };
  },
});

type Content = {
  to: string[];
  subject: string;
  heading: string;
  lede: string;
  rows: { form: string; line: string; count: number }[];
} | null;

export const content = internalQuery({
  args: { userId: v.id("users"), kind: v.union(v.literal("daily"), v.literal("weekly")), date: v.string(), now: v.number() },
  handler: async (ctx, { userId, kind, date, now }): Promise<Content> => {
    const user = await ctx.db.get(userId);
    if (!user?.email) return null;
    if ((kind === "daily" ? user.lastDaily : user.lastWeekly) === date) return null;
    const from = now - (kind === "daily" ? 1 : 7) * DAY;
    const forms = (
      await ctx.db
        .query("forms")
        .withIndex("by_owner", (q) => q.eq("ownerId", userId))
        .collect()
    ).filter((f) => !f.deletedAt && notifyDefaults(f.notify, user.email!, user.emailPrefs)[kind]);
    if (!forms.length) return null;

    const rows: { form: string; line: string; count: number }[] = [];
    let total = 0;
    for (const f of forms) {
      const responses = await ctx.db
        .query("responses")
        .withIndex("by_form_preview_submitted", (q) =>
          q.eq("formId", f._id).eq("preview", undefined).gte("submittedAt", from).lt("submittedAt", now),
        )
        .collect();
      if (!responses.length) continue;
      total += responses.length;
      const completed = responses.filter((r) => !r.partial).length;
      const partial = responses.length - completed;
      let line = `${completed} completed${partial ? ` · ${partial} partial` : ""}`;
      if (kind === "weekly") {
        const starts = (
          await ctx.db
            .query("formEvents")
            .withIndex("by_form_at", (q) => q.eq("formId", f._id).gte("at", from).lt("at", now))
            .collect()
        ).filter((e) => e.kind === "start").length;
        const base = starts || responses.length;
        line += ` · ${Math.round((completed / base) * 100)}% completion`;
        // Where the partials stopped, if one question stands out.
        const blocks = (
          await ctx.db
            .query("blocks")
            .withIndex("by_form_order", (q) => q.eq("formId", f._id))
            .collect()
        )
          .filter((b) => b.kind === "field" && b.type !== "hidden")
          .sort((a, b) => a.order - b.order);
        const left = new Map<string, number>();
        for (const r of responses.filter((r) => r.partial)) {
          const answered = new Set(r.answers.filter((a) => a.value || a.values?.length || a.fileId).map((a) => a.blockId as string));
          let last = -1;
          blocks.forEach((b, i) => {
            if (answered.has(b._id)) last = i;
          });
          const at = blocks[Math.min(last + 1, blocks.length - 1)];
          if (at) left.set(at._id, (left.get(at._id) ?? 0) + 1);
        }
        const worst = [...left.entries()].sort((a, b) => b[1] - a[1])[0];
        const q = worst && blocks.find((b) => b._id === worst[0]);
        if (q && worst[1] >= 2) {
          line += ` · most who left stopped at “${q.title ?? "a question"}”`;
        }
      }
      rows.push({ form: f.title, line, count: responses.length });
    }
    if (!total) return null;
    const settings = notifyDefaults(undefined, user.email, user.emailPrefs);
    const to = settings.to.split(/[,\s]+/).filter((a) => a.includes("@"));
    return {
      to: to.length ? to : [user.email],
      subject:
        kind === "daily"
          ? `Yesterday on Formkit: ${total} ${total === 1 ? "response" : "responses"}`
          : `Your week on Formkit: ${total} ${total === 1 ? "response" : "responses"}`,
      heading: kind === "daily" ? "Yesterday’s responses" : "Your weekly report",
      lede:
        kind === "daily"
          ? `${total} ${total === 1 ? "response" : "responses"} came in over the last day.`
          : `${total} ${total === 1 ? "response" : "responses"} over the last seven days, form by form.`,
      rows,
    };
  },
});

export const mark = internalMutation({
  args: { userId: v.id("users"), kind: v.union(v.literal("daily"), v.literal("weekly")), date: v.string() },
  returns: v.null(),
  handler: async (ctx, { userId, kind, date }) => {
    await ctx.db.patch(userId, kind === "daily" ? { lastDaily: date } : { lastWeekly: date });
    return null;
  },
});

type Job = { userId: Id<"users">; kind: "daily" | "weekly"; date: string };

/**
 * Hourly: finds whoever it is 8am for, a time zone at a time, and hands each
 * of them to `sendOne`, so one slow send never holds up the rest.
 */
export const run = internalAction({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    const now = Date.now();
    const zones: (string | null)[] = [null];
    let after: string | null = null;
    for (;;) {
      const p: { zones: string[]; done: boolean } = await ctx.runQuery(internal.digests.zones, { after });
      zones.push(...p.zones);
      if (p.done || !p.zones.length) break;
      after = p.zones[p.zones.length - 1]!;
    }
    let queued = 0;
    for (const zone of zones) {
      const local = localParts(now, zone ?? "UTC");
      if (local.hour !== HOUR_TO_SEND) continue;
      let cursor: string | null = null;
      for (;;) {
        const p: { ids: Id<"users">[]; cursor: string; done: boolean } = await ctx.runQuery(internal.digests.inZone, {
          zone,
          cursor,
        });
        for (const userId of p.ids) {
          const jobs: Job[] = [{ userId, kind: "daily", date: local.date }];
          if (local.weekday === "Mon") jobs.push({ userId, kind: "weekly", date: local.date });
          for (const job of jobs) await ctx.scheduler.runAfter(0, internal.digests.sendOne, { ...job, now });
          queued += jobs.length;
        }
        if (p.done) break;
        cursor = p.cursor;
      }
    }
    return queued;
  },
});

/** One person's daily summary or weekly report, if there is anything to say. */
export const sendOne = internalAction({
  args: { userId: v.id("users"), kind: v.union(v.literal("daily"), v.literal("weekly")), date: v.string(), now: v.number() },
  returns: v.null(),
  handler: async (ctx, { now, ...job }) => {
    const c: Content = await ctx.runQuery(internal.digests.content, { ...job, now });
    // Marked even when there was nothing to say, so the hour is not retried.
    await ctx.runMutation(internal.digests.mark, job);
    if (!c) return null;
    const result = await send({
      to: c.to,
      subject: c.subject,
      html: renderDigest({ heading: c.heading, lede: c.lede, rows: c.rows, link: `${SITE}/app/responses` }),
    });
    await ctx.runMutation(internal.notifications.record, {
      userId: job.userId,
      kind: job.kind === "daily" ? "daily summary" : "weekly report",
      to: c.to.join(", "),
      subject: c.subject,
      ...result,
    });
    return null;
  },
});
