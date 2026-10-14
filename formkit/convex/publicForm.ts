import { hasLimits, placesLeft, placesTaken } from "./model/places";
import { isAudio, voiceLength } from "./model/voice";
import { owed, takesPayment } from "./payments";
import { ConvexError, v } from "convex/values";
import { action, internalAction, internalMutation, internalQuery, mutation, query, type MutationCtx } from "./_generated/server";
import { send } from "./notifications";
import { renderResumeLink } from "./emails/response";
import { validateAnswers } from "./model/validate";
import { servedForm } from "./model/served";
import type { Rule } from "./model/logicEval";
import { internal } from "./_generated/api";
import { closedReason, notifyResponse, tellFormTeam } from "./model/inbox";
import { queueReply } from "./model/aiReply";
import { chargeResponse, usesAiLogic } from "./model/aiMeter";
import { markAll, marked } from "./model/quiz";
import { Doc, Id } from "./_generated/dataModel";
import { QueryCtx } from "./_generated/server";
import { brandOf, formFor, shouldAutoClose, themeLogos } from "./model/forms";
import { passwordMatches, securityOf } from "./model/security";
import { flagOn } from "./model/flags";
import { PLANS, hasFeature, planOfId } from "./model/plans";
import { computeAll } from "./model/calc";
import { accessOf } from "./model/access";
import { searchTextOf } from "./model/responseSearch";
import { countChange } from "./model/responseCounts";
import { RULES, allowForm } from "./model/rateLimit";
import { contactKeyOf, notePerson } from "./model/contacts";
import { formUrl, liveDomainOf } from "./model/handles";

/**
 * The published form, as a respondent sees it.
 *
 * None of this requires a signed-in user. A form is reachable at
 * `/<handle>/<slug>` once its identity has claimed a handle, and at `/f/<slug>`
 * otherwise; both resolve here.
 *
 * The form's Security settings are enforced here, not in the browser: the
 * password, the spam check, one submission a minute per device, one response
 * per person when multiple submissions are off, and a required email.
 */

/** The smarter-form features the form's company plan includes. */
async function smartOf(ctx: QueryCtx, form: Doc<"forms">) {
  return {
    hidden: await hasFeature(ctx, form, "logic.hidden"),
    piping: await hasFeature(ctx, form, "logic.piping"),
    calc: await hasFeature(ctx, form, "logic.calc"),
    redirect: await hasFeature(ctx, form, "forms.redirect"),
    /** AI conditions and facts read from answers. */
    ai: await hasFeature(ctx, form, "logic.ai"),
  };
}

/** Pro: the brand's own font file and custom CSS, dropped if the plan lapses. */
async function customLook(ctx: QueryCtx, form: Doc<"forms">) {
  const t = (form.theme ?? {}) as { customFont?: { name: string; storageId: Id<"_storage"> } | null; css?: string };
  const fontOk = !!t.customFont && (await hasFeature(ctx, form, "design.fonts"));
  const cssOk = !!t.css?.trim() && (await hasFeature(ctx, form, "design.css"));
  if (!fontOk && !cssOk) return null;
  const url = fontOk ? await ctx.storage.getUrl(t.customFont!.storageId) : null;
  return {
    font: fontOk && url ? { name: t.customFont!.name, url } : null,
    css: cssOk ? t.css!.slice(0, 20000) : null,
  };
}

/**
 * Partial responses are on every plan, behind the platform flag.
 */
async function partialsOn(ctx: QueryCtx, ownerId: Id<"users">) {
  return await flagOn(ctx, "forms.partials", ownerId);
}

/**
 * A file over the owner's plan cap is refused here as well as in the browser,
 * and the stored upload is removed rather than kept orphaned.
 */
async function checkUploads(
  ctx: MutationCtx,
  form: Doc<"forms">,
  answers: { blockId: Id<"blocks">; fileId?: Id<"_storage"> }[],
) {
  const capMb = PLANS[await planOfId(ctx, form)].uploadMb;
  for (const a of answers) {
    if (!a.fileId) continue;
    const meta = await ctx.db.system.get(a.fileId);
    if (meta && meta.size > capMb * 1024 * 1024) {
      await ctx.storage.delete(a.fileId);
      throw new ConvexError(`That file is over ${capMb} MB. Try a smaller one.`);
    }
    // A voice question only ever takes a recording.
    const block = await ctx.db.get(a.blockId);
    if (block?.type === "voice" && meta && !isAudio(meta.contentType)) {
      await ctx.storage.delete(a.fileId);
      throw new ConvexError("That recording could not be read. Try recording it again.");
    }
  }
}
const RATE_MS = 60_000;
/** Faster than this, a whole form was not read by a person. */
const TOO_FAST_MS = 2_500;
const CLOSED_NOTE = "This form is closed. Thank you to everyone who answered.";

async function resolve(
  ctx: QueryCtx,
  slug: string,
  handle?: string,
): Promise<Doc<"forms"> | null> {
  const form = await ctx.db
    .query("forms")
    .withIndex("by_slug", (q) => q.eq("slug", slug))
    .first();
  if (!form || form.deletedAt) return null;

  if (handle) {
    // The handle must actually belong to the identity the form publishes under,
    // or a form could be read from somebody else's link.
    const owner =
      form.brand === "me"
        ? await ctx.db.get(form.ownerId)
        : await ctx.db.get(form.brand as Id<"companies">);
    if (owner?.handle !== handle) return null;
  }
  return form;
}


