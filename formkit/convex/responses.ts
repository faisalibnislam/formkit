import { moneyText } from "./model/money";
import { isAudio } from "./model/voice";
import { v } from "convex/values";
import { internalMutation, mutation, query, type QueryCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { requireUser } from "./model/identity";
import { formFor, ownersOf } from "./model/forms";
import { currentSpace, spaceForms } from "./model/spaces";
import { searchTextOf } from "./model/responseSearch";
import { countChange } from "./model/responseCounts";
import { contactKeyOf, contactOf, notePerson, type Contact } from "./model/contacts";

/**
 * The response inbox.
 *
 * Partial responses are kept and counted separately: they are excluded from the
 * Completed stat, filtered by the All / Complete / Partial control, badged on
 * their own, and carry a resume link the owner can send back.
 *
 * A response sent from the builder's preview is kept too, badged Preview, and
 * left out of every count - it is the owner trying their own form, not an
 * answer.
 */

const DAY = 24 * 60 * 60 * 1000;
const MAX_TAGS = 12;

/** Every response in scope - one form, or every form in the company being worked in. */
async function scope(ctx: QueryCtx, formId: Id<"forms"> | undefined) {
  const user = await requireUser(ctx);
  const space = await currentSpace(ctx, user);
  if (formId) {
    const form = await formFor(ctx, formId, "read");
    const rows = await ctx.db
      .query("responses")
      .withIndex("by_form", (q) => q.eq("formId", formId))
      .collect();
    return { forms: [form], rows };
  }
  const forms = (await spaceForms(ctx, space)).filter((f) => !f.deletedAt);
  const live = new Set(forms.map((f) => f._id as string));
  const rows = (
    await ctx.db
      .query("responses")
      .withIndex("by_owner", (q) => q.eq("ownerId", space.ownerId))
      .collect()
  ).filter((r) => live.has(r.formId));
  return { forms, rows };
}

function answerText(a: Doc<"responses">["answers"][number]) {
  return a.value ?? (a.values ? a.values.join(", ") : null);
}

async function shape(ctx: QueryCtx, r: Doc<"responses">, formTitle: string) {
  const files = await Promise.all(
    r.answers
      .filter((a) => a.fileId)
      .map(async (a) => {
        const meta = await ctx.db.system.get(a.fileId!);
        return {
          blockId: a.blockId,
          name: a.fileName ?? "attachment",
          url: await ctx.storage.getUrl(a.fileId!),
          /** A voice recording, played in place rather than only downloaded. */
          audio: isAudio(meta?.contentType),
        };
      }),
  );
  return {
    _id: r._id,
    formId: r.formId,
    formTitle,
    submittedAt: r.submittedAt,
    partial: r.partial,
    preview: !!r.preview,
    answeredCount: r.answeredCount,
    totalCount: r.totalCount,
    answers: r.answers.map((a) => ({
      blockId: a.blockId,
      question: a.question,
      value: answerText(a),
      fileName: a.fileName ?? null,
    })),
    files,
    respondentName: r.respondentName ?? null,
    respondentEmail: r.respondentEmail ?? null,
    respondentPhone: r.respondentPhone ?? null,
    respondentCompany: r.respondentCompany ?? null,
    device: r.device ?? null,
    source: r.source ?? null,
    durationMs: r.durationMs ?? null,
    status: r.status,
    note: r.note ?? null,
    tags: r.tags ?? [],
    versionNumber: r.versionNumber ?? null,
    resumeToken: r.partial ? (r.resumeToken ?? null) : null,
    /** Pro: the form's calculations, as worked out when it was sent. */
    calc: r.calc ?? null,
    /** Pro: the payment taken after sending, amount in minor units. */
    payment: r.payment ? { status: r.payment.status, amount: r.payment.amount, currency: r.payment.currency, at: r.payment.at ?? null } : null,
    /** Which of the form's endings they reached, when not the usual one. */
    ending: r.ending ?? null,
    /** Business: the AI-written reply and what the AI read in the response. */
    aiReply: r.aiReply
      ? {
          status: r.aiReply.status,
          subject: r.aiReply.subject ?? null,
          text: r.aiReply.text ?? null,
          reason: r.aiReply.reason ?? null,
          at: r.aiReply.at ?? null,
          emailedAt: r.aiReply.emailedAt ?? null,
          emailState: r.aiReply.emailState ?? null,
          rating: r.aiReply.rating ?? null,
          needsHuman: !!r.aiReply.needsHuman,
          edited: !!r.aiReply.edited,
        }
      : null,
    insight: r.insight ?? null,
    /** Business: the quiz mark, when the form is a quiz. */
    quiz: r.quiz
      ? {
          score: r.quiz.score,
          max: r.quiz.max,
          percent: r.quiz.percent,
          passed: r.quiz.passed ?? null,
          pending: r.quiz.pending,
          timedOut: !!r.quiz.timedOut,
          late: !!r.quiz.late,
          marks: r.quiz.marks.map((m) => ({ blockId: m.blockId, got: m.got, max: m.max, manual: !!m.manual })),
        }
      : null,
  };
}

/** Midnight today, in the server's clock; the client labels days itself. */
function startOfToday(now: number) {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** How many rows the inbox shows at most, however far "Load more" is pressed. */
const MAX_ROWS = 1000;
/** Rows read to fill one request, at most; beyond it the inbox offers "Load more". */
const SCAN_CAP = 4000;
/** Recent responses read for Today and This week, at most. */
const RECENT_CAP = 3000;
/** Unread and preview responses counted, at most; above it the count shows as "1,000+". */
const COUNT_CAP = 1000;

const scopeArgs = {
  /** One form: the editor's Responses tab. */
  formId: v.optional(v.id("forms")),
  /** Some of the company's forms: one picked, or one owner's. */
  forms: v.optional(v.array(v.id("forms"))),
};

/**
 * The forms the inbox is looking at, and every form it could look at (for its
 * pickers): one form, or the company being worked in, narrowed to `picked`.
 */
async function inboxForms(ctx: QueryCtx, formId: Id<"forms"> | undefined, picked: Id<"forms">[] | undefined) {
  if (formId) {
    const form = await formFor(ctx, formId, "read");
    return { ownerId: form.ownerId, all: [form], forms: [form] };
  }
  const user = await requireUser(ctx);
  const space = await currentSpace(ctx, user);
  const all = (await spaceForms(ctx, space)).filter((f) => !f.deletedAt);
  const wanted = picked ? new Set<string>(picked) : null;
  return { ownerId: space.ownerId, all, forms: wanted ? all.filter((f) => wanted.has(f._id)) : all };
}

/** Reads `source` until `limit` rows pass `keep`, or SCAN_CAP rows have been read. */
async function gather(source: AsyncIterable<Doc<"responses">>, keep: (r: Doc<"responses">) => boolean, limit: number) {
  const rows: Doc<"responses">[] = [];
  let read = 0;
  for await (const r of source) {
    if (++read > SCAN_CAP) return { rows, more: true };
    if (!keep(r)) continue;
    if (rows.length === limit) return { rows, more: true };
    rows.push(r);
  }
  return { rows, more: false };
}

/** Counts rows passing `keep`, reading at most `cap`; `more` when it stopped short. */
async function countUpTo(source: AsyncIterable<Doc<"responses">>, keep: (r: Doc<"responses">) => boolean, cap: number) {
  let n = 0;
  let read = 0;
  for await (const r of source) {
    if (++read > cap) return { n, more: true };
    if (keep(r)) n += 1;
  }
  return { n, more: false };
}

/**
 * The inbox's list: newest (or oldest) first, filtered on the server, and
 * only as many as it shows. "Load more" asks again with a higher limit. A
 * search returns the best matches, then puts them in date order.
 */
export const rows = query({
  args: {
    ...scopeArgs,
    kind: v.union(v.literal("all"), v.literal("complete"), v.literal("partial"), v.literal("preview")),
    search: v.optional(v.string()),
    order: v.union(v.literal("desc"), v.literal("asc")),
    limit: v.number(),
  },
  handler: async (ctx, args) => {
    const { ownerId, forms } = await inboxForms(ctx, args.formId, args.forms);
    if (!forms.length) return { rows: [], more: false };
    const titles = new Map(forms.map((f) => [f._id as string, f.title]));
    const limit = Math.max(1, Math.min(MAX_ROWS, Math.floor(args.limit)));
    const preview = args.kind === "preview";
    const keep = (r: Doc<"responses">) =>
      titles.has(r.formId) &&
      !!r.preview === preview &&
      (args.kind === "partial" ? r.partial : args.kind === "complete" ? !r.partial : true);
    const single = forms.length === 1 ? forms[0]! : null;
    const term = args.search?.trim().slice(0, 100);

    const source = term
      ? ctx.db.query("responses").withSearchIndex("search", (q) => {
          const found = q.search("searchText", term).eq("ownerId", ownerId);
          return single ? found.eq("formId", single._id) : found;
        })
      : single
        ? ctx.db
            .query("responses")
            .withIndex("by_form_preview_submitted", (q) =>
              q.eq("formId", single._id).eq("preview", preview ? true : undefined),
            )
            .order(args.order)
        : ctx.db
            .query("responses")
            .withIndex("by_owner_preview_submitted", (q) =>
              q.eq("ownerId", ownerId).eq("preview", preview ? true : undefined),
            )
            .order(args.order);

    const { rows: found, more } = await gather(source, keep, limit);
    if (term) found.sort((a, b) => (args.order === "asc" ? a.submittedAt - b.submittedAt : b.submittedAt - a.submittedAt));
    return {
      rows: await Promise.all(found.map((r) => shape(ctx, r, titles.get(r.formId) ?? "A form"))),
      more,
    };
  },
});

/**
 * The inbox's figures and pickers. Completed and Partial come from the
 * counts kept on each form; Today, This week, Unread and Previews are counted
 * from an index, up to a ceiling, and say so (`more`) when they reach it.
 */
export const summary = query({
  args: scopeArgs,
  handler: async (ctx, { formId, forms: picked }) => {
    const { ownerId, all, forms } = await inboxForms(ctx, formId, picked);
    const ids = new Set<string>(forms.map((f) => f._id));
    const owners = await ownersOf(ctx, all);
    const single = forms.length === 1 ? forms[0]! : null;
    const mine = (r: Doc<"responses">) => ids.has(r.formId);

    const now = Date.now();
    const today = startOfToday(now);
    const week = now - 7 * DAY;
    const since = Math.min(today - DAY, week - 7 * DAY);
    const recent = single
      ? ctx.db
          .query("responses")
          .withIndex("by_form_preview_submitted", (q) =>
            q.eq("formId", single._id).eq("preview", undefined).gte("submittedAt", since),
          )
          .order("desc")
      : ctx.db
          .query("responses")
          .withIndex("by_owner_preview_submitted", (q) =>
            q.eq("ownerId", ownerId).eq("preview", undefined).gte("submittedAt", since),
          )
          .order("desc");
    let inToday = 0;
    let inYesterday = 0;
    let inWeek = 0;
    let inLastWeek = 0;
    let read = 0;
    let recentMore = false;
    for await (const r of recent) {
      if (++read > RECENT_CAP) {
        recentMore = true;
        break;
      }
      if (!mine(r)) continue;
      if (r.submittedAt >= today) inToday += 1;
      else if (r.submittedAt >= today - DAY) inYesterday += 1;
      if (r.submittedAt >= week) inWeek += 1;
      else if (r.submittedAt >= week - 7 * DAY) inLastWeek += 1;
    }

    const unread = await countUpTo(
      single
        ? ctx.db.query("responses").withIndex("by_form_status", (q) => q.eq("formId", single._id).eq("status", "new"))
        : ctx.db.query("responses").withIndex("by_owner_status", (q) => q.eq("ownerId", ownerId).eq("status", "new")),
      (r) => mine(r) && !r.partial && !r.preview,
      COUNT_CAP,
    );
    const previews = await countUpTo(
      single
        ? ctx.db
            .query("responses")
            .withIndex("by_form_preview_submitted", (q) => q.eq("formId", single._id).eq("preview", true))
        : ctx.db
            .query("responses")
            .withIndex("by_owner_preview_submitted", (q) => q.eq("ownerId", ownerId).eq("preview", true)),
      mine,
      COUNT_CAP,
    );

    const total = forms.reduce((n, f) => n + f.responsesCount, 0);
    const completed = forms.reduce((n, f) => n + f.completedCount, 0);
    const pct = (a: number, b: number) => (b === 0 ? null : Math.round(((a - b) / b) * 100));
    return {
      stats: {
        total,
        // Partials are excluded from Completed, deliberately.
        completed,
        partial: Math.max(0, total - completed),
        today: inToday,
        todayChange: recentMore ? null : inToday - inYesterday,
        week: inWeek,
        weekChange: recentMore ? null : pct(inWeek, inLastWeek),
        unread: unread.n,
        previews: previews.n,
        /** Which figures stopped at their ceiling, to be shown as "n+". */
        more: { week: recentMore, unread: unread.more, previews: previews.more },
      },
      forms: [...all]
        .sort((a, b) => b.updatedAt - a.updatedAt)
        .map((f) => ({ _id: f._id, title: f.title, owner: owners.get(f._id)! })),
    };
  },
});

/**
 * The dashboard's slice: completed and partial totals, from the counts kept on
 * each form, and the newest few responses. `list` reads every response a
 * person has ever had; this reads a handful.
 */
export const recent = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit = 6 }) => {
    const user = await requireUser(ctx);
    const space = await currentSpace(ctx, user);
    const forms = (await spaceForms(ctx, space)).filter((f) => !f.deletedAt);
    const titles = new Map(forms.map((f) => [f._id as string, f.title]));
    // Newest first, stopping at the first response from before this week -
    // the week's count and the latest few come from one short walk.
    const since = Date.now() - 7 * DAY;
    const newest: Doc<"responses">[] = [];
    let week = 0;
    for await (const r of ctx.db
      .query("responses")
      .withIndex("by_owner", (q) => q.eq("ownerId", space.ownerId))
      .order("desc")) {
      // A partial saved earlier can be finished later, so allow a day's slack.
      if (r._creationTime < since - DAY && newest.length >= limit) break;
      if (r.preview || !titles.has(r.formId)) continue;
      if (r.submittedAt >= since) week += 1;
      if (newest.length < limit * 4) newest.push(r);
    }
    const rows = newest.sort((a, b) => b.submittedAt - a.submittedAt).slice(0, limit);
    const completed = forms.reduce((n, f) => n + f.completedCount, 0);
    return {
      stats: {
        total: forms.reduce((n, f) => n + f.responsesCount, 0),
        completed,
        partial: forms.reduce((n, f) => n + Math.max(0, f.responsesCount - f.completedCount), 0),
        week,
      },
      responses: await Promise.all(rows.map((r) => shape(ctx, r, titles.get(r.formId) ?? "A form"))),
    };
  },
});

