import { v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { Doc } from "./_generated/dataModel";
import { requireUser } from "./model/identity";
import { formFor } from "./model/forms";
import { formUrl } from "./model/handles";

/**
 * The response inbox.
 *
 * Partial responses are kept and counted separately: they are excluded from the
 * Completed stat, filtered by the All / Complete / Partial control, badged on
 * their own, and carry a resume link the owner can send back.
 */

async function shape(ctx: Parameters<typeof formUrl>[0], r: Doc<"responses">) {
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
    submittedAt: r.submittedAt,
    partial: r.partial,
    answeredCount: r.answeredCount,
    totalCount: r.totalCount,
    answers: r.answers.map((a) => ({
      question: a.question,
      value: a.value ?? (a.values ? a.values.join(", ") : null),
      fileName: a.fileName ?? null,
    })),
    files,
    respondentName: r.respondentName ?? null,
    respondentEmail: r.respondentEmail ?? null,
    device: r.device ?? null,
    source: r.source ?? null,
    status: r.status,
    note: r.note ?? null,
    resumeToken: r.partial ? (r.resumeToken ?? null) : null,
  };
}

export const list = query({
  args: {
    formId: v.optional(v.id("forms")),
    completeness: v.optional(
      v.union(v.literal("all"), v.literal("complete"), v.literal("partial")),
    ),
    search: v.optional(v.string()),
  },
  handler: async (ctx, { formId, completeness = "all", search }) => {
    const user = await requireUser(ctx);

    const rows = formId
      ? await (async () => {
          await formFor(ctx, formId, "read");
          return ctx.db
            .query("responses")
            .withIndex("by_form", (q) => q.eq("formId", formId))
            .collect();
        })()
      : await ctx.db
          .query("responses")
          .withIndex("by_owner", (q) => q.eq("ownerId", user._id))
          .collect();

    const term = search?.trim().toLowerCase();
    const filtered = rows
      .filter((r) =>
        completeness === "all" ? true : completeness === "partial" ? r.partial : !r.partial,
      )
      .filter((r) =>
        term
          ? `${r.respondentName ?? ""} ${r.respondentEmail ?? ""} ${r.answers
              .map((a) => a.value ?? "")
              .join(" ")}`
              .toLowerCase()
              .includes(term)
          : true,
      )
      .sort((a, b) => b.submittedAt - a.submittedAt);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

    return {
      stats: {
        total: rows.length,
        today: rows.filter((r) => r.submittedAt >= today.getTime()).length,
        week: rows.filter((r) => r.submittedAt >= weekAgo).length,
        unread: rows.filter((r) => r.status === "new").length,
        partial: rows.filter((r) => r.partial).length,
        // Partials are excluded from Completed, deliberately.
        completed: rows.filter((r) => !r.partial).length,
      },
      responses: await Promise.all(filtered.map((r) => shape(ctx, r))),
    };
  },
});

export const get = query({
  args: { responseId: v.id("responses") },
  handler: async (ctx, { responseId }) => {
    const response = await ctx.db.get(responseId);
    if (!response) return null;
    await formFor(ctx, response.formId, "read");
    return shape(ctx, response);
  },
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
      await ctx.runMutation(internal.responses.recount, { formId: formId as never });
    }
    return null;
  },
});

export const recount = internalMutation({
  args: { formId: v.id("forms") },
  returns: v.null(),
  handler: async (ctx, { formId }) => {
    const rows = await ctx.db
      .query("responses")
      .withIndex("by_form", (q) => q.eq("formId", formId))
      .collect();
    await ctx.db.patch(formId, {
      responsesCount: rows.length,
      completedCount: rows.filter((r) => !r.partial).length,
    });
    return null;
  },
});

/** CSV or Excel, matching the filter in view or just the rows ticked. */
export const forExport = query({
  args: {
    formId: v.id("forms"),
    ids: v.optional(v.array(v.id("responses"))),
    includePartial: v.optional(v.boolean()),
  },
  handler: async (ctx, { formId, ids, includePartial = true }) => {
    const form = await formFor(ctx, formId, "read");
    const blocks = (
      await ctx.db
        .query("blocks")
        .withIndex("by_form_order", (q) => q.eq("formId", formId))
        .collect()
    )
      .filter((b) => b.kind === "field")
      .sort((a, b) => a.order - b.order);

    const wanted = ids ? new Set(ids as string[]) : null;
    const rows = (
      await ctx.db
        .query("responses")
        .withIndex("by_form", (q) => q.eq("formId", formId))
        .collect()
    )
      .filter((r) => (wanted ? wanted.has(r._id) : true))
      .filter((r) => (includePartial ? true : !r.partial))
      .sort((a, b) => a.submittedAt - b.submittedAt);

    const columns = [
      "Submitted",
      "Status",
      "Complete",
      "Name",
      "Email",
      ...blocks.map((b) => b.title ?? "Question"),
    ];

    return {
      filename: `${form.slug}-responses`,
      columns,
      rows: rows.map((r) => [
        new Date(r.submittedAt).toISOString(),
        r.status,
        r.partial ? "Partial" : "Complete",
        r.respondentName ?? "",
        r.respondentEmail ?? "",
        ...blocks.map((b) => {
          const answer = r.answers.find((a) => a.blockId === b._id);
          if (!answer) return "";
          if (answer.values) return answer.values.join("; ");
          return answer.fileName ?? answer.value ?? "";
        }),
      ]),
    };
  },
});
