import { v } from "convex/values";
import { internalMutation, mutation, query, type MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { requireUser } from "./model/identity";
import { formFor } from "./model/forms";

/**
 * A record of every export, so Settings → Exports can list what was taken and
 * fetch the same rows again. Only what is needed to rebuild the file is kept -
 * never the rows themselves.
 */

const KEEP = 20;

const fields = {
  formId: v.optional(v.id("forms")),
  what: v.union(v.literal("responses"), v.literal("contacts"), v.literal("analytics")),
  format: v.union(v.literal("csv"), v.literal("xlsx")),
  filename: v.string(),
  rows: v.number(),
  from: v.optional(v.number()),
  to: v.optional(v.number()),
  ids: v.optional(v.array(v.id("responses"))),
  emailedTo: v.optional(v.string()),
};

async function insert(
  ctx: MutationCtx,
  userId: Id<"users">,
  args: {
    formId?: Id<"forms">;
    what: "responses" | "contacts" | "analytics";
    format: "csv" | "xlsx";
    filename: string;
    rows: number;
    from?: number;
    to?: number;
    ids?: Id<"responses">[];
    emailedTo?: string;
  },
) {
  await ctx.db.insert("exports", {
    ...args,
    // A long selection is not worth keeping id by id; the file itself was.
    ids: args.ids && args.ids.length <= 500 ? args.ids : undefined,
    userId,
    at: Date.now(),
  });
  const mine = await ctx.db
    .query("exports")
    .withIndex("by_user_at", (q) => q.eq("userId", userId))
    .order("desc")
    .collect();
  for (const old of mine.slice(KEEP)) await ctx.db.delete(old._id);
}

export const record = mutation({
  args: fields,
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    if (args.formId) await formFor(ctx, args.formId, "read");
    await insert(ctx, user._id, args);
    return null;
  },
});

export const recordFor = internalMutation({
  args: { userId: v.id("users"), ...fields },
  returns: v.null(),
  handler: async (ctx, { userId, ...args }) => {
    await insert(ctx, userId, args);
    return null;
  },
});

export const recent = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    const rows = await ctx.db
      .query("exports")
      .withIndex("by_user_at", (q) => q.eq("userId", user._id))
      .order("desc")
      .take(KEEP);
    return Promise.all(
      rows.map(async (r) => {
        const form = r.formId ? await ctx.db.get(r.formId) : null;
        return {
          _id: r._id,
          formId: r.formId ?? null,
          // A form since deleted can no longer be exported again.
          formTitle: r.formId ? (form && !form.deletedAt ? form.title : null) : "All forms",
          what: r.what,
          format: r.format,
          filename: r.filename,
          rows: r.rows,
          from: r.from ?? null,
          to: r.to ?? null,
          ids: r.ids ?? null,
          emailedTo: r.emailedTo ?? null,
          at: r.at,
        };
      }),
    );
  },
});