export const get = query({
  args: { responseId: v.id("responses") },
  handler: async (ctx, { responseId }) => {
    const response = await ctx.db.get(responseId);
    if (!response) return null;
    const form = await formFor(ctx, response.formId, "read");
    return shape(ctx, response, form.title);
  },
});

/** Contacts shown at most, however far "Load more" is pressed. */
const MAX_CONTACTS = 1000;
/** People looked at to fill one request, at most; beyond it the tab offers "Load more". */
const PEOPLE_SCAN = 3000;

/**
 * The Contacts tab: people newest first, each built from their own
 * responses (model/contacts.ts), only as many as are shown. A search finds
 * responses through the search index and lists the people behind them.
 */
async function listContacts(
  ctx: QueryCtx,
  { formId, search, limit }: { formId?: Id<"forms">; search?: string; limit: number },
) {
  let ownerId: Id<"users">;
  let forms: Doc<"forms">[];
  if (formId) {
    const form = await formFor(ctx, formId, "read");
    ownerId = form.ownerId;
    forms = [form];
  } else {
    const user = await requireUser(ctx);
    const space = await currentSpace(ctx, user);
    ownerId = space.ownerId;
    forms = (await spaceForms(ctx, space)).filter((f) => !f.deletedAt);
  }
  const titles = new Map(forms.map((f) => [f._id as string, f.title]));
  const want = Math.max(1, Math.min(MAX_CONTACTS, Math.floor(limit)));
  const people: Contact[] = [];
  const seen = new Set<string>();
  let looked = 0;

  const keys: AsyncIterable<string> = search?.trim()
    ? (async function* () {
        const term = search.trim().slice(0, 100);
        for await (const r of ctx.db
          .query("responses")
          .withSearchIndex("search", (q) => q.search("searchText", term).eq("ownerId", ownerId))) {
          if (r.contactKey && !r.preview && titles.has(r.formId)) yield r.contactKey;
        }
      })()
    : formId
      ? (async function* () {
          // One form's people: straight from its own responses, newest first.
          for await (const r of ctx.db
            .query("responses")
            .withIndex("by_form_submitted", (q) => q.eq("formId", formId))
            .order("desc")) {
            if (r.contactKey && !r.preview) yield r.contactKey;
          }
        })()
      : (async function* () {
          for await (const p of ctx.db
            .query("people")
            .withIndex("by_owner_last", (q) => q.eq("ownerId", ownerId))
            .order("desc")) {
            yield p.key;
          }
        })();

  for await (const key of keys) {
    if (seen.has(key)) continue;
    seen.add(key);
    if (++looked > PEOPLE_SCAN) return { people, more: true };
    const c = await contactOf(ctx, ownerId, key, titles);
    if (!c) continue;
    if (people.length === want) return { people, more: true };
    people.push(c);
  }
  if (search?.trim()) people.sort((a, b) => b.last - a.last);
  return { people, more: false };
}

