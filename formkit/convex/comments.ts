import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { Doc, Id } from "./_generated/dataModel";
import { accessOf, canComment, colourFor, logActivity } from "./model/access";
import { nameOf, notify, peopleOn } from "./model/inbox";

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
      for (const id of [r.authorId, ...(r.mentions ?? [])]) {
        if (people.has(id)) continue;
        const p = await ctx.db.get(id);
        people.set(id, { name: p?.name ?? p?.email ?? "Someone", image: p?.image ?? null });
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
      mentions: (r.mentions ?? []).map((id) => people.get(id)?.name ?? "").filter(Boolean),
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

/** Everyone who can read this form's comments, for the @ picker. */
export const mentionable = query({
  args: { formId: v.id("forms") },
  handler: async (ctx, { formId }) => {
    const { form, user } = await accessOf(ctx, formId);
    const rows = await ctx.db
      .query("collaborators")
      .withIndex("by_form", (q) => q.eq("formId", formId))
      .collect();
    const ids = [form.ownerId, ...rows.filter((r) => r.status === "active" && r.userId).map((r) => r.userId!)];
    const out = [];
    for (const id of [...new Set(ids)]) {
      if (id === user._id) continue;
      const p = await ctx.db.get(id);
      if (!p) continue;
      out.push({ _id: p._id, name: p.name ?? p.email ?? "Someone", email: p.email ?? "", color: colourFor(p._id) });
    }
    return out;
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
    mentions: v.optional(v.array(v.id("users"))),
  },
  returns: v.id("comments"),
  handler: async (ctx, { formId, body, blockId, parentId, mentions = [] }) => {
    const { form, user, role } = await accessOf(ctx, formId);
    if (!canComment(role)) throw new Error("Viewers can read comments but not write them.");
    const text = body.trim();
    if (!text) throw new Error("Write something first.");
    if (text.length > 4000) throw new Error("Keep a comment under 4,000 characters.");

    let block: Id<"blocks"> | undefined = blockId;
    let parent: Doc<"comments"> | null = null;
    if (parentId) {
      parent = await ctx.db.get(parentId);
      if (!parent || parent.formId !== formId) throw new Error("That thread is gone.");
      block = parent.blockId;
      // A reply reopens a resolved thread: someone still has something to say.
      if (parent.resolved) await ctx.db.patch(parentId, { resolved: false });
    }
    if (block) {
      const b = await ctx.db.get(block);
      if (!b || b.formId !== formId) throw new Error("That question is gone.");
    }

    // Only people who can read this form can be mentioned on it.
    const { ids: onForm } = await peopleOn(ctx, form, user._id);
    const mentioned = [...new Set(mentions)].filter((m) => onForm.includes(m));

    const id = await ctx.db.insert("comments", {
      formId,
      blockId: block,
      parentId,
      authorId: user._id,
      body: text,
      resolved: false,
      createdAt: Date.now(),
      mentions: mentioned.length ? mentioned : undefined,
    });
    await logActivity(ctx, formId, user._id, parentId ? "replied to a comment" : "left a comment", "message-square");

    /* Who hears about it. A mention wins over everything else, so nobody gets
       two notices for one comment. Replies reach everyone already in the
       thread; a new thread reaches the form's owner. */
    const where = block ? `“${(await ctx.db.get(block))?.title ?? "a question"}” in ${form.title}` : form.title;
    const href = `/app/forms/${formId}?open=comments`;
    const told = new Set<string>([user._id]);
    const quote = text.length > 140 ? `${text.slice(0, 137)}…` : text;
    for (const m of mentioned) {
      told.add(m);
      await notify(ctx, m, {
        kind: "mention",
        title: `${nameOf(user)} mentioned you on ${where}`,
        body: quote,
        href,
        action: "Open the comment",
        icon: "at-sign",
        formId,
        commentId: id,
        actorId: user._id,
      });
    }
    if (parent) {
      const replies = (
        await ctx.db
          .query("comments")
          .withIndex("by_form", (q) => q.eq("formId", formId))
          .collect()
      ).filter((c) => c.parentId === parent!._id);
      const inThread = [parent.authorId, ...replies.map((r) => r.authorId)];
      for (const p of [...new Set(inThread)]) {
        if (told.has(p) || !onForm.includes(p)) continue;
        told.add(p);
        await notify(ctx, p, {
          kind: "reply",
          title:
            p === parent.authorId
              ? `${nameOf(user)} replied to your comment on ${where}`
              : `${nameOf(user)} replied in a thread on ${where}`,
          body: quote,
          href,
          action: "Open the thread",
          icon: "message-square",
          formId,
          commentId: id,
          actorId: user._id,
        });
      }
    } else if (!told.has(form.ownerId)) {
      await notify(ctx, form.ownerId, {
        kind: "comment",
        title: `${nameOf(user)} commented on ${where}`,
        body: quote,
        href,
        action: "Open the comment",
        icon: "message-square",
        formId,
        commentId: id,
        actorId: user._id,
      });
    }
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
    if (resolved && !c.resolved) {
      const form = await ctx.db.get(c.formId);
      await notify(ctx, c.authorId, {
        kind: "resolved",
        title: `${nameOf(user)} resolved your comment on ${form?.title ?? "a form"}`,
        body: c.body.length > 140 ? `${c.body.slice(0, 137)}…` : c.body,
        href: `/app/forms/${c.formId}?open=comments`,
        action: "Open the thread",
        icon: "check",
        formId: c.formId,
        commentId: c._id,
        actorId: user._id,
      });
    }
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
