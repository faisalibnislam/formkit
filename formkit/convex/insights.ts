import { ConvexError, v } from "convex/values";
import { action, internalMutation, internalQuery, query } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { formFor } from "./model/forms";
import { CREDIT_COST, hasFeature } from "./model/plans";
import { canSpend } from "./model/aiMeter";
import { spaceOfForm } from "./model/spaces";
import { generate, ModelError, parseJson, voice } from "./model/gemini";

/**
 * Business: AI insights on a form's responses - for forms with AI replies,
 * whose reply call also reads each response for its sentiment, intent,
 * topics, a lead score and urgency. The overview adds those up; the report
 * asks the AI to read across them and say what it sees.
 */

const DAY = 86_400_000;
/** A new report no more often than this, per form. */
const REPORT_EVERY = 10 * 60_000;

type Insight = NonNullable<Doc<"responses">["insight"]>;

export const overview = query({
  args: { formId: v.id("forms"), from: v.number(), to: v.number() },
  handler: async (ctx, { formId, from, to }) => {
    const form = await formFor(ctx, formId, "read");
    const rows = (
      await ctx.db
        .query("responses")
        .withIndex("by_form_submitted", (q) => q.eq("formId", formId).gte("submittedAt", from).lt("submittedAt", to))
        .collect()
    ).filter((r) => !r.preview && !r.partial);
    const read = rows.filter((r) => r.insight);
    // Only forms with AI replies have anything to show.
    if (!form.aiReply?.enabled && read.length === 0) return null;
    if (!(await hasFeature(ctx, form, "ai.insights"))) return { locked: true as const };

    const n = read.length;
    const ins = read.map((r) => r.insight!);
    const count = <K extends string>(pick: (i: Insight) => K | undefined, keys: readonly K[]) =>
      keys.map((k) => ({ key: k, count: ins.filter((i) => pick(i) === k).length }));

    // Topics, with how people who raised each one felt.
    const topics = new Map<string, { count: number; positive: number; negative: number; score: number; scored: number }>();
    for (const i of ins) {
      for (const t of i.topics) {
        const e = topics.get(t) ?? { count: 0, positive: 0, negative: 0, score: 0, scored: 0 };
        e.count++;
        if (i.sentiment === "positive") e.positive++;
        if (i.sentiment === "negative") e.negative++;
        if (typeof i.score === "number") {
          e.score += i.score;
          e.scored++;
        }
        topics.set(t, e);
      }
    }
    const intents = new Map<string, number>();
    for (const i of ins) if (i.intent) intents.set(i.intent.toLowerCase(), (intents.get(i.intent.toLowerCase()) ?? 0) + 1);

    const scored = ins.filter((i) => typeof i.score === "number");
    const buckets = [0, 20, 40, 60, 80].map((lo) => ({
      label: lo === 80 ? "80–100" : `${lo}–${lo + 19}`,
      count: scored.filter((i) => i.score! >= lo && (lo === 80 ? i.score! <= 100 : i.score! < lo + 20)).length,
    }));

    // Day by day: how many were read, and how many of those were negative.
    const days = Math.max(1, Math.min(120, Math.round((to - from) / DAY)));
    const daily = Array.from({ length: days }, (_, d) => {
      const start = from + d * DAY;
      const day = read.filter((r) => r.submittedAt >= start && r.submittedAt < start + DAY);
      return {
        at: start,
        count: day.length,
        positive: day.filter((r) => r.insight!.sentiment === "positive").length,
        negative: day.filter((r) => r.insight!.sentiment === "negative").length,
      };
    });

    const person = (r: Doc<"responses">) => ({
      _id: r._id,
      name: r.respondentName ?? r.respondentEmail ?? "Someone",
      at: r.submittedAt,
      score: r.insight?.score ?? null,
      intent: r.insight?.intent ?? null,
      urgency: r.insight?.urgency ?? null,
      sentiment: r.insight?.sentiment ?? null,
      summary: r.insight?.summary ?? null,
    });

    const replies = rows.filter((r) => r.aiReply);
    const rated = replies.filter((r) => r.aiReply!.rating);

    const report = await ctx.db
      .query("aiReports")
      .withIndex("by_form", (q) => q.eq("formId", formId))
      .order("desc")
      .first();

    return {
      locked: false as const,
      total: rows.length,
      read: n,
      sentiment: count((i) => i.sentiment, ["positive", "neutral", "negative"] as const),
      urgency: count((i) => i.urgency, ["high", "medium", "low"] as const),
      averageScore: scored.length ? Math.round(scored.reduce((s, i) => s + i.score!, 0) / scored.length) : null,
      scores: buckets,
      topics: [...topics.entries()]
        .sort((a, b) => b[1].count - a[1].count)
        .slice(0, 10)
        .map(([name, e]) => ({
          name,
          count: e.count,
          positive: e.positive,
          negative: e.negative,
          averageScore: e.scored ? Math.round(e.score / e.scored) : null,
        })),
      intents: [...intents.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6)
        .map(([name, c]) => ({ name, count: c })),
      daily,
      leads: read
        .filter((r) => typeof r.insight?.score === "number")
        .sort((a, b) => b.insight!.score! - a.insight!.score! || b.submittedAt - a.submittedAt)
        .slice(0, 8)
        .map(person),
      followUp: rows
        .filter((r) => r.aiReply?.needsHuman || r.insight?.urgency === "high")
        .sort((a, b) => b.submittedAt - a.submittedAt)
        .slice(0, 8)
        .map(person),
      replies: {
        written: replies.filter((r) => r.aiReply!.status === "ready").length,
        emailed: replies.filter((r) => r.aiReply!.emailedAt).length,
        failed: replies.filter((r) => r.aiReply!.status === "failed").length,
        skipped: replies.filter((r) => r.aiReply!.status === "skipped").length,
        helpful: rated.filter((r) => r.aiReply!.rating === "up").length,
        unhelpful: rated.filter((r) => r.aiReply!.rating === "down").length,
      },
      report: report ? { at: report.at, count: report.count, ...(report.report as Report) } : null,
    };
  },
});

