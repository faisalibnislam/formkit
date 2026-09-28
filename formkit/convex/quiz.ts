import { ConvexError, v } from "convex/values";
import { internalAction, internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { brandOf, formFor } from "./model/forms";
import { hasFeature, requireFeature } from "./model/plans";
import { marked, totals } from "./model/quiz";
import { senderFor } from "./emailDomains";
import { notifyDefaults, send } from "./notifications";
import { button, facts, paragraph, renderShell, safeColor, type Brand } from "./emails/kit";

/**
 * Business: quizzes and exams.
 *
 * Questions carry an answer key and marks; a response is marked as it
 * arrives (see model/quiz.ts), and anything without a key — a written answer
 * — waits for the owner to mark it. A timer, kept by the server, sends the
 * quiz when time is up. Results show straight away, or are held until the
 * owner releases them, now or at a set time; either way people can be
 * emailed a link to their results page.
 */

const SITE = process.env.SITE_URL ?? "https://formkit.app";

const settings = v.object({
  enabled: v.boolean(),
  timeLimit: v.optional(v.number()),
  passMark: v.optional(v.number()),
  shuffleQuestions: v.optional(v.boolean()),
  shuffleOptions: v.optional(v.boolean()),
  oneAttempt: v.optional(v.boolean()),
  results: v.union(v.literal("instant"), v.literal("later")),
  showAnswers: v.optional(v.boolean()),
  emailResults: v.optional(v.boolean()),
  releaseAt: v.optional(v.number()),
});

export const save = mutation({
  args: { formId: v.id("forms"), settings },
  returns: v.null(),
  handler: async (ctx, { formId, settings: s }) => {
    const form = await formFor(ctx, formId);
    if (s.enabled) await requireFeature(ctx, form.ownerId, "quiz");
    const releaseAt = s.results === "later" && s.releaseAt && s.releaseAt > Date.now() ? s.releaseAt : undefined;
    await ctx.db.patch(formId, {
      quiz: {
        enabled: s.enabled,
        timeLimit: s.timeLimit ? Math.max(1, Math.min(600, Math.round(s.timeLimit))) : undefined,
        passMark: typeof s.passMark === "number" ? Math.max(0, Math.min(100, Math.round(s.passMark))) : undefined,
        shuffleQuestions: s.shuffleQuestions || undefined,
        shuffleOptions: s.shuffleOptions || undefined,
        oneAttempt: s.oneAttempt || undefined,
        results: s.results,
        showAnswers: s.showAnswers || undefined,
        emailResults: s.emailResults || undefined,
        // Held results stay released once they are out.
        releasedAt: s.results === "later" ? form.quiz?.releasedAt : undefined,
        releaseAt,
      },
      updatedAt: Date.now(),
    });
    if (releaseAt && releaseAt !== form.quiz?.releaseAt) {
      await ctx.scheduler.runAt(releaseAt, internal.quiz.releaseDue, { formId, at: releaseAt });
    }
    return null;
  },
});

/** Scheduled for a chosen release time; does nothing if the time was changed since. */
export const releaseDue = internalMutation({
  args: { formId: v.id("forms"), at: v.number() },
  returns: v.null(),
  handler: async (ctx, { formId, at }) => {
    const form = await ctx.db.get(formId);
    if (!form?.quiz || form.quiz.releaseAt !== at || form.quiz.releasedAt) return null;
    await ctx.db.patch(formId, { quiz: { ...form.quiz, releasedAt: Date.now(), releaseAt: undefined } });
    if (form.quiz.emailResults) await ctx.scheduler.runAfter(0, internal.quiz.emailAll, { formId });
    return null;
  },
});

/** Releases held results now, and emails them if the quiz says to. */
export const release = mutation({
  args: { formId: v.id("forms") },
  returns: v.null(),
  handler: async (ctx, { formId }) => {
    const form = await formFor(ctx, formId);
    if (!form.quiz?.enabled) throw new ConvexError("This form isn’t a quiz.");
    await requireFeature(ctx, form.ownerId, "quiz");
    await ctx.db.patch(formId, { quiz: { ...form.quiz, releasedAt: Date.now(), releaseAt: undefined } });
    if (form.quiz.emailResults) await ctx.scheduler.runAfter(0, internal.quiz.emailAll, { formId });
    return null;
  },
});

/** The owner marks a question by hand, or overrides the automatic mark. */
export const grade = mutation({
  args: { responseId: v.id("responses"), blockId: v.id("blocks"), got: v.number() },
  returns: v.null(),
  handler: async (ctx, { responseId, blockId, got }) => {
    const r = await ctx.db.get(responseId);
    if (!r?.quiz) throw new ConvexError("That response has no mark.");
    const form = await formFor(ctx, r.formId);
    const marks = r.quiz.marks.map((m) =>
      m.blockId === blockId ? { blockId: m.blockId, max: m.max, got: Math.max(0, Math.min(m.max, Math.round(got * 10) / 10)) } : m,
    );
    const next = { ...r.quiz, ...totals(marks, form.quiz?.passMark) };
    await ctx.db.patch(responseId, { quiz: next });
    // Fully marked, and people can see it: send it if the quiz emails results.
    const out = form.quiz?.results === "instant" || !!form.quiz?.releasedAt;
    if (!next.pending && r.quiz.pending && out && form.quiz?.emailResults && !r.quiz.emailedAt) {
      await ctx.scheduler.runAfter(0, internal.quiz.emailResult, { responseId });
    }
    return null;
  },
});

/* ------------------------------------------------------------------ */
/* Results                                                              */

function released(form: Doc<"forms">) {
  return form.quiz?.results === "instant" || !!form.quiz?.releasedAt;
}

const answerText = (a: Doc<"responses">["answers"][number] | undefined) =>
  a ? (a.fileName ?? (a.values?.length ? a.values.join(", ") : (a.value ?? ""))) : "";

/** The results page and the thank-you screen: the person's own mark, once it's out. */
export const result = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    if (!token) return null;
    const r = await ctx.db
      .query("responses")
      .withIndex("by_resume", (q) => q.eq("resumeToken", token))
      .first();
    if (!r?.quiz || r.partial) return null;
    const form = await ctx.db.get(r.formId);
    if (!form?.quiz) return null;
    const brand = await brandOf(ctx, form);
    const head = {
      title: form.title,
      brand: { name: brand.name, logoUrl: brand.logoUrl, color: brand.color },
      name: r.respondentName ?? null,
      submittedAt: r.submittedAt,
    };
    if (!released(form)) {
      return { ...head, released: false as const, releaseAt: form.quiz.releaseAt ?? null };
    }
    const blocks = await ctx.db
      .query("blocks")
      .withIndex("by_form_order", (q) => q.eq("formId", form._id))
      .collect();
    const byId = new Map(blocks.map((b) => [b._id as string, b]));
    const answers = new Map(r.answers.map((a) => [a.blockId as string, a]));
    return {
      ...head,
      released: true as const,
      score: r.quiz.score,
      max: r.quiz.max,
      percent: r.quiz.percent,
      passed: r.quiz.passed ?? null,
      passMark: form.quiz.passMark ?? null,
      pending: r.quiz.pending,
      timedOut: !!r.quiz.timedOut,
      questions: form.quiz.showAnswers
        ? r.quiz.marks
            .filter((m) => byId.has(m.blockId))
            .map((m) => {
              const b = byId.get(m.blockId)!;
              return {
                title: b.title ?? "Question",
                given: answerText(answers.get(m.blockId)),
                got: m.got,
                max: m.max,
                manual: !!m.manual,
                answer: b.answerKey?.length ? b.answerKey.join(" / ") : null,
              };
            })
        : null,
    };
  },
});

