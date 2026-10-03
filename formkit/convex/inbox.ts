import { v } from "convex/values";
import {
  internalAction,
  internalMutation,
  internalQuery,
  mutation,
  query,
  type QueryCtx,
} from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { aiAllowed, requireUser } from "./model/identity";
import { colourFor } from "./model/access";
import { send } from "./notifications";
import { renderCommentEmail } from "./emails/response";

/**
 * The bell. Rows come from `model/inbox.notify`; live announcements from the
 * admin console are read straight from their own table and shown to the
 * audience they were written for until each person has seen them.
 */

const SITE = process.env.SITE_URL ?? "https://formkit.app";
const DAY = 24 * 60 * 60 * 1000;
const SHOW = 50;

async function announcementsFor(ctx: QueryCtx, user: Doc<"users">) {
  const live = await ctx.db
    .query("announcements")
    .withIndex("by_state", (q) => q.eq("state", "live"))
    .collect();
  if (!live.length) return [];
  const seen = new Set(
    (
      await ctx.db
        .query("announcementReads")
        .withIndex("by_user", (q) => q.eq("userId", user._id))
        .collect()
    ).map((r) => r.announcementId as string),
  );
  const ai = await aiAllowed(ctx, user._id);
  return live
    .filter((a) => {
      switch (a.audience) {
        case "New accounts":
          return user._creationTime > Date.now() - 30 * DAY;
        case "Accounts using AI":
          return ai;
        case "Suspended accounts":
          return false;
        default:
          return true;
      }
    })
    .sort((a, b) => b.createdAt - a.createdAt)
    .map((a) => ({ _id: a._id, title: a.title, body: a.body, at: a.createdAt, read: seen.has(a._id) }));
}

export const list = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    const rows = await ctx.db
      .query("inbox")
      .withIndex("by_user_at", (q) => q.eq("userId", user._id))
      .order("desc")
      .take(SHOW);
    const unreadRows = await ctx.db
      .query("inbox")
      .withIndex("by_user_read", (q) => q.eq("userId", user._id).eq("readAt", undefined))
      .collect();
    const actors = new Map<string, Doc<"users"> | null>();
    const items = await Promise.all(
      rows.map(async (r) => {
        let actor: { name: string; image: string | null; color: string } | null = null;
        if (r.actorId) {
          if (!actors.has(r.actorId)) actors.set(r.actorId, await ctx.db.get(r.actorId));
          const a = actors.get(r.actorId);
          if (a) {
            actor = {
              name: a.name ?? a.email ?? "Someone",
              image: a.avatarId ? await ctx.storage.getUrl(a.avatarId) : (a.image ?? null),
              color: colourFor(a._id),
            };
          }
        }
        return {
          _id: r._id,
          kind: r.kind,
          title: r.title,
          body: r.body ?? null,
          href: r.href ?? null,
          action: r.action ?? null,
          icon: r.icon ?? null,
          at: r.at,
          read: r.readAt !== undefined,
          actor,
        };
      }),
    );
    const announcements = await announcementsFor(ctx, user);
    return {
      items,
      announcements,
      unread: unreadRows.length + announcements.filter((a) => !a.read).length,
    };
  },
});

export const markRead = mutation({
  args: { ids: v.array(v.id("inbox")) },
  returns: v.null(),
  handler: async (ctx, { ids }) => {
    const user = await requireUser(ctx);
    const now = Date.now();
    for (const id of ids) {
      const row = await ctx.db.get(id);
      if (row && row.userId === user._id && row.readAt === undefined) await ctx.db.patch(id, { readAt: now });
    }
    return null;
  },
});

export const markUnread = mutation({
  args: { id: v.id("inbox") },
  returns: v.null(),
  handler: async (ctx, { id }) => {
    const user = await requireUser(ctx);
    const row = await ctx.db.get(id);
    if (row && row.userId === user._id) await ctx.db.patch(id, { readAt: undefined });
    return null;
  },
});

