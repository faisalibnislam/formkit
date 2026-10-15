import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { formFor } from "./model/forms";
import { requireUser } from "./model/identity";
import { step } from "./model/history";

/** Undo and redo in the builder: model/history.ts. */

export const state = query({
  args: { formId: v.id("forms") },
  handler: async (ctx, { formId }) => {
    await formFor(ctx, formId, "read");
    const user = await requireUser(ctx);
    const newest = (kind: "undo" | "redo") =>
      ctx.db
        .query("draftHistory")
        .withIndex("by_form_kind_at", (q) => q.eq("formId", formId).eq("kind", kind))
        .order("desc")
        .first();
    const [undo, redo] = await Promise.all([newest("undo"), newest("redo")]);
    return {
      undo: undo ? { label: undo.label, mine: undo.userId === user._id } : null,
      redo: redo && redo.userId === user._id ? { label: redo.label } : null,
    };
  },
});

export const undo = mutation({
  args: { formId: v.id("forms") },
  returns: v.string(),
  handler: async (ctx, { formId }) => {
    const form = await formFor(ctx, formId);
    const user = await requireUser(ctx);
    return await step(ctx, form, user._id, "undo");
  },
});

export const redo = mutation({
  args: { formId: v.id("forms") },
  returns: v.string(),
  handler: async (ctx, { formId }) => {
    const form = await formFor(ctx, formId);
    const user = await requireUser(ctx);
    return await step(ctx, form, user._id, "redo");
  },
});