/** A quiz shortly over its time is still accepted, marked late, for slow networks. */
const LATE_GRACE_MS = 60_000;

/**
 * Whether this person has already sent a complete answer to the form, matched
 * by device or by email. Read through the indexes, so the check costs the
 * same on a form with ten answers as on one with ten thousand.
 */
async function answeredBefore(
  ctx: QueryCtx,
  formId: Id<"forms">,
  deviceId: string | undefined,
  email: string | undefined,
) {
  const sent = (rows: Doc<"responses">[]) => rows.some((r) => !r.partial && !r.preview);
  if (deviceId) {
    const mine = await ctx.db
      .query("responses")
      .withIndex("by_form_device", (q) => q.eq("formId", formId).eq("deviceId", deviceId))
      .collect();
    if (sent(mine)) return true;
  }
  if (email) {
    const mine = await ctx.db
      .query("responses")
      .withIndex("by_form_email", (q) => q.eq("formId", formId).eq("respondentEmail", email))
      .collect();
    if (sent(mine)) return true;
  }
  return false;
}

/** The form's quiz settings, when it is a quiz and the owner's plan has quizzes. */
async function quizOf(ctx: QueryCtx | MutationCtx, form: Doc<"forms">) {
  if (!form.quiz?.enabled) return null;
  return (await hasFeature(ctx, form, "quiz")) ? form.quiz : null;
}

function publicCondition<C extends { source?: string; value?: string }>(c: C): C {
  return c.source === "ai" ? { ...c, value: undefined } : c;
}

/** Everything the runner needs to show the questions. */
async function payload(ctx: QueryCtx, live: Doc<"forms">, opts: { draft?: boolean } = {}) {
  // The published version for respondents; the draft for the builder's preview.
  const served = await servedForm(ctx, live, opts);
  const form = served.form;
  const blocks = served.blocks;
  const rules = served.rules.filter((r) => r.enabled);

  const s = securityOf(form.security);
  const smart = await smartOf(ctx, form);
  const thanks = form.thanks as { redirect?: string } | null | undefined;
  // Several endings, hidden options and limited places are Pro.
  const advanced = await hasFeature(ctx, form, "logic.advanced");
  const taken = advanced ? await placesTaken(ctx, form._id, blocks) : new Map<string, number[]>();
  const quiz = await quizOf(ctx, form);
  const quizPublic = quiz
    ? {
        timeLimit: quiz.timeLimit ?? null,
        shuffleQuestions: !!quiz.shuffleQuestions,
        shuffleOptions: !!quiz.shuffleOptions,
        results: quiz.results,
        passMark: quiz.passMark ?? null,
        oneAttempt: !!quiz.oneAttempt,
      }
    : null;

  return {
    state: "open" as const,
    formId: form._id,
    title: form.title,
    brand: await brandOf(ctx, form),
    logos: await themeLogos(ctx, form.theme),
    welcome: form.welcome ?? null,
    // Sending people on to a page of the owner's is Pro.
    thanks: thanks ? { ...thanks, redirect: smart.redirect ? thanks.redirect : undefined } : null,
    theme: form.theme ?? null,
    closedMessage: form.closing?.message || CLOSED_NOTE,
    /** Which smarter-form features the owner's plan turns on here. */
    smart,
    calc: smart.calc ? (form.calc ?? []) : [],
    /** Pro: people are sent to pay, through the owner's Stripe, after sending. */
    payment: await takesPayment(ctx, form),
    uploadCapMb: PLANS[await planOfId(ctx, form)].uploadMb,
    custom: await customLook(ctx, form),
    rules: {
      spam: s.spam,
      requireEmail: s.requireEmail,
      editAfter: s.editAfter,
      multiple: s.multiple,
      /** Unfinished answers are kept, with a link back - a flag on the owner's account. */
      partials: await partialsOn(ctx, form.ownerId),
    },
    // A hidden field without the plan is left out entirely.
    blocks: await Promise.all(blocks.filter((b) => b.type !== "hidden" || smart.hidden).map(async (b) => ({
      _id: b._id,
      kind: b.kind,
      type: b.type ?? null,
      title: b.title ?? null,
      help: b.help ?? null,
      placeholder: b.placeholder ?? null,
      required: b.required ?? false,
      options: b.options ?? null,
      accept: b.accept ?? null,
      scaleMin: b.scaleMin ?? null,
      scaleMax: b.scaleMax ?? null,
      maxSeconds: b.type === "voice" ? voiceLength(b.maxSeconds) : null,
      pageName: b.pageName ?? null,
      key: b.key ?? null,
      scores: smart.calc ? (b.scores ?? null) : null,
      defaultValue: b.type === "hidden" ? (b.defaultValue ?? null) : null,
      /** Places left per option; null where an option has no limit. */
      left: advanced ? placesLeft(b, taken) : null,
      extract: smart.ai && b.extract ? { from: b.extract.from } : null,
      /** Quiz: what the question is worth, when it counts. */
      marks: quiz && marked(b) ? (b.marks ?? 1) : null,
      scaleLabels: b.scaleLabels ?? null,
      allowOther: !!b.allowOther,
      validation: b.validation ?? null,
      /** Content blocks: a picture (with its description) or a video link. */
      imageUrl: b.kind === "content" && b.imageId ? await ctx.storage.getUrl(b.imageId) : null,
      alt: b.alt ?? null,
      videoUrl: b.kind === "content" ? (b.videoUrl ?? null) : null,
    }))),
    /** Business: the quiz's settings the form itself needs - never the answers. */
    quiz: quizPublic,
    /** Business: an AI-written reply follows, and where it goes. */
    aiReply:
      form.aiReply?.enabled && (await hasFeature(ctx, form, "ai.reply"))
        ? { delivery: form.aiReply.delivery }
        : null,
    endings: advanced
      ? (form.endings ?? []).map((e) => ({ ...e, redirect: smart.redirect ? e.redirect : undefined }))
      : [],
    logic: rules
      // Rules the owner's plan no longer covers stop, rather than half-working.
      .filter((r) => advanced || (r.action !== "hide-options" && r.action !== "ending"))
      .map((r) => ({
        _id: r._id,
        join: r.join,
        // What an AI condition asks stays with the owner; the form only needs its id.
        conditions: r.conditions.map(publicCondition),
        groups: r.groups?.map((g) => ({ ...g, conditions: g.conditions.map(publicCondition) })) ?? null,
        action: r.action,
        targetId: r.targetId ?? null,
        options: r.options ?? null,
        endingId: r.endingId ?? null,
      })),
  };
}