export const markAllRead = mutation({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    const now = Date.now();
    const rows = await ctx.db
      .query("inbox")
      .withIndex("by_user_read", (q) => q.eq("userId", user._id).eq("readAt", undefined))
      .collect();
    for (const r of rows) await ctx.db.patch(r._id, { readAt: now });
    const anns = await announcementsFor(ctx, user);
    for (const a of anns.filter((a) => !a.read)) {
      await ctx.db.insert("announcementReads", { userId: user._id, announcementId: a._id, at: now });
    }
    return rows.length;
  },
});

/**
 * Seeing the thing itself counts as reading its notice: opening a form's
 * responses clears its response rows, opening its comments clears those.
 */
export const readFor = mutation({
  args: { formId: v.optional(v.id("forms")), kinds: v.array(v.string()) },
  returns: v.null(),
  handler: async (ctx, { formId, kinds }) => {
    const user = await requireUser(ctx);
    const now = Date.now();
    const rows = await ctx.db
      .query("inbox")
      .withIndex("by_user_read", (q) => q.eq("userId", user._id).eq("readAt", undefined))
      .collect();
    for (const r of rows) {
      if (!kinds.includes(r.kind)) continue;
      if (formId && r.formId !== formId) continue;
      await ctx.db.patch(r._id, { readAt: now });
    }
    return null;
  },
});

export const remove = mutation({
  args: { id: v.id("inbox") },
  returns: v.null(),
  handler: async (ctx, { id }) => {
    const user = await requireUser(ctx);
    const row = await ctx.db.get(id);
    if (row && row.userId === user._id) await ctx.db.delete(id);
    return null;
  },
});

export const seeAnnouncement = mutation({
  args: { announcementId: v.id("announcements") },
  returns: v.null(),
  handler: async (ctx, { announcementId }) => {
    const user = await requireUser(ctx);
    const had = (
      await ctx.db
        .query("announcementReads")
        .withIndex("by_user", (q) => q.eq("userId", user._id))
        .collect()
    ).some((r) => r.announcementId === announcementId);
    if (!had) await ctx.db.insert("announcementReads", { userId: user._id, announcementId, at: Date.now() });
    return null;
  },
});

/* ------------------------------------------------------------------ */
/* The email that follows an unread reply or mention                   */
/* ------------------------------------------------------------------ */

export const forEmail = internalQuery({
  args: { inboxId: v.id("inbox") },
  handler: async (ctx, { inboxId }) => {
    const row = await ctx.db.get(inboxId);
    if (!row || row.readAt !== undefined || row.emailedAt !== undefined) return null;
    const user = await ctx.db.get(row.userId);
    if (!user?.email || user.deactivatedAt || user.emailPrefs?.comments === false) return null;
    const comment = row.commentId ? await ctx.db.get(row.commentId) : null;
    if (row.commentId && !comment) return null; // deleted since
    return {
      userId: user._id,
      to: user.email,
      formId: row.formId ?? undefined,
      subject: row.title,
      quote: comment?.body ?? row.body ?? "",
      link: `${SITE}${row.href ?? "/app"}`,
    };
  },
});

export const markEmailed = internalMutation({
  args: { inboxId: v.id("inbox") },
  returns: v.null(),
  handler: async (ctx, { inboxId }) => {
    const row = await ctx.db.get(inboxId);
    if (row) await ctx.db.patch(inboxId, { emailedAt: Date.now() });
    return null;
  },
});

export const emailIfUnread = internalAction({
  args: { inboxId: v.id("inbox") },
  returns: v.null(),
  handler: async (ctx, { inboxId }) => {
    const job: {
      userId: Id<"users">;
      to: string;
      formId?: Id<"forms">;
      subject: string;
      quote: string;
      link: string;
    } | null = await ctx.runQuery(internal.inbox.forEmail, { inboxId });
    if (!job) return null;
    const result = await send({
      to: [job.to],
      subject: job.subject,
      html: renderCommentEmail({ heading: job.subject, quote: job.quote, link: job.link }),
    });
    await ctx.runMutation(internal.inbox.markEmailed, { inboxId });
    await ctx.runMutation(internal.notifications.record, {
      userId: job.userId,
      formId: job.formId,
      kind: "comment",
      to: job.to,
      subject: job.subject,
      ...result,
    });
    return null;
  },
});