/** Settings → Quiz: how the quiz went, and what's waiting to be marked. */
export const summary = query({
  args: { formId: v.id("forms") },
  handler: async (ctx, { formId }) => {
    const form = await formFor(ctx, formId, "read");
    if (!form.quiz?.enabled) return null;
    const rows = (
      await ctx.db
        .query("responses")
        .withIndex("by_form", (q) => q.eq("formId", formId))
        .collect()
    ).filter((r) => r.quiz && !r.partial && !r.preview);
    const blocks = (
      await ctx.db
        .query("blocks")
        .withIndex("by_form_order", (q) => q.eq("formId", formId))
        .collect()
    )
      .filter(marked)
      .sort((a, b) => a.order - b.order);
    const done = rows.filter((r) => !r.quiz!.pending);
    const passedKnown = done.filter((r) => typeof r.quiz!.passed === "boolean");
    return {
      count: rows.length,
      toMark: rows.filter((r) => r.quiz!.pending).length,
      average: done.length ? Math.round((done.reduce((n, r) => n + r.quiz!.percent, 0) / done.length) * 10) / 10 : null,
      passRate: passedKnown.length ? Math.round((passedKnown.filter((r) => r.quiz!.passed).length / passedKnown.length) * 100) : null,
      timedOut: rows.filter((r) => r.quiz!.timedOut).length,
      spread: [0, 20, 40, 60, 80].map((lo) => ({
        label: lo === 80 ? "80–100%" : `${lo}–${lo + 19}%`,
        count: done.filter((r) => r.quiz!.percent >= lo && (lo === 80 ? true : r.quiz!.percent < lo + 20)).length,
      })),
      questions: blocks.map((b) => {
        const got = rows.map((r) => r.quiz!.marks.find((m) => m.blockId === b._id)).filter((m) => m && !m.manual);
        return {
          _id: b._id,
          title: b.title ?? "Question",
          keyed: !!b.answerKey?.length,
          right: got.length ? Math.round((got.filter((m) => m!.got >= m!.max).length / got.length) * 100) : null,
        };
      }),
      released: released(form),
      releasedAt: form.quiz.releasedAt ?? null,
      releaseAt: form.quiz.releaseAt ?? null,
    };
  },
});