export const contacts = query({
  args: { search: v.optional(v.string()), limit: v.number() },
  handler: (ctx, args) => listContacts(ctx, args),
});

export const setStatus = mutation({
  args: {
    ids: v.array(v.id("responses")),
    status: v.union(v.literal("new"), v.literal("read"), v.literal("reviewed")),
  },
  returns: v.null(),
  handler: async (ctx, { ids, status }) => {
    for (const id of ids) {
      const r = await ctx.db.get(id);
      if (!r) continue;
      await formFor(ctx, r.formId, "read");
      await ctx.db.patch(id, { status });
    }
    return null;
  },
});

export const addNote = mutation({
  args: { responseId: v.id("responses"), note: v.string() },
  returns: v.null(),
  handler: async (ctx, { responseId, note }) => {
    const r = await ctx.db.get(responseId);
    if (!r) throw new Error("That response no longer exists.");
    await formFor(ctx, r.formId, "read");
    await ctx.db.patch(responseId, { note: note.trim() || undefined });
    return null;
  },
});

/** Labels are trimmed, kept short, and never repeated on one response. */
export const setTags = mutation({
  args: { responseId: v.id("responses"), tags: v.array(v.string()) },
  returns: v.null(),
  handler: async (ctx, { responseId, tags }) => {
    const r = await ctx.db.get(responseId);
    if (!r) throw new Error("That response no longer exists.");
    await formFor(ctx, r.formId, "read");
    const clean: string[] = [];
    for (const t of tags) {
      const tag = t.trim().replace(/\s+/g, " ").slice(0, 32);
      if (tag && !clean.some((c) => c.toLowerCase() === tag.toLowerCase())) clean.push(tag);
    }
    const next = clean.length ? clean.slice(0, MAX_TAGS) : undefined;
    await ctx.db.patch(responseId, { tags: next, searchText: searchTextOf({ ...r, tags: next }) });
    return null;
  },
});

