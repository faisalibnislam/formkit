import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { accessOf, colourFor } from "./model/access";

/**
 * Who else has a form open. The editor beats every 20 seconds with the
 * question it has selected; anyone who has not beaten for 45 seconds has left.
 */
const FRESH_MS = 45_000;

export const beat = mutation({
  args: { formId: v.id("forms"), blockId: v.optional(v.string()) },
  returns: v.null(),
  handler: async (ctx, { formId, blockId }) => {
    const { user } = await accessOf(ctx, formId);
    const mine = await ctx.db
      .query("presence")
      .withIndex("by_form_user", (q) => q.eq("formId", formId).eq("userId", user._id))
      .first();
    if (mine) await ctx.db.patch(mine._id, { blockId, at: Date.now() });
    else await ctx.db.insert("presence", { formId, userId: user._id, blockId, at: Date.now() });
    return null;
  },
});

export const here = query({
  args: { formId: v.id("forms"), now: v.number() },
  handler: async (ctx, { formId, now }) => {
    const { user } = await accessOf(ctx, formId);
    const rows = await ctx.db
      .query("presence")
      .withIndex("by_form", (q) => q.eq("formId", formId))
      .collect();
    const fresh = rows.filter((r) => r.userId !== user._id && now - r.at < FRESH_MS);
    return Promise.all(
      fresh.map(async (r) => {
        const p = await ctx.db.get(r.userId);
        return {
          userId: r.userId,
          name: p?.name ?? p?.email ?? "Someone",
          image: p?.image ?? null,
          color: colourFor(r.userId),
          blockId: r.blockId ?? null,
        };
      }),
    );
  },
});