/* ------------------------------------------------------------------ */
/* Emailing results                                                     */

export const emailJob = internalQuery({
  args: { responseId: v.id("responses") },
  handler: async (ctx, { responseId }) => {
    const r = await ctx.db.get(responseId);
    if (!r?.quiz || !r.respondentEmail || !r.resumeToken || r.quiz.emailedAt || r.quiz.pending) return null;
    const form = await ctx.db.get(r.formId);
    if (!form?.quiz || !released(form) || !(await hasFeature(ctx, form.ownerId, "quiz"))) return null;
    const owner = await ctx.db.get(form.ownerId);
    const brand = await brandOf(ctx, form);
    return {
      to: r.respondentEmail,
      name: r.respondentName ?? null,
      token: r.resumeToken,
      title: form.title,
      score: r.quiz.score,
      max: r.quiz.max,
      percent: r.quiz.percent,
      passed: r.quiz.passed ?? null,
      brand,
      ownerId: form.ownerId,
      formId: form._id,
      from: owner ? await senderFor(ctx, owner._id, brand.name) : null,
      replyTo: owner ? notifyDefaults(form.notify, owner.email ?? "", owner.emailPrefs).replyTo || undefined : undefined,
    };
  },
});

export const markEmailed = internalMutation({
  args: { responseId: v.id("responses") },
  returns: v.null(),
  handler: async (ctx, { responseId }) => {
    const r = await ctx.db.get(responseId);
    if (r?.quiz) await ctx.db.patch(responseId, { quiz: { ...r.quiz, emailedAt: Date.now() } });
    return null;
  },
});

export const emailResult = internalAction({
  args: { responseId: v.id("responses") },
  returns: v.null(),
  handler: async (ctx, { responseId }) => {
    const job = await ctx.runQuery(internal.quiz.emailJob, { responseId });
    if (!job) return null;
    const brand: Brand = { name: job.brand.name, logoUrl: job.brand.logoUrl, color: safeColor(job.brand.color), badge: job.brand.badge };
    const verdict = job.passed === null ? "" : job.passed ? " — you passed" : " — not a pass this time";
    const subject = `Your results: ${job.title}`;
    const link = `${SITE}/q/${job.token}`;
    const first = (job.name ?? "").trim().split(/\s+/)[0];
    const html = renderShell({
      brand,
      eyebrow: "Results",
      heading: `${job.score} out of ${job.max}${verdict}`,
      lede: `${first ? `${first}, here` : "Here"} are your results for ${job.title}.`,
      body:
        facts([
          ["Score", `${job.score} / ${job.max}`],
          ["Percentage", `${job.percent}%`],
          ...(job.passed === null ? [] : ([["Result", job.passed ? "Pass" : "Not passed"]] as [string, string][])),
        ]) +
        paragraph("See every question and your answers on your results page.", { top: 18 }) +
        button("See your results", link, safeColor(job.brand.color) ?? undefined),
      reason: `Sent by ${job.brand.name} because you took ${job.title}.`,
    });
    const text = `Your results for ${job.title}: ${job.score} out of ${job.max} (${job.percent}%)${verdict}.\n\nSee them here: ${link}`;
    const sent = await send({ to: [job.to], subject, html, text, from: job.from, replyTo: job.replyTo });
    if (sent.state === "sent") await ctx.runMutation(internal.quiz.markEmailed, { responseId });
    await ctx.runMutation(internal.notifications.record, {
      userId: job.ownerId,
      formId: job.formId,
      kind: "quiz results",
      to: job.to,
      subject,
      ...sent,
    });
    return null;
  },
});

export const waiting = internalQuery({
  args: { formId: v.id("forms") },
  handler: async (ctx, { formId }) =>
    (
      await ctx.db
        .query("responses")
        .withIndex("by_form", (q) => q.eq("formId", formId))
        .collect()
    )
      .filter((r) => r.quiz && !r.quiz.emailedAt && !r.quiz.pending && r.respondentEmail && !r.partial && !r.preview)
      .map((r) => r._id as Id<"responses">),
});

/** Emails everyone whose results are out and who hasn't had them yet. */
export const emailAll = internalAction({
  args: { formId: v.id("forms") },
  returns: v.null(),
  handler: async (ctx, { formId }) => {
    const ids: Id<"responses">[] = await ctx.runQuery(internal.quiz.waiting, { formId });
    for (const responseId of ids) await ctx.runAction(internal.quiz.emailResult, { responseId });
    return null;
  },
});
