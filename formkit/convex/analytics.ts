import { v } from "convex/values";
import { query, type QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { requireUser } from "./model/identity";
import { completionRate, formFor } from "./model/forms";
import { hasFeature } from "./model/plans";

/**
 * Analytics, computed from what is actually stored.
 *
 * Nothing here is modelled or smoothed. Views and starts are the events the
 * published form records each time it is opened or begun, so they can be
 * counted inside any range and by where people came from; drop-off is counted
 * from the answers a response carries; and a form with no traffic says so
 * rather than drawing a curve. Answers sent from the builder's preview are
 * the owner testing, and count nowhere.
 */

const DAY = 24 * 60 * 60 * 1000;
const MAX_DAYS = 366;

type Window = { from: number; to: number };

async function eventsIn(
  ctx: QueryCtx,
  userId: Id<"users">,
  formId: Id<"forms"> | undefined,
  w: Window,
) {
  return formId
    ? ctx.db
        .query("formEvents")
        .withIndex("by_form_at", (q) => q.eq("formId", formId).gte("at", w.from).lt("at", w.to))
        .collect()
    : ctx.db
        .query("formEvents")
        .withIndex("by_owner_at", (q) => q.eq("ownerId", userId).gte("at", w.from).lt("at", w.to))
        .collect();
}

function median(values: number[]) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)]!;
}

function summarise(events: Doc<"formEvents">[], responses: Doc<"responses">[], ids: Set<string>) {
  const inScope = events.filter((e) => ids.has(e.formId));
  const views = inScope.filter((e) => e.kind === "view").length;
  const starts = inScope.filter((e) => e.kind === "start").length;
  const completed = responses.filter((r) => !r.partial).length;
  // Of everyone who began, how many sent it. Before starts were recorded, the
  // responses themselves are the only denominator there is.
  const base = starts || responses.length;
  const rate = base ? Math.round((completed / base) * 1000) / 10 : null;
  const seconds = median(
    responses.filter((r) => !r.partial && r.durationMs && r.durationMs > 0).map((r) => r.durationMs!),
  );
  return {
    views,
    starts,
    responses: responses.length,
    completed,
    partial: responses.length - completed,
    completionRate: rate,
    medianSeconds: seconds === null ? null : Math.round(seconds / 1000),
  };
}