/**
 * Whether a public link still leads anywhere. An unpublished, archived or
 * deleted form's link is dead: the page sends people to the owner's own
 * domain when they have one (its home lists what is open), and is a 404
 * otherwise. A closed form is still there, saying it is closed.
 */
export const linkState = query({
  args: { slug: v.string(), handle: v.optional(v.string()) },
  handler: async (ctx, { slug, handle }) => {
    const form = await resolve(ctx, slug, handle);
    if (form && (form.status === "published" || form.status === "closed")) {
      // The browser tab and a shared link's card: the form's title as
      // published, its welcome line, and its owner's name, logo and colour.
      const brand = await brandOf(ctx, form);
      const shown = (await servedForm(ctx, form)).form;
      return {
        live: true as const,
        home: null,
        title: shown.title,
        name: brand.name,
        icon: brand.markUrl,
        color: brand.color ?? null,
        about: shown.welcome?.message?.trim().slice(0, 200) || null,
      };
    }
    let owner: { ownerId: Id<"users">; brand: "me" | Id<"companies"> } | null = form
      ? { ownerId: form.ownerId, brand: form.brand }
      : null;
    if (!owner && handle) {
      const claim = await ctx.db
        .query("handles")
        .withIndex("by_value", (q) => q.eq("value", handle))
        .first();
      if (claim) owner = { ownerId: claim.userId, brand: claim.ownerType === "company" && claim.companyId ? claim.companyId : "me" };
    }
    return {
      live: false as const,
      home: owner ? await liveDomainOf(ctx, owner.ownerId, owner.brand) : null,
      title: null,
      name: null,
      icon: null,
      color: null,
      about: null,
    };
  },
});

export const bySlug = query({
  args: { slug: v.string(), handle: v.optional(v.string()), password: v.optional(v.string()) },
  handler: async (ctx, { slug, handle, password }) => {
    const form = await resolve(ctx, slug, handle);
    if (!form) return null;
    if (form.status === "draft" || form.status === "archived") return { state: "draft" as const };

    const closed = form.status === "closed" || shouldAutoClose(form, Date.now());
    if (closed) {
      return {
        state: "closed" as const,
        title: form.title,
        brand: await brandOf(ctx, form),
        logos: await themeLogos(ctx, form.theme),
        theme: form.theme ?? null,
        message: form.closing?.message || CLOSED_NOTE,
      };
    }

    if (!(await passwordMatches(form.security, password))) {
      return {
        state: "locked" as const,
        title: form.title,
        brand: await brandOf(ctx, form),
        logos: await themeLogos(ctx, form.theme),
        theme: form.theme ?? null,
        wrong: !!password,
      };
    }

    return payload(ctx, form);
  },
});

/**
 * The builder's preview: the same form, in whatever state it is in, for
 * anyone who can see the form in the editor.
 */
export const preview = query({
  args: { formId: v.id("forms") },
  handler: async (ctx, { formId }) => {
    const { form } = await accessOf(ctx, formId);
    return {
      ...(await payload(ctx, form, { draft: true })),
      status: form.status,
      url: await formUrl(ctx, form),
    };
  },
});

/**
 * Business: starting a timed quiz. The server keeps the start time, so the
 * limit holds however the browser's clock is set; a late send is marked late.
 */
