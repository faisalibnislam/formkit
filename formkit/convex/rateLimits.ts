import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";

const DAY = 24 * 60 * 60 * 1000;
const BATCH = 500;

/** Daily: drops rate-limit windows that ended over a day ago, a batch at a time. */
export const clearOld = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const old = await ctx.db
      .query("rateLimits")
      .withIndex("by_window", (q) => q.lt("windowStart", Date.now() - DAY))
      .take(BATCH);
    for (const r of old) await ctx.db.delete(r._id);
    if (old.length === BATCH) await ctx.scheduler.runAfter(0, internal.rateLimits.clearOld, {});
    return null;
  },
});
