import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { Id } from "./_generated/dataModel";
import { accessOf, canComment, colourFor, logActivity } from "./model/access";

/**
 * Comments on a form, or on one question of it. A thread is a top-level
 * comment and its replies; resolving hides a thread without losing it.
 *
 * The owner, Editors and Commenters may write; a Viewer reads. Only the
 * author, or the form's owner, may delete a comment.
 */

export const list = query({
  args: { formId: v.id("forms") },
  handler: async (ctx, { formId }) => {
    const { form, user, role } = await accessOf(ctx, formId);
    const rows = (
      await ctx.db
        .query("comments")
        .withIndex("by_form", (q) => q.eq("formId", formId))
        .collect()
    ).sort((a, b) => a.createdAt - b.createdAt);

    const people = new Map<string, { name: string; image: string | null }>();
    for (const r of rows) {
      if (!people.has(r.authorId)) {
        const p = await ctx.db.get(r.authorId);
        people.set(r.authorId, { name: p?.name ?? p?.email ?? "Someone", image: p?.image ?? null });
      }
    }
    const shape = (r: (typeof rows)[number]) => ({
      _id: r._id,
      blockId: r.blockId ?? null,
      author: r.authorId === user._id ? "You" : people.get(r.authorId)!.name,
      image: people.get(r.authorId)!.image,
      color: colourFor(r.authorId),
      body: r.body,
      createdAt: r.createdAt,
      mine: r.authorId === user._id,
      canDelete: r.authorId === user._id || form.ownerId === user._id,
    });

    const threads = rows
      .filter((r) => !r.parentId)
      .map((r) => ({
        ...shape(r),
        resolved: r.resolved,
        replies: rows.filter((x) => x.parentId === r._id).map(shape),
      }))
      .reverse();

    return { canComment: canComment(role), threads };
  },
});

/** Open threads per question, for the badge on each card. */
export const counts = query({
  args: { formId: v.id("forms") },
  handler: async (ctx, { formId }) => {
    await accessOf(ctx, formId);
    const rows = await ctx.db
      .query("comments")
      .withIndex("by_form", (q) => q.eq("formId", formId))
      .collect();
    const out: Record<string, number> = {};
    for (const r of rows) {
      if (r.parentId || r.resolved || !r.blockId) continue;
      out[r.blockId] = (out[r.blockId] ?? 0) + 1;
    }
    return out;
  },
});

export const add = mutation({
  args: {
    formId: v.id("forms"),
    body: v.string(),
    blockId: v.optional(v.id("blocks")),
    parentId: v.optional(v.id("comments")),
  },
  returns: v.id("comments"),
  handler: async (ctx, { formId, body, blockId, parentId }) => {
    const { user, role } = await accessOf(ctx, formId);
    if (!canComment(role)) throw new Error("Viewers can read comments but not write them.");
    const text = body.trim();
    if (!text) throw new Error("Write something first.");
    if (text.length > 4000) throw new Error("Keep a comment under 4,000 characters.");

    let block: Id<"blocks"> | undefined = blockId;
    if (parentId) {
      const parent = await ctx.db.get(parentId);
      if (!parent || parent.formId !== formId) throw new Error("That thread is gone.");
      block = parent.blockId;
      // A reply reopens a resolved thread: someone still has something to say.
      if (parent.resolved) await ctx.db.patch(parentId, { resolved: false });
    }
    if (block) {
      const b = await ctx.db.get(block);
      if (!b || b.formId !== formId) throw new Error("That question is gone.");
    }

    const id = await ctx.db.insert("comments", {
      formId,
      blockId: block,
      parentId,
      authorId: user._id,
      body: text,
      resolved: false,
      createdAt: Date.now(),
    });
    await logActivity(ctx, formId, user._id, parentId ? "replied to a comment" : "left a comment", "message-square");
    return id;
  },
});

export const resolve = mutation({
  args: { commentId: v.id("comments"), resolved: v.boolean() },
  returns: v.null(),
  handler: async (ctx, { commentId, resolved }) => {
    const c = await ctx.db.get(commentId);
    if (!c) return null;
    const { user, role } = await accessOf(ctx, c.formId);
    if (!canComment(role)) throw new Error("Viewers cannot resolve comments.");
    await ctx.db.patch(commentId, { resolved });
    await logActivity(ctx, c.formId, user._id, resolved ? "resolved a comment" : "reopened a comment", "check");
    return null;
  },
});

export const remove = mutation({
  args: { commentId: v.id("comments") },
  returns: v.null(),
  handler: async (ctx, { commentId }) => {
    const c = await ctx.db.get(commentId);
    if (!c) return null;
    const { form, user } = await accessOf(ctx, c.formId);
    if (c.authorId !== user._id && form.ownerId !== user._id) {
      throw new Error("Only the person who wrote it, or the owner, can delete a comment.");
    }
    const replies = await ctx.db
      .query("comments")
      .withIndex("by_form", (q) => q.eq("formId", c.formId))
      .filter((q) => q.eq(q.field("parentId"), commentId))
      .collect();
    for (const r of replies) await ctx.db.delete(r._id);
    await ctx.db.delete(commentId);
    return null;
  },
});
