import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireStaff } from "./model/identity";
import { RULES, allow } from "./model/rateLimit";

/**
 * The help centre's two signals: a search that matched nothing, and whether
 * an article helped. Anyone may send them, signed in or not, so they are
 * counted rather than stored one by one, and terms are trimmed and capped.
 */
export const log = mutation({
  args: {
    kind: v.union(v.literal("missed"), v.literal("helpful"), v.literal("unhelpful")),
    key: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, { kind, key }) => {
    const clean = key.trim().toLowerCase().replace(/\s+/g, " ").slice(0, 80);
    if (clean.length < 2) return null;
    // Feedback names an article id; a search term can be anything.
    if (kind !== "missed" && !/^[a-z0-9-]{2,48}$/.test(clean)) return null;
    // Past the hourly allowance for everyone together, signals are dropped.
    if (!(await allow(ctx, "help", RULES.helpSignals))) return null;
    const now = Date.now();
    const row = await ctx.db
      .query("helpSignals")
      .withIndex("by_kind_key", (q) => q.eq("kind", kind).eq("key", clean))
      .unique();
    if (row) await ctx.db.patch(row._id, { count: row.count + 1, lastAt: now });
    else await ctx.db.insert("helpSignals", { kind, key: clean, count: 1, firstAt: now, lastAt: now });
    return null;
  },
});

/** For Admin → Help centre: what people looked for and did not find, and how articles landed. */
export const summary = query({
  args: {},
  handler: async (ctx) => {
    await requireStaff(ctx, "support");
    const recent = async (kind: "missed" | "helpful" | "unhelpful") =>
      await ctx.db
        .query("helpSignals")
        .withIndex("by_kind_last", (q) => q.eq("kind", kind))
        .order("desc")
        .take(300);
    const [missed, helpful, unhelpful] = await Promise.all([recent("missed"), recent("helpful"), recent("unhelpful")]);
    const byArticle = new Map<string, { id: string; yes: number; no: number; lastAt: number }>();
    for (const r of helpful) byArticle.set(r.key, { id: r.key, yes: r.count, no: 0, lastAt: r.lastAt });
    for (const r of unhelpful) {
      const a = byArticle.get(r.key) ?? { id: r.key, yes: 0, no: 0, lastAt: 0 };
      byArticle.set(r.key, { ...a, no: r.count, lastAt: Math.max(a.lastAt, r.lastAt) });
    }
    return {
      missed: missed
        .sort((a, b) => b.count - a.count || b.lastAt - a.lastAt)
        .slice(0, 50)
        .map((r) => ({ term: r.key, count: r.count, lastAt: r.lastAt })),
      articles: [...byArticle.values()].sort((a, b) => b.no - a.no || a.yes - b.yes).slice(0, 50),
    };
  },
});
