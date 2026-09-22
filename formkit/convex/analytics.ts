import { v } from "convex/values";
import { query } from "./_generated/server";
import { requireUser } from "./model/identity";
import { completionRate, formFor } from "./model/forms";

/**
 * Analytics, computed from what is actually stored.
 *
 * Nothing here is modelled or smoothed: views and starts are counted as the
 * published form records them, drop-off is counted from the answers a response
 * carries, and a form with no traffic says so rather than drawing a curve.
 */

const DAY = 24 * 60 * 60 * 1000;

export const overview = query({
  args: { formId: v.optional(v.id("forms")), days: v.optional(v.number()) },
  handler: async (ctx, { formId, days = 30 }) => {
    const user = await requireUser(ctx);

    const forms = formId
      ? [await formFor(ctx, formId, "read")]
      : (
          await ctx.db
            .query("forms")
            .withIndex("by_owner", (q) => q.eq("ownerId", user._id))
            .collect()
        ).filter((f) => !f.deletedAt);

    const ids = new Set(forms.map((f) => f._id as string));
    const responses = (
      formId
        ? await ctx.db
            .query("responses")
            .withIndex("by_form", (q) => q.eq("formId", formId))
            .collect()
        : await ctx.db
            .query("responses")
            .withIndex("by_owner", (q) => q.eq("ownerId", user._id))
            .collect()
    ).filter((r) => ids.has(r.formId));

    const since = Date.now() - days * DAY;
    const recent = responses.filter((r) => r.submittedAt >= since);

    // One bucket per day, oldest first, so the bars read left to right.
    const start = new Date(since);
    start.setHours(0, 0, 0, 0);
    const buckets = Array.from({ length: days }, (_, i) => {
      const from = start.getTime() + i * DAY;
      return {
        at: from,
        label: new Date(from).toLocaleDateString("en-US", { day: "numeric", month: "short" }),
        count: recent.filter((r) => r.submittedAt >= from && r.submittedAt < from + DAY).length,
      };
    });

    const views = forms.reduce((n, f) => n + (f.views ?? 0), 0);
    const starts = forms.reduce((n, f) => n + (f.starts ?? 0), 0);
    const completed = responses.filter((r) => !r.partial).length;

    const durations = responses
      .map((r) => r.durationMs)
      .filter((d): d is number => typeof d === "number" && d > 0)
      .sort((a, b) => a - b);
    const median = durations.length
      ? durations[Math.floor(durations.length / 2)]!
      : null;

    // Where people stop: the share of responses that reached each question.
    const dropOff = formId
      ? await (async () => {
          const blocks = (
            await ctx.db
              .query("blocks")
              .withIndex("by_form_order", (q) => q.eq("formId", formId))
              .collect()
          )
            .filter((b) => b.kind === "field")
            .sort((a, b) => a.order - b.order);

          const total = responses.length || 1;
          return blocks.map((b) => {
            const reached = responses.filter((r) =>
              r.answers.some(
                (a) => a.blockId === b._id && (a.value || a.values?.length || a.fileId),
              ),
            ).length;
            return {
              title: b.title ?? "Question",
              reached,
              share: Math.round((reached / total) * 1000) / 10,
            };
          });
        })()
      : [];

    const byDevice = new Map<string, number>();
    for (const r of responses) byDevice.set(r.device ?? "Unknown", (byDevice.get(r.device ?? "Unknown") ?? 0) + 1);

    const bySource = new Map<string, number>();
    for (const r of responses) bySource.set(r.source ?? "Direct", (bySource.get(r.source ?? "Direct") ?? 0) + 1);

    return {
      days,
      views,
      starts,
      responses: responses.length,
      completed,
      partial: responses.length - completed,
      completionRate:
        forms.length === 1
          ? completionRate(forms[0]!)
          : responses.length
            ? Math.round((completed / responses.length) * 1000) / 10
            : 0,
      /** Of everyone who opened the form, how many finished it. */
      finishRate: views ? Math.round((completed / views) * 1000) / 10 : 0,
      medianSeconds: median ? Math.round(median / 1000) : null,
      buckets,
      dropOff,
      devices: [...byDevice.entries()].map(([name, count]) => ({ name, count })),
      sources: [...bySource.entries()].map(([name, count]) => ({ name, count })),
      forms: forms
        .map((f) => ({
          _id: f._id,
          title: f.title,
          responses: f.responsesCount,
          completed: f.completedCount,
          views: f.views ?? 0,
          completionRate: completionRate(f),
        }))
        .sort((a, b) => b.responses - a.responses),
    };
  },
});