export const startQuiz = mutation({
  args: { formId: v.id("forms"), deviceId: v.optional(v.string()) },
  returns: v.object({ attemptId: v.id("quizAttempts"), startedAt: v.number(), endsAt: v.union(v.number(), v.null()) }),
  handler: async (ctx, { formId, deviceId }) => {
    const form = await ctx.db.get(formId);
    if (!form || form.status !== "published") throw new ConvexError("That quiz is not open.");
    const quiz = await quizOf(ctx, form);
    if (!quiz) throw new ConvexError("That form is not a quiz.");
    if (!(await allowForm(ctx, "quiz", formId, deviceId, RULES.quizPerForm, RULES.quizPerDevice))) {
      throw new ConvexError("Too many attempts started from here. Try again later.");
    }
    if (quiz.oneAttempt && deviceId) {
      const done = await ctx.db
        .query("responses")
        .withIndex("by_form_device", (q) => q.eq("formId", formId).eq("deviceId", deviceId))
        .collect();
      if (done.some((r) => !r.partial && !r.preview)) throw new ConvexError("You’ve already taken this quiz. It allows one attempt.");
    }
    const startedAt = Date.now();
    const attemptId = await ctx.db.insert("quizAttempts", { formId, startedAt, deviceId });
    return { attemptId, startedAt, endsAt: quiz.timeLimit ? startedAt + quiz.timeLimit * 60_000 : null };
  },
});

/** A view, counted once per opened form. */
export const recordView = mutation({
  args: {
    formId: v.id("forms"),
    started: v.optional(v.boolean()),
    source: v.optional(v.string()),
    deviceId: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, { formId, started, source, deviceId }) => {
    const form = await ctx.db.get(formId);
    if (!form || form.status !== "published") return null;
    // Past the limit a view is simply not counted.
    if (!(await allowForm(ctx, "view", formId, deviceId, RULES.viewsPerForm, RULES.viewsPerDevice))) return null;
    await ctx.db.patch(formId, {
      views: (form.views ?? 0) + (started ? 0 : 1),
      starts: (form.starts ?? 0) + (started ? 1 : 0),
    });
    await ctx.db.insert("formEvents", {
      formId,
      ownerId: form.ownerId,
      kind: started ? "start" : "view",
      at: Date.now(),
      source: source?.slice(0, 80) || undefined,
    });
    return null;
  },
});

/**
 * Where a respondent's upload goes. The cap follows the owner's plan, stated
 * on the field, and is checked when the answer is sent (checkUploads). Only
 * handed out for a form that asks for a file or a recording, and that is
 * either live or open to the caller in the builder (its preview), so the
 * storage is not an open drop box.
 */
export const uploadUrl = mutation({
  args: { formId: v.id("forms"), deviceId: v.optional(v.string()) },
  returns: v.string(),
  handler: async (ctx, { formId, deviceId }) => {
    const form = await ctx.db.get(formId);
    if (!form || form.deletedAt) throw new ConvexError("That form is not here any more.");
    if (form.status !== "published") await formFor(ctx, formId, "read");
    const { blocks } = await servedForm(ctx, form, { draft: form.status !== "published" });
    if (!blocks.some((b) => b.type === "file" || b.type === "voice")) {
      throw new ConvexError("This form does not take uploads.");
    }
    if (!(await allowForm(ctx, "upload", formId, deviceId, RULES.uploadsPerForm, RULES.uploadsPerDevice))) {
      throw new ConvexError("Too many uploads from here for now. Try again later.");
    }
    return await ctx.storage.generateUploadUrl();
  },
});

/**
 * Coming back to a response: a partial the person left, or - when the form
 * allows editing after submit - one they finished.
 */
export const resume = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const row = await ctx.db
      .query("responses")
      .withIndex("by_resume", (q) => q.eq("resumeToken", token))
      .first();
    if (!row || row.preview) return null;

    const form = await ctx.db.get(row.formId);
    if (!form || form.deletedAt) return null;
    if (!row.partial && !securityOf(form.security).editAfter) return null;

    // The resume page has only a token, so it needs the link back as well.
    const identity =
      form.brand === "me"
        ? await ctx.db.get(form.ownerId)
        : await ctx.db.get(form.brand as Id<"companies">);

    return {
      formId: row.formId,
      editing: !row.partial,
      slug: form.slug,
      handle: identity?.handle ?? null,
      answers: row.answers.map((a) => ({
        blockId: a.blockId,
        value: a.value ?? null,
        values: a.values ?? null,
        fileId: a.fileId ?? null,
        fileName: a.fileName ?? null,
      })),
    };
  },
});

const answerArg = v.object({
  blockId: v.id("blocks"),
  value: v.optional(v.string()),
  values: v.optional(v.array(v.string())),
  fileId: v.optional(v.id("_storage")),
  fileName: v.optional(v.string()),
});

type AnswerIn = {
  blockId: Id<"blocks">;
  value?: string;
  values?: string[];
  fileId?: Id<"_storage">;
  fileName?: string;
};

/** Build and store the record; shared by the public link and the preview. */
/** utm_ tags, trimmed, or nothing when none were given. */
function cleanUtm(utm?: { source?: string; medium?: string; campaign?: string; term?: string; content?: string }) {
  if (!utm) return undefined;
  const out: Record<string, string> = {};
  for (const k of ["source", "medium", "campaign", "term", "content"] as const) {
    const v = utm[k]?.trim();
    if (v) out[k] = v.slice(0, 80);
  }
  return Object.keys(out).length ? out : undefined;
}

