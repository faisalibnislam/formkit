import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireUser } from "./model/identity";
import { hasFeature } from "./model/plans";

/**
 * Asking Formkit for help from inside the app. Business accounts' tickets
 * are marked priority, go to the top of the support queue, and are promised
 * a reply within one business day.
 */

export const mine = query({
  args: {},
  handler: async (ctx) => {
    const me = await requireUser(ctx);
    const rows = (await ctx.db.query("tickets").collect()).filter((t) => t.userId === me._id);
    return {
      priority: await hasFeature(ctx, me, "support.priority"),
      tickets: rows
        .sort((a, b) => b.openedAt - a.openedAt)
        .slice(0, 10)
        .map((t) => ({
          _id: t._id,
          subject: t.subject,
          state: t.state,
          openedAt: t.openedAt,
          messages: t.messages,
        })),
    };
  },
});

export const open = mutation({
  args: { subject: v.string(), body: v.string() },
  returns: v.id("tickets"),
  handler: async (ctx, { subject, body }) => {
    const me = await requireUser(ctx);
    const s = subject.trim().slice(0, 140);
    const b = body.trim().slice(0, 5000);
    if (!s || !b) throw new ConvexError("Add a subject and say what is happening.");
    const recent = (await ctx.db.query("tickets").collect()).filter(
      (t) => t.userId === me._id && Date.now() - t.openedAt < 3600_000,
    );
    if (recent.length >= 5) throw new ConvexError("That is a lot of tickets in an hour — we will get to the ones you sent.");
    return await ctx.db.insert("tickets", {
      userId: me._id,
      fromName: me.name ?? me.email ?? "Customer",
      fromEmail: me.email ?? "",
      subject: s,
      state: "open",
      messages: [{ who: me.name ?? me.email ?? "Customer", body: b, at: Date.now() }],
      openedAt: Date.now(),
      priority: (await hasFeature(ctx, me, "support.priority")) || undefined,
    });
  },
});

export const reply = mutation({
  args: { ticketId: v.id("tickets"), body: v.string() },
  returns: v.null(),
  handler: async (ctx, { ticketId, body }) => {
    const me = await requireUser(ctx);
    const t = await ctx.db.get(ticketId);
    if (!t || t.userId !== me._id) throw new ConvexError("That ticket is not yours.");
    const b = body.trim().slice(0, 5000);
    if (!b) return null;
    await ctx.db.patch(ticketId, {
      messages: [...t.messages, { who: me.name ?? me.email ?? "Customer", body: b, at: Date.now() }],
      state: "open",
    });
    return null;
  },
});
