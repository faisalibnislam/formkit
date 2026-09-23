import { v } from "convex/values";
import { internalMutation, mutation, query, type QueryCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { requireUser } from "./model/identity";
import { formFor } from "./model/forms";

/**
 * The response inbox.
 *
 * Partial responses are kept and counted separately: they are excluded from the
 * Completed stat, filtered by the All / Complete / Partial control, badged on
 * their own, and carry a resume link the owner can send back.
 *
 * A response sent from the builder's preview is kept too, badged Preview, and
 * left out of every count — it is the owner trying their own form, not an
 * answer.
 */

const DAY = 24 * 60 * 60 * 1000;
const MAX_TAGS = 12;

/** The forms a person sees in the all-forms inbox: their own, not in the bin. */
async function ownForms(ctx: QueryCtx, userId: Id<"users">) {
  return (
    await ctx.db
      .query("forms")
      .withIndex("by_owner", (q) => q.eq("ownerId", userId))
      .collect()
  ).filter((f) => !f.deletedAt);
}

/** Every response in scope — one form, or every form the person owns. */
async function scope(ctx: QueryCtx, formId: Id<"forms"> | undefined) {
  const user = await requireUser(ctx);
  if (formId) {
    const form = await formFor(ctx, formId, "read");
    const rows = await ctx.db
      .query("responses")
      .withIndex("by_form", (q) => q.eq("formId", formId))
      .collect();
    return { forms: [form], rows };
  }
  const forms = await ownForms(ctx, user._id);
  const live = new Set(forms.map((f) => f._id as string));
  const rows = (
    await ctx.db
      .query("responses")
      .withIndex("by_owner", (q) => q.eq("ownerId", user._id))
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
      .map(async (a) => ({
        name: a.fileName ?? "attachment",
        url: await ctx.storage.getUrl(a.fileId!),
      })),
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
  };
}

/** Midnight today, in the server's clock; the client labels days itself. */
function startOfToday(now: number) {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function stats(rows: Doc<"responses">[], now: number) {
  const real = rows.filter((r) => !r.preview);
  const today = startOfToday(now);
  const week = now - 7 * DAY;
  const pct = (a: number, b: number) => (b === 0 ? null : Math.round(((a - b) / b) * 100));
  const inToday = real.filter((r) => r.submittedAt >= today).length;
  const inYesterday = real.filter((r) => r.submittedAt >= today - DAY && r.submittedAt < today).length;
  const inWeek = real.filter((r) => r.submittedAt >= week).length;
  const inLastWeek = real.filter((r) => r.submittedAt >= week - 7 * DAY && r.submittedAt < week).length;
  return {
    total: real.length,
    // Partials are excluded from Completed, deliberately.
    completed: real.filter((r) => !r.partial).length,
    partial: real.filter((r) => r.partial).length,
    today: inToday,
    todayChange: inToday - inYesterday,
    week: inWeek,
    weekChange: pct(inWeek, inLastWeek),
    unread: real.filter((r) => r.status === "new" && !r.partial).length,
    previews: rows.length - real.length,
  };
}

export const list = query({
  args: { formId: v.optional(v.id("forms")) },
  handler: async (ctx, { formId }) => {
    const { forms, rows } = await scope(ctx, formId);
    const titles = new Map(forms.map((f) => [f._id as string, f.title]));
    const sorted = [...rows].sort((a, b) => b.submittedAt - a.submittedAt);
    return {
      stats: stats(rows, Date.now()),
      forms: forms.map((f) => ({ _id: f._id, title: f.title })),
      responses: await Promise.all(sorted.map((r) => shape(ctx, r, titles.get(r.formId) ?? "A form"))),
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

/**
 * Everyone who has answered, once each. People are matched on their email;
 * someone who never gave one is matched on their name within the same form.
 * Partial respondents are included — they are people too, and often the ones
 * most worth following up.
 */
async function collectContacts(ctx: QueryCtx, formId: Id<"forms"> | undefined) {
  const { forms, rows } = await scope(ctx, formId);
  const titles = new Map(forms.map((f) => [f._id as string, f.title]));
  type Contact = {
    key: string;
    name: string | null;
    email: string | null;
    phone: string | null;
    company: string | null;
    source: string;
    created: number;
    last: number;
    responses: number;
    partialOnly: boolean;
    unread: boolean;
    tags: string[];
    forms: string[];
  };
  const people = new Map<string, Contact>();
  for (const r of [...rows].filter((r) => !r.preview).sort((a, b) => a.submittedAt - b.submittedAt)) {
    const email = r.respondentEmail?.trim().toLowerCase() || null;
    const name = r.respondentName?.trim() || null;
    if (!email && !name) continue;
    const key = email ?? `${r.formId}:${name!.toLowerCase()}`;
    const title = titles.get(r.formId) ?? "A form";
    const had = people.get(key);
    if (!had) {
      people.set(key, {
        key,
        name,
        email,
        phone: r.respondentPhone ?? null,
        company: r.respondentCompany ?? null,
        source: title,
        created: r.submittedAt,
        last: r.submittedAt,
        responses: 1,
        partialOnly: r.partial,
        unread: r.status === "new" && !r.partial,
        tags: [...(r.tags ?? [])],
        forms: [title],
      });
      continue;
    }
    // The newest thing they told us wins; the first form they used stays
    // the source.
    had.name = name ?? had.name;
    had.phone = r.respondentPhone ?? had.phone;
    had.company = r.respondentCompany ?? had.company;
    had.last = r.submittedAt;
    had.responses += 1;
    had.partialOnly = had.partialOnly && r.partial;
    had.unread = had.unread || (r.status === "new" && !r.partial);
    for (const t of r.tags ?? []) if (!had.tags.includes(t)) had.tags.push(t);
    if (!had.forms.includes(title)) had.forms.push(title);
  }
  return [...people.values()].sort((a, b) => b.last - a.last);
}

export const contacts = query({
  args: { formId: v.optional(v.id("forms")) },
  handler: (ctx, { formId }) => collectContacts(ctx, formId),
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
    await ctx.db.patch(responseId, { tags: clean.length ? clean.slice(0, MAX_TAGS) : undefined });
    return null;
  },
});

/** Every tag already in use, so the drawer can offer them again. */
export const tagsInUse = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    const rows = await ctx.db
      .query("responses")
      .withIndex("by_owner", (q) => q.eq("ownerId", user._id))
      .collect();
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
    const touched = new Set<string>();
    for (const id of ids) {
      const r = await ctx.db.get(id);
      if (!r) continue;
      await formFor(ctx, r.formId, "read");
      await ctx.db.delete(id);
      touched.add(r.formId);
    }
    for (const formId of touched) {
      await ctx.runMutation(internal.responses.recount, { formId: formId as Id<"forms"> });
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
    ];
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
            return a.fileName ?? a.value ?? "";
          }),
        ];
      }),
    };
  },
});

/** The contacts list as a sheet, in the same shape the Contacts tab shows. */
export const contactsForExport = query({
  args: { formId: v.optional(v.id("forms")) },
  handler: async (ctx, { formId }) => {
    const people = await collectContacts(ctx, formId);
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

/** How many responses an export would hold — Settings → Exports says so. */
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