export const overview = query({
  args: {
    formId: v.optional(v.id("forms")),
    /** Legacy: the last so many days, to now. */
    days: v.optional(v.number()),
    /** The first moment in range — the viewer's local midnight. */
    from: v.optional(v.number()),
    /** The end of the range, exclusive. */
    to: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const now = Date.now();
    const to = Math.min(args.to ?? now, now + DAY);
    const from = Math.max(args.from ?? to - (args.days ?? 30) * DAY, to - MAX_DAYS * DAY);
    const span = Math.max(DAY, to - from);
    const days = Math.round(span / DAY);
    const current: Window = { from, to };
    const previous: Window = { from: from - span, to: from };

    const forms = args.formId
      ? [await formFor(ctx, args.formId, "read")]
      : (
          await ctx.db
            .query("forms")
            .withIndex("by_owner", (q) => q.eq("ownerId", user._id))
            .collect()
        ).filter((f) => !f.deletedAt);
    const ids = new Set(forms.map((f) => f._id as string));
    // Sources, devices and drop-off are Pro — the form owner's plan for one
    // form, the viewer's own across all of theirs.
    const full = await hasFeature(ctx, args.formId ? forms[0]!.ownerId : user._id, "analytics.full");

    // Only the two windows being compared — never every response ever sent.
    const inWindows = (
      args.formId
        ? await ctx.db
            .query("responses")
            .withIndex("by_form_submitted", (q) =>
              q.eq("formId", args.formId!).gte("submittedAt", previous.from).lt("submittedAt", current.to),
            )
            .collect()
        : await ctx.db
            .query("responses")
            .withIndex("by_owner_submitted", (q) =>
              q.eq("ownerId", user._id).gte("submittedAt", previous.from).lt("submittedAt", current.to),
            )
            .collect()
    ).filter((r) => ids.has(r.formId) && !r.preview);

    const within = (w: Window) => inWindows.filter((r) => r.submittedAt >= w.from && r.submittedAt < w.to);
    const recent = within(current);
    const before = within(previous);
    const [eventsNow, eventsBefore] = await Promise.all([
      eventsIn(ctx, user._id, args.formId, current),
      eventsIn(ctx, user._id, args.formId, previous),
    ]);

    const now_ = summarise(eventsNow, recent, ids);
    const was = summarise(eventsBefore, before, ids);
    const pct = (a: number, b: number) => (b === 0 ? null : Math.round(((a - b) / b) * 1000) / 10);
    const change = {
      views: pct(now_.views, was.views),
      starts: pct(now_.starts, was.starts),
      completed: pct(now_.completed, was.completed),
      completionRate:
        now_.completionRate === null || was.completionRate === null
          ? null
          : Math.round((now_.completionRate - was.completionRate) * 10) / 10,
      medianSeconds:
        now_.medianSeconds === null || was.medianSeconds === null ? null : now_.medianSeconds - was.medianSeconds,
    };

    // One row per day, oldest first; the screen gathers them into bars. Each
    // event and response is dropped into its day once, not re-scanned per day.
    const daily = Array.from({ length: days }, (_, i) => ({
      at: from + i * DAY,
      views: 0,
      starts: 0,
      responses: 0,
      completed: 0,
    }));
    const dayOf = (t: number) => {
      const i = Math.floor((t - from) / DAY);
      return i >= 0 && i < days ? daily[i] : undefined;
    };
    for (const e of eventsNow) {
      if (!ids.has(e.formId)) continue;
      const d = dayOf(e.at);
      if (d && e.kind === "view") d.views++;
      else if (d && e.kind === "start") d.starts++;
    }
    for (const r of recent) {
      const d = dayOf(r.submittedAt);
      if (!d) continue;
      d.responses++;
      if (!r.partial) d.completed++;
    }

    /* Where people leave: for each question, the share of everyone who began
       that stopped on it — the first question after the last they answered. */
    const dropOff = args.formId && full
      ? await (async () => {
          const blocks = (
            await ctx.db
              .query("blocks")
              .withIndex("by_form_order", (q) => q.eq("formId", args.formId!))
              .collect()
          )
            .filter((b) => b.kind === "field" && b.type !== "hidden")
            .sort((a, b) => a.order - b.order);
          const began = Math.max(now_.starts, recent.length);
          const left = new Map<string, number>();
          // People who opened the form, began and never sent anything left on
          // the first question.
          const silent = Math.max(0, now_.starts - recent.length);
          if (blocks[0] && silent) left.set(blocks[0]._id, silent);
          for (const r of recent.filter((r) => r.partial)) {
            const answered = new Set(
              r.answers.filter((a) => a.value || a.values?.length || a.fileId).map((a) => a.blockId as string),
            );
            let last = -1;
            blocks.forEach((b, i) => {
              if (answered.has(b._id)) last = i;
            });
            const at = blocks[Math.min(last + 1, blocks.length - 1)];
            if (at) left.set(at._id, (left.get(at._id) ?? 0) + 1);
          }
          return blocks.map((b) => {
            const n = left.get(b._id) ?? 0;
            return {
              title: b.title ?? "Question",
              left: n,
              share: began ? Math.round((n / began) * 1000) / 10 : 0,
            };
          });
        })()
      : [];

    // Sources: views by where they came from, and how many of those finished.
    const bySource = new Map<string, { views: number; completed: number; responses: number }>();
    const bump = (name: string) => {
      const had = bySource.get(name) ?? { views: 0, completed: 0, responses: 0 };
      bySource.set(name, had);
      return had;
    };
    for (const e of eventsNow) if (ids.has(e.formId) && e.kind === "view") bump(e.source ?? "Direct link").views++;
    for (const r of recent) {
      const s = bump(r.source ?? "Direct link");
      s.responses++;
      if (!r.partial) s.completed++;
    }

    const byDevice = new Map<string, number>();
    for (const r of recent) {
      const d = (r.device ?? "Unknown").split(" · ")[0]!;
      byDevice.set(d, (byDevice.get(d) ?? 0) + 1);
    }

    const inRange = new Map<string, number>();
    for (const r of recent) inRange.set(r.formId, (inRange.get(r.formId) ?? 0) + 1);

    return {
      from,
      to,
      days,
      /** False when the plan leaves out sources, devices and drop-off. */
      full,
      ...now_,
      change,
      daily,
      dropOff,
      sources: (full ? [...bySource.entries()] : [])
        .map(([name, s]) => ({
          name,
          views: s.views,
          responses: s.responses,
          completed: s.completed,
          completion: s.views ? Math.round((s.completed / s.views) * 1000) / 10 : null,
        }))
        .sort((a, b) => b.views - a.views || b.responses - a.responses),
      devices: (full ? [...byDevice.entries()] : []).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count),
      /** Lifetime counters, which the dashboard and form list still show. */
      lifetime: {
        views: forms.reduce((n, f) => n + (f.views ?? 0), 0),
        starts: forms.reduce((n, f) => n + (f.starts ?? 0), 0),
        responses: forms.reduce((n, f) => n + f.responsesCount, 0),
      },
      formCount: forms.length,
      forms: forms
        .map((f) => ({
          _id: f._id,
          title: f.title,
          status: f.status,
          responses: f.responsesCount,
          completed: f.completedCount,
          views: f.views ?? 0,
          completionRate: completionRate(f),
          inRange: inRange.get(f._id) ?? 0,
        }))
        .sort((a, b) => b.inRange - a.inRange || b.responses - a.responses),
    };
  },
});