/** How far back the drawer looks for labels to offer again. */
const TAGS_FROM_LATEST = 1000;

/** Tags already in use on recent responses, most used first, for the drawer to offer again. */
export const tagsInUse = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    const space = await currentSpace(ctx, user);
    const rows = await ctx.db
      .query("responses")
      .withIndex("by_owner_submitted", (q) => q.eq("ownerId", space.ownerId))
      .order("desc")
      .take(TAGS_FROM_LATEST);
    const seen = new Map<string, number>();
    for (const r of rows) for (const t of r.tags ?? []) seen.set(t, (seen.get(t) ?? 0) + 1);
    return [...seen.entries()].sort((a, b) => b[1] - a[1]).map(([t]) => t);
  },
});

/** Bulk delete keeps the owning form's counts honest. */
export const remove = mutation({
  args: { ids: v.array(v.id("responses")) },
  returns: v.null(),
  handler: async (ctx, { ids }) => {
    for (const id of ids) {
      const r = await ctx.db.get(id);
      if (!r) continue;
      await formFor(ctx, r.formId, "read");
      await ctx.db.delete(id);
      await countChange(ctx, r.formId, r, null);
    }
    return null;
  },
});

/** Preview answers are the owner testing; they never count. */
export const recount = internalMutation({
  args: { formId: v.id("forms") },
  returns: v.null(),
  handler: async (ctx, { formId }) => {
    const rows = (
      await ctx.db
        .query("responses")
        .withIndex("by_form", (q) => q.eq("formId", formId))
        .collect()
    ).filter((r) => !r.preview);
    await ctx.db.patch(formId, {
      responsesCount: rows.length,
      completedCount: rows.filter((r) => !r.partial).length,
    });
    return null;
  },
});