async function store(
  ctx: MutationCtx,
  live: Doc<"forms">,
  args: {
    partial: boolean;
    device?: string;
    source?: string;
    durationMs?: number;
    deviceId?: string;
    ending?: string;
    attemptId?: Id<"quizAttempts">;
    timedOut?: boolean;
    answers: AnswerIn[];
    utm?: { source?: string; medium?: string; campaign?: string; term?: string; content?: string };
  },
  existing: Doc<"responses"> | null,
  preview: boolean,
) {
  // Everything the response is checked and marked against is the version
  // the person was shown: published, or the draft for a preview.
  const served = await servedForm(ctx, live, { draft: preview });
  const form = served.form;
  const blocks = served.blocks.filter((b) => b.kind === "field");
  const byId = new Map(blocks.map((b) => [b._id as string, b]));

  const answers = args.answers
    .filter((a) => byId.has(a.blockId))
    .map((a) => ({ ...a, question: byId.get(a.blockId)!.title ?? "Question" }));

  // The respondent's name and email come from whichever fields collect them.
  const typed = (t: string) => answers.find((a) => byId.get(a.blockId)!.type === t && a.value);
  const named = typed("name") ?? typed("short-text");
  const mailed = typed("email");
  const phoned = typed("phone");
  const firm = typed("company");

  const record = {
    formId: form._id,
    ownerId: form.ownerId,
    submittedAt: Date.now(),
    partial: args.partial,
    answeredCount: answers.filter((a) => a.value || a.values?.length || a.fileId).length,
    totalCount: blocks.filter((b) => b.type !== "hidden").length,
    answers,
    respondentName: named?.value,
    // An address given to "save and finish later" stays when no email question was answered.
    respondentEmail: mailed?.value?.trim().toLowerCase() || existing?.respondentEmail,
    respondentPhone: phoned?.value?.trim(),
    respondentCompany: firm?.value?.trim(),
    device: args.device,
    source: preview ? "Preview" : args.source,
    utm: preview ? undefined : cleanUtm(args.utm),
    durationMs: args.durationMs,
    status: "new" as const,
    resumeToken: existing?.resumeToken ?? crypto.randomUUID(),
    versionNumber: form.liveVersion,
    deviceId: args.deviceId,
    preview: preview || undefined,
    // Editing an answer keeps what the owner already added to it.
    note: existing?.note,
    tags: existing?.tags,
    // An AI reply already written is kept when the answers are edited.
    aiReply: existing?.aiReply,
    insight: existing?.insight,
    // Only an ending the form actually has.
    ending: args.ending && (form.endings ?? []).some((e) => e.id === args.ending) ? args.ending : undefined,
  };

  // The server's own working-out of the calculations is the one kept.
  const calcVars = form.calc ?? [];
  const calc =
    calcVars.length && (await hasFeature(ctx, form, "logic.calc"))
      ? computeAll(
          calcVars,
          blocks.map((b) => ({ _id: b._id, kind: b.kind, type: b.type, key: b.key, options: b.options, scores: b.scores })),
          Object.fromEntries(answers.map((a) => [a.blockId as string, { value: a.value, values: a.values }])),
        )
      : undefined;
  const withCalc = calc ? { ...record, calc } : record;
  // A payment already made stays made; otherwise work out what is owed now.
  const payment =
    existing?.payment?.status === "paid"
      ? existing.payment
      : !args.partial && !preview
        ? await owed(ctx, form, calc)
        : null;
  const withPay = payment ? { ...withCalc, payment } : withCalc;
  // Business: a quiz is marked as it arrives; written answers wait for the owner.
  const quizOn = !args.partial ? await quizOf(ctx, form) : null;
  const attempt = quizOn && args.attemptId ? await ctx.db.get(args.attemptId) : null;
  const full = quizOn
    ? {
        ...withPay,
        quiz: {
          ...markAll(blocks, answers, quizOn.passMark),
          ...(attempt && attempt.formId === form._id ? { startedAt: attempt.startedAt } : {}),
          timedOut: args.timedOut || undefined,
          late:
            attempt && quizOn.timeLimit && Date.now() > attempt.startedAt + quizOn.timeLimit * 60_000 + LATE_GRACE_MS
              ? true
              : undefined,
        },
      }
    : withPay;
  const searchable = { ...full, searchText: searchTextOf(full), contactKey: contactKeyOf(full) };

  const responseId = existing
    ? (await ctx.db.replace(existing._id, searchable), existing._id)
    : await ctx.db.insert("responses", searchable);
  if (attempt && !attempt.responseId) await ctx.db.patch(attempt._id, { responseId });

  // The form's running totals move by this one response, rather than being
  // counted again from every response the form has ever had.
  await countChange(ctx, form._id, existing ?? null, searchable);
  if (!preview && searchable.contactKey) await notePerson(ctx, form.ownerId, searchable.contactKey, searchable.submittedAt);

  // A response limit closes the form as soon as it is reached.
  const after = await ctx.db.get(form._id);
  if (after && after.status === "published" && shouldAutoClose(after, Date.now())) {
    await ctx.db.patch(form._id, {
      status: "closed",
      closing: { ...(after.closing ?? {}), closedBy: "automatically", closedAt: Date.now() },
    });
    await tellFormTeam(ctx, after, {
      kind: "closed",
      title: `${after.title} closed itself`,
      body: closedReason(after, Date.now()),
      href: `/app/forms/${after._id}`,
      action: "Open the form",
      icon: "lock",
    });
  }

  // Changing a response that was already sent: its integrations hear about
  // the change, and nothing that greets a new response runs again.
  if (!args.partial && !preview && existing && !existing.partial) {
    await ctx.scheduler.runAfter(0, internal.connections.fanout, { responseId, event: "response.updated" });
    return { responseId, resumeToken: record.resumeToken, pay: payment?.status === "pending" };
  }

  if (!args.partial && !preview) {
    const saved = await ctx.db.get(responseId);
    if (saved && after) await notifyResponse(ctx, after, saved);
    // AI logic read this response while it was filled in: it counts once
    // against the company's AI, whether or not a reply is written too.
    if (await usesAiLogic(ctx, form)) await chargeResponse(ctx, form, responseId);
    // The AI reply is queued first, so the confirmation knows to wait for it.
    if (!existing?.aiReply) await queueReply(ctx, form, responseId);
    // Instant quiz results go out by email as soon as the mark is in.
    if (quizOn?.results === "instant" && quizOn.emailResults && "quiz" in full && !full.quiz.pending) {
      await ctx.scheduler.runAfter(0, internal.quiz.emailResult, { responseId });
    }
    await ctx.scheduler.runAfter(0, internal.notifications.onResponse, { responseId });
    await ctx.scheduler.runAfter(0, internal.connections.fanout, { responseId });
  }
  return { responseId, resumeToken: record.resumeToken, pay: payment?.status === "pending" };
}