type Report = {
  headline: string;
  themes: { title: string; detail: string; share?: number }[];
  opportunities: string[];
  risks: string[];
  suggestions: string[];
};

export const reportContext = internalQuery({
  args: { formId: v.id("forms") },
  handler: async (ctx, { formId }) => {
    const form = await formFor(ctx, formId, "read");
    if (!(await hasFeature(ctx, form, "ai.insights"))) throw new ConvexError("AI insights are part of Pro.");
    if (!(await canSpend(ctx, spaceOfForm(form), "reports"))) {
      throw new ConvexError(
        `This month’s insights reports are used up. Each extra report is ${CREDIT_COST.reports} AI credits, under Settings → Plan.`,
      );
    }
    const last = await ctx.db
      .query("aiReports")
      .withIndex("by_form", (q) => q.eq("formId", formId))
      .order("desc")
      .first();
    if (last && Date.now() - last.at < REPORT_EVERY) {
      throw new ConvexError("A report was written a few minutes ago. Try again shortly.");
    }
    const rows = (
      await ctx.db
        .query("responses")
        .withIndex("by_form_submitted", (q) => q.eq("formId", formId))
        .order("desc")
        .take(600)
    ).filter((r) => r.insight && !r.preview && !r.partial);
    return {
      ownerId: form.ownerId,
      brand: form.brand,
      title: form.title,
      goal: form.aiReply?.prompt.slice(0, 1200) ?? "",
      items: rows.slice(0, 300).map((r) => ({
        when: new Date(r.submittedAt).toISOString().slice(0, 10),
        sentiment: r.insight!.sentiment,
        intent: r.insight!.intent,
        topics: r.insight!.topics,
        score: r.insight!.score,
        urgency: r.insight!.urgency,
        summary: r.insight!.summary,
      })),
    };
  },
});

