import { ConvexError, v } from "convex/values";
import { action, internalAction, internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { formFor } from "./model/forms";
import { aiAllowed, requireUser } from "./model/identity";
import { hasFeature, requireFeature } from "./model/plans";
import { embed, ModelError } from "./model/gemini";
import { rowsOf, withheldBlocks } from "./aiReply";
import { currentSpace } from "./model/spaces";

/**
 * Search by meaning (Pro, per form). Each sent response's answers, without
 * names, emails, phone numbers or other contact details, are turned into a
 * vector by Gemini as they arrive; a search is turned into one too, and the
 * nearest responses come back. Turning it on indexes the latest responses
 * already there. Nothing is charged against AI allowances; the cost is tiny
 * and recorded like every model call.
 */

const BACKFILL_MAX = 2000;
const BATCH = 50;

/** A response as the index reads it: questions and answers, contact details left out. */
function textOf(r: Pick<Doc<"responses">, "answers">, withheld: Set<string>) {
  return rowsOf(r, withheld)
    .map((x) => `${x.question}: ${x.answer}`)
    .join("\n")
    .slice(0, 8000);
}

async function indexing(ctx: Parameters<typeof aiAllowed>[0], form: Doc<"forms"> | null) {
  return !!form && !form.deletedAt && !!form.semantic && (await hasFeature(ctx, form, "ai.insights")) && (await aiAllowed(ctx, form.ownerId));
}

export const source = internalQuery({
  args: { responseIds: v.array(v.id("responses")) },
  handler: async (ctx, { responseIds }) => {
    const out: { responseId: Id<"responses">; formId: Id<"forms">; ownerId: Id<"users">; text: string }[] = [];
    const withheldByForm = new Map<string, Set<string>>();
    for (const id of responseIds) {
      const r = await ctx.db.get(id);
      if (!r || r.partial || r.preview) continue;
      const form = await ctx.db.get(r.formId);
      if (!(await indexing(ctx, form))) continue;
      if (!withheldByForm.has(r.formId)) withheldByForm.set(r.formId, await withheldBlocks(ctx, r.formId));
      const text = textOf(r, withheldByForm.get(r.formId)!);
      if (text.trim()) out.push({ responseId: r._id, formId: r.formId, ownerId: r.ownerId, text });
    }
    return out;
  },
});

export const save = internalMutation({
  args: {
    rows: v.array(v.object({ responseId: v.id("responses"), formId: v.id("forms"), ownerId: v.id("users"), embedding: v.array(v.float64()) })),
  },
  returns: v.null(),
  handler: async (ctx, { rows }) => {
    for (const row of rows) {
      const had = await ctx.db
        .query("responseEmbeddings")
        .withIndex("by_response", (q) => q.eq("responseId", row.responseId))
        .first();
      if (had) await ctx.db.patch(had._id, { embedding: row.embedding });
      else if (await ctx.db.get(row.responseId)) await ctx.db.insert("responseEmbeddings", row);
    }
    return null;
  },
});

/** Indexes some responses: on arrival (one), or when the form turns it on (a batch). */
export const index = internalAction({
  args: { responseIds: v.array(v.id("responses")) },
  returns: v.null(),
  handler: async (ctx, { responseIds }) => {
    const items = await ctx.runQuery(internal.semantic.source, { responseIds });
    if (!items.length) return null;
    try {
      const vectors = await embed(
        items.map((i) => i.text),
        "document",
        { ctx, userId: items[0]!.ownerId, feature: "search" },
      );
      await ctx.runMutation(internal.semantic.save, {
        rows: items.map((i, n) => ({ responseId: i.responseId, formId: i.formId, ownerId: i.ownerId, embedding: vectors[n]! })),
      });
    } catch (e) {
      // A response that is not indexed is still found by its words.
      if (!(e instanceof ModelError)) throw e;
    }
    return null;
  },
});

export const backfillPage = internalQuery({
  args: { formId: v.id("forms"), cursor: v.union(v.string(), v.null()) },
  handler: async (ctx, { formId, cursor }) => {
    const page = await ctx.db
      .query("responses")
      .withIndex("by_form_preview_submitted", (q) => q.eq("formId", formId).eq("preview", undefined))
      .order("desc")
      .paginate({ cursor, numItems: BATCH });
    return { ids: page.page.filter((r) => !r.partial).map((r) => r._id), next: page.isDone ? null : page.continueCursor };
  },
});

export const backfill = internalAction({
  args: { formId: v.id("forms"), cursor: v.union(v.string(), v.null()), done: v.number() },
  returns: v.null(),
  handler: async (ctx, { formId, cursor, done }) => {
    const { ids, next } = await ctx.runQuery(internal.semantic.backfillPage, { formId, cursor });
    await ctx.runAction(internal.semantic.index, { responseIds: ids });
    if (next && done + BATCH < BACKFILL_MAX) {
      await ctx.scheduler.runAfter(0, internal.semantic.backfill, { formId, cursor: next, done: done + BATCH });
    }
    return null;
  },
});

export const setting = query({
  args: { formId: v.id("forms") },
  handler: async (ctx, { formId }) => {
    const form = await formFor(ctx, formId, "read");
    return { on: !!form.semantic, available: await hasFeature(ctx, form, "ai.insights") };
  },
});

export const setSemantic = mutation({
  args: { formId: v.id("forms"), on: v.boolean() },
  returns: v.null(),
  handler: async (ctx, { formId, on }) => {
    const form = await formFor(ctx, formId);
    if (on) await requireFeature(ctx, form, "ai.insights");
    await ctx.db.patch(formId, { semantic: on || undefined });
    if (on && !form.semantic) {
      await ctx.scheduler.runAfter(0, internal.semantic.backfill, { formId, cursor: null, done: 0 });
    }
    if (!on) {
      // Off means the index goes, too.
      for (const row of await ctx.db
        .query("responseEmbeddings")
        .withIndex("by_form", (q) => q.eq("formId", formId))
        .take(4000)) {
        await ctx.db.delete(row._id);
      }
    }
    return null;
  },
});

export const scope = internalQuery({
  args: { formId: v.optional(v.id("forms")) },
  handler: async (ctx, { formId }) => {
    const user = await requireUser(ctx);
    if (formId) {
      const form = await formFor(ctx, formId, "read");
      return { userId: user._id, ownerId: form.ownerId, formId, on: !!form.semantic, allowed: await aiAllowed(ctx, form.ownerId) };
    }
    const space = await currentSpace(ctx, user);
    return { userId: user._id, ownerId: space.ownerId, formId: undefined, on: true, allowed: await aiAllowed(ctx, space.ownerId) };
  },
});

export const keepReadable = internalQuery({
  args: { ids: v.array(v.id("responses")) },
  handler: async (ctx, { ids }) => {
    const out: Id<"responses">[] = [];
    for (const id of ids) {
      const r = await ctx.db.get(id);
      if (!r || r.preview) continue;
      try {
        await formFor(ctx, r.formId, "read");
        out.push(id);
      } catch {
        /* not theirs to read */
      }
    }
    return out;
  },
});

/**
 * The responses nearest in meaning to what was asked, best first: in one
 * form, or across every indexed form of the company being worked in.
 */
export const search = action({
  args: { query: v.string(), formId: v.optional(v.id("forms")) },
  handler: async (ctx, { query: asked, formId }): Promise<{ ids: Id<"responses">[] }> => {
    const words = asked.trim().slice(0, 300);
    if (words.length < 2) return { ids: [] };
    const s = await ctx.runQuery(internal.semantic.scope, { formId });
    if (!s.allowed) throw new ConvexError("AI is off for this account, so search by meaning is too.");
    if (formId && !s.on) throw new ConvexError("Search by meaning is off for this form. Turn it on under AI insights.");
    let vector: number[];
    try {
      [vector] = (await embed([words], "query", { ctx, userId: s.userId, feature: "search" })) as [number[]];
    } catch (e) {
      if (e instanceof ModelError) throw new ConvexError(e.message);
      throw e;
    }
    const found = await ctx.vectorSearch("responseEmbeddings", "by_embedding", {
      vector,
      limit: 40,
      filter: (q) => (formId ? q.eq("formId", formId) : q.eq("ownerId", s.ownerId)),
    });
    const close = found.filter((f) => f._score > 0.5);
    const rows: Id<"responses">[] = await ctx.runQuery(internal.semantic.responsesOf, { ids: close.map((f) => f._id) });
    return { ids: await ctx.runQuery(internal.semantic.keepReadable, { ids: rows }) };
  },
});

export const responsesOf = internalQuery({
  args: { ids: v.array(v.id("responseEmbeddings")) },
  handler: async (ctx, { ids }) => {
    const out: Id<"responses">[] = [];
    for (const id of ids) {
      const row = await ctx.db.get(id);
      if (row) out.push(row.responseId);
    }
    return out;
  },
});