/** How long a passed Turnstile check can be used to send. */
const PASS_MS = 10 * 60_000;

async function spendPass(ctx: MutationCtx, id: Id<"humanPasses">, formId: Id<"forms">) {
  const pass = await ctx.db.get(id);
  if (!pass || pass.used || pass.formId !== formId || Date.now() - pass.at > PASS_MS) return false;
  await ctx.db.patch(id, { used: true });
  return true;
}

/**
 * Checks a Cloudflare Turnstile token and, when it passes, hands back a
 * one-time pass the submission spends. Null when Turnstile is not set up
 * or the check failed; the form then asks the person to tick a box.
 */
export const verifyHuman = action({
  args: { formId: v.id("forms"), token: v.string() },
  returns: v.union(v.id("humanPasses"), v.null()),
  handler: async (ctx, { formId, token }): Promise<Id<"humanPasses"> | null> => {
    const secret = process.env.TURNSTILE_SECRET_KEY;
    if (!secret || !token) return null;
    try {
      const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ secret, response: token.slice(0, 2048) }).toString(),
        signal: AbortSignal.timeout(8000),
      });
      const out = (await res.json()) as { success?: boolean };
      if (!out.success) return null;
    } catch {
      return null;
    }
    return await ctx.runMutation(internal.publicForm.issuePass, { formId });
  },
});

export const issuePass = internalMutation({
  args: { formId: v.id("forms") },
  returns: v.id("humanPasses"),
  handler: async (ctx, { formId }) => ctx.db.insert("humanPasses", { formId, at: Date.now() }),
});

export const prunePasses = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const old = await ctx.db
      .query("humanPasses")
      .withIndex("by_at", (q) => q.lt("at", Date.now() - 3_600_000))
      .take(1000);
    for (const p of old) await ctx.db.delete(p._id);
    return null;
  },
});

/**
 * The answers checked against the form on the server (model/validate.ts).
 * While the forms.strictAnswers flag is off for the owner, what would be
 * refused is only recorded, so false alarms can be found first.
 */
async function checkAnswers(
  ctx: MutationCtx,
  form: Doc<"forms">,
  args: { partial: boolean; ending?: string; answers: AnswerIn[] },
) {
  const served = await servedForm(ctx, form);
  const advanced = await hasFeature(ctx, form, "logic.advanced");
  const rules = served.rules.filter(
    (r) => r.enabled && (advanced || (r.action !== "hide-options" && r.action !== "ending")),
  );
  const problems = validateAnswers(served.form, served.blocks, rules as unknown as Rule[], args.answers, {
    partial: args.partial,
    ending: args.ending,
  });
  if (!problems.length) return;
  if (await flagOn(ctx, "forms.strictAnswers", form.ownerId)) {
    throw new ConvexError({ code: "invalid", message: problems[0]!.message, blockId: problems[0]!.blockId ?? null });
  }
  await ctx.db.insert("validationLog", {
    formId: form._id,
    at: Date.now(),
    partial: args.partial,
    problems: problems.slice(0, 12).map((p) => ({ code: p.code, ...(p.blockId ? { blockId: p.blockId } : {}) })),
  });
}

/**
 * What log-only checking found in the last `days` days, by kind: the review
 * before switching on forms.strictAnswers. `npx convex run publicForm:validationReport`.
 */