function fmtDate(at: number) {
  return new Date(at).toISOString().replace("T", " ").slice(0, 16);
}

/**
 * The rows behind every export: one form or every form, the ticked rows or a
 * date range. Across several forms the question columns are the union of their
 * questions, matched by wording, in the order they first appear.
 */
export const forExport = query({
  args: {
    formId: v.optional(v.id("forms")),
    ids: v.optional(v.array(v.id("responses"))),
    from: v.optional(v.number()),
    to: v.optional(v.number()),
    includePartial: v.optional(v.boolean()),
    includePreview: v.optional(v.boolean()),
  },
  handler: async (ctx, { formId, ids, from, to, includePartial = true, includePreview = false }) => {
    const { forms, rows } = await scope(ctx, formId);
    const titles = new Map(forms.map((f) => [f._id as string, f.title]));
    const wanted = ids ? new Set(ids as string[]) : null;
    const picked = rows
      .filter((r) => (wanted ? wanted.has(r._id) : true))
      .filter((r) => (includePartial ? true : !r.partial))
      .filter((r) => (includePreview || wanted ? true : !r.preview))
      .filter((r) => (from === undefined ? true : r.submittedAt >= from))
      .filter((r) => (to === undefined ? true : r.submittedAt < to))
      .sort((a, b) => a.submittedAt - b.submittedAt);

    // Question order follows the form, so read the blocks of every form used.
    const questions: string[] = [];
    const seen = new Set<string>();
    const formIds = [...new Set(picked.map((r) => r.formId as string))];
    if (formId && !formIds.includes(formId)) formIds.push(formId);
    for (const id of formIds) {
      const blocks = (
        await ctx.db
          .query("blocks")
          .withIndex("by_form_order", (q) => q.eq("formId", id as Id<"forms">))
          .collect()
      )
        .filter((b) => b.kind === "field")
        .sort((a, b) => a.order - b.order);
      for (const b of blocks) {
        const title = (b.title ?? "Question").trim();
        if (!seen.has(title.toLowerCase())) {
          seen.add(title.toLowerCase());
          questions.push(title);
        }
      }
    }
    // Answers to questions since removed from the form still export.
    for (const r of picked)
      for (const a of r.answers)
        if (!seen.has(a.question.trim().toLowerCase())) {
          seen.add(a.question.trim().toLowerCase());
          questions.push(a.question.trim());
        }

    // Calculation results get a column each, after the questions.
    const calcNames = [...new Set(picked.flatMap((r) => Object.keys(r.calc ?? {})))];
    const paid = picked.some((r) => r.payment);
    const quizzed = picked.some((r) => r.quiz);
    const replied = picked.some((r) => r.aiReply?.text || r.insight);

    const many = !formId;
    const columns = [
      ...(many ? ["Form"] : []),
      "Submitted",
      "Status",
      "Complete",
      "Name",
      "Email",
      "Phone",
      "Company",
      "Source",
      "Device",
      "Tags",
      "Note",
      ...questions,
      ...calcNames,
      ...(paid ? ["Payment"] : []),
      ...(quizzed ? ["Score", "Out of", "Percent", "Result", "To mark"] : []),
      ...(replied ? ["Sentiment", "Lead score", "Urgency", "AI summary", "AI reply"] : []),
    ];
    // Uploaded files and voice recordings go out as links to the file.
    const links = new Map<string, string>();
    for (const r of picked)
      for (const a of r.answers)
        if (a.fileId && !links.has(a.fileId)) {
          const url = await ctx.storage.getUrl(a.fileId);
          if (url) links.set(a.fileId, url);
        }

    const slug = formId ? (forms[0]?.slug ?? "form") : "all-forms";
    return {
      filename: `${slug}-responses`,
      title: formId ? (forms[0]?.title ?? "Responses") : "All forms",
      columns,
      rows: picked.map((r) => {
        const byQuestion = new Map(r.answers.map((a) => [a.question.trim().toLowerCase(), a]));
        return [
          ...(many ? [titles.get(r.formId) ?? ""] : []),
          fmtDate(r.submittedAt),
          r.preview ? "preview" : r.status,
          r.partial ? "Partial" : "Complete",
          r.respondentName ?? "",
          r.respondentEmail ?? "",
          r.respondentPhone ?? "",
          r.respondentCompany ?? "",
          r.source ?? "",
          r.device ?? "",
          (r.tags ?? []).join(", "),
          r.note ?? "",
          ...questions.map((q) => {
            const a = byQuestion.get(q.toLowerCase());
            if (!a) return "";
            if (a.values) return a.values.join("; ");
            if (a.fileId) return links.get(a.fileId) ?? a.fileName ?? "";
            return a.fileName ?? a.value ?? "";
          }),
          ...calcNames.map((n) => (r.calc && n in r.calc ? String(r.calc[n]) : "")),
          ...(paid ? [r.payment ? `${r.payment.status} · ${moneyText(r.payment.amount, r.payment.currency)}` : ""] : []),
          ...(quizzed
            ? r.quiz
              ? [
                  String(r.quiz.score),
                  String(r.quiz.max),
                  `${r.quiz.percent}%`,
                  r.quiz.passed === undefined ? "" : r.quiz.passed ? "Pass" : "Fail",
                  r.quiz.pending ? String(r.quiz.pending) : "",
                ]
              : ["", "", "", "", ""]
            : []),
          ...(replied
            ? [
                r.insight?.sentiment ?? "",
                r.insight?.score === undefined ? "" : String(r.insight.score),
                r.insight?.urgency ?? "",
                r.insight?.summary ?? "",
                r.aiReply?.text ?? "",
              ]
            : []),
        ];
      }),
    };
  },
});