export const saveReport = internalMutation({
  args: { formId: v.id("forms"), count: v.number(), report: v.any() },
  returns: v.null(),
  handler: async (ctx, a) => {
    await ctx.db.insert("aiReports", { ...a, at: Date.now() });
    const old = await ctx.db
      .query("aiReports")
      .withIndex("by_form", (q) => q.eq("formId", a.formId))
      .order("desc")
      .collect();
    for (const r of old.slice(5)) await ctx.db.delete(r._id);
    return null;
  },
});

const clip = (s: unknown, n: number) => voice(String(s ?? "").trim().slice(0, n));

/** Reads across the latest responses' insights and says what stands out. */
export const report = action({
  args: { formId: v.id("forms") },
  returns: v.null(),
  handler: async (ctx, { formId }): Promise<null> => {
    const c: {
      ownerId: Id<"users">;
      brand: "me" | Id<"companies">;
      title: string;
      goal: string;
      items: unknown[];
    } = await ctx.runQuery(
      internal.insights.reportContext,
      { formId },
    );
    if (c.items.length < 3) throw new ConvexError("A report needs a few more responses with AI replies first.");
    let raw: Partial<Report> | null = null;
    try {
      const { text } = await generate({
        meter: { ctx, userId: c.ownerId, feature: "insights" },
        system: `You are an analyst reading what an AI noted about each response to the form “${c.title}”. The owner's goal for the form, from their reply instructions:
"""
${c.goal}
"""
Write a short, concrete report for the owner: a one-sentence headline; up to 5 themes (title, one or two sentences of detail, and roughly what percentage of responses it covers); up to 3 opportunities; up to 3 risks or complaints worth attention; and up to 3 practical suggestions for the business or the form. Use plain, friendly language, no jargon, no markdown, and never use em dashes. Only draw on the data given; don't invent numbers beyond rough shares you can see.`,
        turns: [{ role: "user", parts: [{ text: JSON.stringify(c.items) }] }],
        schema: {
          type: "OBJECT",
          properties: {
            headline: { type: "STRING" },
            themes: {
              type: "ARRAY",
              items: {
                type: "OBJECT",
                properties: { title: { type: "STRING" }, detail: { type: "STRING" }, share: { type: "INTEGER" } },
                required: ["title", "detail"],
              },
            },
            opportunities: { type: "ARRAY", items: { type: "STRING" } },
            risks: { type: "ARRAY", items: { type: "STRING" } },
            suggestions: { type: "ARRAY", items: { type: "STRING" } },
          },
          required: ["headline", "themes", "opportunities", "risks", "suggestions"],
        },
        maxTokens: 2000,
        temperature: 0.3,
        timeoutMs: 45_000,
      });
      raw = parseJson(text);
    } catch (e) {
      if (e instanceof ModelError) throw new ConvexError(e.message);
      throw e;
    }
    if (!raw?.headline) throw new ConvexError("The AI didn’t send back a usable report. Try again in a minute.");
    const report: Report = {
      headline: clip(raw.headline, 240),
      themes: (raw.themes ?? []).slice(0, 5).map((t) => ({
        title: clip(t.title, 80),
        detail: clip(t.detail, 360),
        ...(typeof t.share === "number" ? { share: Math.max(0, Math.min(100, Math.round(t.share))) } : {}),
      })),
      opportunities: (raw.opportunities ?? []).slice(0, 3).map((x) => clip(x, 280)),
      risks: (raw.risks ?? []).slice(0, 3).map((x) => clip(x, 280)),
      suggestions: (raw.suggestions ?? []).slice(0, 3).map((x) => clip(x, 280)),
    };
    await ctx.runMutation(internal.insights.saveReport, { formId, count: c.items.length, report });
    // Charged once the report is written; a failed one costs nothing.
    await ctx.runMutation(internal.credits.spend, { ownerId: c.ownerId, brand: c.brand, kind: "reports" });
    return null;
  },
});