export const validationReport = internalQuery({
  args: { days: v.optional(v.number()) },
  handler: async (ctx, { days }) => {
    const since = Date.now() - (days ?? 7) * 86_400_000;
    const rows = await ctx.db
      .query("validationLog")
      .withIndex("by_at", (q) => q.gt("at", since))
      .take(5000);
    const byCode: Record<string, number> = {};
    const forms = new Set<string>();
    for (const r of rows) {
      forms.add(r.formId);
      for (const p of r.problems) byCode[p.code] = (byCode[p.code] ?? 0) + 1;
    }
    return { submissions: rows.length, forms: forms.size, byCode, latest: rows.slice(-20) };
  },
});

export const pruneValidationLog = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const old = await ctx.db
      .query("validationLog")
      .withIndex("by_at", (q) => q.lt("at", Date.now() - 30 * 86_400_000))
      .take(500);
    for (const r of old) await ctx.db.delete(r._id);
    return null;
  },
});

/**
 * Submitting. A partial is a real record - it keeps what was answered before
 * the person left, and carries a token so they can be sent back to it. The
 * token, not a response id, is what lets a record be replaced.
 */
export const submit = mutation({
  args: {
    formId: v.id("forms"),
    partial: v.boolean(),
    device: v.optional(v.string()),
    source: v.optional(v.string()),
    durationMs: v.optional(v.number()),
    resumeToken: v.optional(v.string()),
    deviceId: v.optional(v.string()),
    password: v.optional(v.string()),
    /** The field only a script fills in. */
    trap: v.optional(v.string()),
    /** The person ticked "I am a person" after being asked. */
    human: v.optional(v.boolean()),
    /** A Turnstile check that passed (verifyHuman), spent by this submission. */
    pass: v.optional(v.id("humanPasses")),
    /** The link's utm_ tags. */
    utm: v.optional(
      v.object({
        source: v.optional(v.string()),
        medium: v.optional(v.string()),
        campaign: v.optional(v.string()),
        term: v.optional(v.string()),
        content: v.optional(v.string()),
      }),
    ),
    /** The ending the person's answers led to, when it was not the default. */
    ending: v.optional(v.string()),
    /** Quiz: the attempt started when the timer began, and whether it ran out. */
    attemptId: v.optional(v.id("quizAttempts")),
    timedOut: v.optional(v.boolean()),
    answers: v.array(answerArg),
  },
  returns: v.object({ responseId: v.id("responses"), resumeToken: v.string(), pay: v.boolean() }),
  handler: async (ctx, args) => {
    const form = await ctx.db.get(args.formId);
    if (!form || form.deletedAt) throw new ConvexError("That form is no longer available.");
    if (form.status !== "published") throw new ConvexError("That form is not accepting answers.");
    if (shouldAutoClose(form, Date.now())) throw new ConvexError("That form has closed.");
    if (!(await passwordMatches(form.security, args.password))) {
      throw new ConvexError("This form needs its password.");
    }

    const s = securityOf(form.security);
    await checkUploads(ctx, form, args.answers);
    if (args.partial && !(await partialsOn(ctx, form.ownerId))) {
      throw new ConvexError("This form does not keep unfinished answers.");
    }
    await checkAnswers(ctx, form, args);

    const existing = args.resumeToken
      ? await ctx.db
          .query("responses")
          .withIndex("by_resume", (q) => q.eq("resumeToken", args.resumeToken!))
          .first()
      : null;
    if (existing && existing.formId !== form._id) throw new ConvexError("That link belongs to another form.");
    if (existing && !existing.partial && !s.editAfter) {
      throw new ConvexError("This form does not allow changing an answer once it is sent.");
    }
    // Leaving the page while changing a sent response saves nothing: what
    // was sent stays sent, rather than turning back into a partial.
    if (existing && !existing.partial && args.partial) {
      return { responseId: existing._id, resumeToken: existing.resumeToken ?? args.resumeToken!, pay: false };
    }
    // A new response, complete or partial, counts against the form's limits;
    // saving more answers into one already started does not.
    if (
      !existing &&
      !(await allowForm(ctx, "response", form._id, args.deviceId, RULES.responsesPerForm, RULES.responsesPerDevice))
    ) {
      throw new ConvexError("This form is taking a lot of answers right now. Try again in a minute.");
    }

    if (!args.partial) {
      if (s.spam) {
        if (args.trap) throw new ConvexError("That did not send. Try again in a moment.");
        const fast = (args.durationMs ?? Number.POSITIVE_INFINITY) < TOO_FAST_MS;
        // With Turnstile set up, a submission either carries a pass from it,
        // or the person ticks the box (when Turnstile could not run for them).
        const turnstile = !!process.env.TURNSTILE_SECRET_KEY;
        const proven = !!args.pass && (await spendPass(ctx, args.pass, form._id));
        if (!proven && !args.human && !existing && (turnstile || fast)) {
          throw new ConvexError({ code: "prove", message: "Tick the box to show you are a person." });
        }
      }

      if (s.rateLimit && args.deviceId && !existing) {
        const recent = await ctx.db
          .query("responses")
          .withIndex("by_form_device", (q) => q.eq("formId", form._id).eq("deviceId", args.deviceId))
          .collect();
        if (recent.some((r) => !r.partial && Date.now() - r.submittedAt < RATE_MS)) {
          throw new ConvexError("One submission a minute from each device. Try again in a moment.");
        }
      }

      const { blocks } = await servedForm(ctx, form);
      const emailIds = new Set(blocks.filter((b) => b.type === "email").map((b) => b._id as string));
      const email = args.answers
        .find((a) => emailIds.has(a.blockId) && a.value?.trim())
        ?.value?.trim()
        .toLowerCase();

      // Limited places: a place is only taken if it is still free when sent.
      if (blocks.some(hasLimits) && (await hasFeature(ctx, form, "logic.advanced"))) {
        const taken = await placesTaken(ctx, form._id, blocks, existing?._id);
        for (const a of args.answers) {
          const b = blocks.find((x) => x._id === a.blockId);
          if (!b || !hasLimits(b)) continue;
          const left = placesLeft(b, taken) ?? [];
          for (const picked of a.values ?? (a.value ? [a.value] : [])) {
            const i = (b.options ?? []).indexOf(picked);
            if (i >= 0 && left[i] !== null && left[i]! <= 0) {
              throw new ConvexError(`“${picked}” has just filled up. Pick another and send again.`);
            }
          }
        }
      }

      if (s.requireEmail && !email) {
        throw new ConvexError("This form needs your email address before it can be sent.");
      }

      if (!s.multiple && !existing) {
        if (await answeredBefore(ctx, form._id, args.deviceId, email)) {
          throw new ConvexError("You have already answered this form. Thank you.");
        }
      }

      // Business: a quiz taken once per person - by device and by email.
      const quiz = await quizOf(ctx, form);
      if (quiz && existing && !existing.partial) throw new ConvexError("Answers to a quiz can’t be changed once sent.");
      if (quiz?.oneAttempt && !existing) {
        if (await answeredBefore(ctx, form._id, args.deviceId, email)) {
          throw new ConvexError("You’ve already taken this quiz. It allows one attempt.");
        }
      }
    }

    return store(ctx, form, args, existing, false);
  },
});