/** The contacts list as a sheet, in the same shape the Contacts tab shows. */
export const contactsForExport = query({
  args: { formId: v.optional(v.id("forms")) },
  handler: async (ctx, { formId }) => {
    const { people } = await listContacts(ctx, { formId, limit: MAX_CONTACTS });
    return {
      filename: "contacts",
      columns: ["Name", "Email", "Phone", "Company", "Tags", "Source", "Created", "Responses"],
      rows: people.map((c) => [
        c.name ?? "",
        c.email ?? "",
        c.phone ?? "",
        c.company ?? "",
        c.tags.join(", "),
        c.source,
        fmtDate(c.created),
        String(c.responses),
      ]),
    };
  },
});

/** How many responses an export would hold - Settings → Exports says so. */
export const count = query({
  args: {
    formId: v.optional(v.id("forms")),
    from: v.optional(v.number()),
    includePartial: v.optional(v.boolean()),
  },
  handler: async (ctx, { formId, from, includePartial = true }) => {
    const { rows } = await scope(ctx, formId);
    return rows.filter(
      (r) => !r.preview && (includePartial || !r.partial) && (from === undefined || r.submittedAt >= from),
    ).length;
  },
});

/** For the Responses tab in the header dock: complete answers nobody has opened. */
export const unreadCount = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    // Only the unread rows are read, not every response the company has.
    const space = await currentSpace(ctx, user);
    const forms = new Set((await spaceForms(ctx, space)).filter((f) => !f.deletedAt).map((f) => f._id as string));
    const rows = await ctx.db
      .query("responses")
      .withIndex("by_owner_status", (q) => q.eq("ownerId", space.ownerId).eq("status", "new"))
      .collect();
    return rows.filter((r) => !r.partial && !r.preview && forms.has(r.formId)).length;
  },
});

const BACKFILL_PAGE = 200;

/**
 * Writes searchText on responses saved before the inbox searched on the
 * server, a page at a time, each page scheduling the next. Started by a cron
 * until it has been through every response; after that a run is one read.
 */
export const backfillSearch = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const job = await ctx.db
      .query("jobs")
      .withIndex("by_key", (q) => q.eq("key", "responseSearch"))
      .unique();
    if (job?.done) return null;
    const page = await ctx.db.query("responses").paginate({ numItems: BACKFILL_PAGE, cursor: job?.cursor ?? null });
    for (const r of page.page) {
      if (r.searchText === undefined) await ctx.db.patch(r._id, { searchText: searchTextOf(r) });
    }
    const next = { key: "responseSearch", cursor: page.continueCursor, done: page.isDone, at: Date.now() };
    if (job) await ctx.db.replace(job._id, next);
    else await ctx.db.insert("jobs", next);
    if (!page.isDone) await ctx.scheduler.runAfter(0, internal.responses.backfillSearch, {});
    return null;
  },
});

/**
 * Gives responses saved before contacts were kept their contact key, and
 * notes each person, a page at a time. Started by a cron until it has been
 * through every response; after that a run is one read.
 */
export const backfillContacts = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const job = await ctx.db
      .query("jobs")
      .withIndex("by_key", (q) => q.eq("key", "contacts"))
      .unique();
    if (job?.done) return null;
    const page = await ctx.db.query("responses").paginate({ numItems: BACKFILL_PAGE, cursor: job?.cursor ?? null });
    for (const r of page.page) {
      const key = r.contactKey ?? contactKeyOf(r);
      if (!key) continue;
      if (r.contactKey === undefined) await ctx.db.patch(r._id, { contactKey: key });
      if (!r.preview) await notePerson(ctx, r.ownerId, key, r.submittedAt);
    }
    const next = { key: "contacts", cursor: page.continueCursor, done: page.isDone, at: Date.now() };
    if (job) await ctx.db.replace(job._id, next);
    else await ctx.db.insert("jobs", next);
    if (!page.isDone) await ctx.scheduler.runAfter(0, internal.responses.backfillContacts, {});
    return null;
  },
});