/**
 * The builder's preview sends through the real form too - the answers land in
 * the inbox marked as a preview - whatever state the form is in.
 */
export const submitPreview = mutation({
  args: {
    formId: v.id("forms"),
    device: v.optional(v.string()),
    durationMs: v.optional(v.number()),
    ending: v.optional(v.string()),
    answers: v.array(answerArg),
  },
  returns: v.object({ responseId: v.id("responses"), resumeToken: v.string(), pay: v.boolean() }),
  handler: async (ctx, args) => {
    const { form } = await accessOf(ctx, args.formId);
    return store(ctx, form, { ...args, partial: false }, null, true);
  },
});

/**
 * "Save and finish later": the person leaves an email address on a form
 * they started, and gets their own link back to it. The response must be
 * a partial they hold the token for; once every two minutes at most.
 */
export const emailResumeLink = mutation({
  args: { formId: v.id("forms"), resumeToken: v.string(), email: v.string() },
  returns: v.null(),
  handler: async (ctx, { formId, resumeToken, email }) => {
    const to = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(to) || to.length > 254) {
      throw new ConvexError("That does not look like an email address.");
    }
    const r = await ctx.db
      .query("responses")
      .withIndex("by_resume", (q) => q.eq("resumeToken", resumeToken))
      .first();
    if (!r || r.formId !== formId || !r.partial) throw new ConvexError("Those answers are not saved any more.");
    if (r.resumeEmailedAt && Date.now() - r.resumeEmailedAt < 2 * 60_000) {
      throw new ConvexError("We have just sent it. Give it a minute, then check your spam folder.");
    }
    await ctx.db.patch(r._id, { resumeEmailedAt: Date.now(), ...(r.respondentEmail ? {} : { respondentEmail: to }) });
    await ctx.scheduler.runAfter(0, internal.publicForm.mailResumeLink, { responseId: r._id, to });
    return null;
  },
});

export const resumeMail = internalQuery({
  args: { responseId: v.id("responses") },
  handler: async (ctx, { responseId }) => {
    const r = await ctx.db.get(responseId);
    const form = r && (await ctx.db.get(r.formId));
    if (!r?.resumeToken || !form) return null;
    return { title: form.title, token: r.resumeToken, brand: await brandOf(ctx, form) };
  },
});

export const mailResumeLink = internalAction({
  args: { responseId: v.id("responses"), to: v.string() },
  returns: v.null(),
  handler: async (ctx, { responseId, to }) => {
    const m: { title: string; token: string; brand: { name: string; logoUrl: string | null; color: string | null; badge: boolean } } | null =
      await ctx.runQuery(internal.publicForm.resumeMail, { responseId });
    if (!m) return null;
    const site = (process.env.SITE_URL ?? "https://formkit.app").replace(/\/$/, "");
    const link = `${site}/r/${m.token}`;
    await send({
      to: [to],
      subject: `Finish ${m.title} when you are ready`,
      html: renderResumeLink({ title: m.title, link, brand: m.brand }),
      text: `Everything you answered so far on ${m.title} is saved. Carry on here: ${link}\n\nAnyone with this link can see and change your answers, so keep it to yourself.`,
    });
    return null;
  },
});
