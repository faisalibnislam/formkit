import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireUser } from "./model/identity";
import { formFor, storedBlock } from "./model/forms";
import { BUILTIN_TEMPLATES } from "./model/builtinTemplates";

/**
 * The template library: the six Formkit ships with, plus anything the person
 * has saved from one of their own forms.
 */

export const list = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    const saved = await ctx.db
      .query("templates")
      .withIndex("by_owner", (q) => q.eq("ownerId", user._id))
      .collect();

    const builtin = BUILTIN_TEMPLATES.map((t) => ({
      slug: t.slug,
      name: t.name,
      topic: t.topic,
      blurb: t.blurb,
      audience: t.audience,
      questions: t.blocks.filter((b) => b.kind === "field").length,
      pages: t.blocks.filter((b) => b.kind === "pagebreak").length + 1,
      mine: false,
      _id: null,
    }));

    return [
      ...builtin,
      ...saved.map((t) => ({
        slug: t.slug,
        name: t.name,
        topic: t.topic,
        blurb: t.blurb,
        audience: t.audience ?? null,
        questions: (t.blocks as { kind?: string }[]).filter((b) => b.kind === "field").length,
        pages:
          (t.blocks as { kind?: string }[]).filter((b) => b.kind === "pagebreak").length + 1,
        mine: true,
        _id: t._id,
      })),
    ];
  },
});

/** "Save as template" on a form the person owns. */
export const saveFrom = mutation({
  args: {
    formId: v.id("forms"),
    name: v.optional(v.string()),
    blurb: v.optional(v.string()),
    topic: v.optional(v.string()),
  },
  returns: v.id("templates"),
  handler: async (ctx, { formId, name, blurb, topic }) => {
    const user = await requireUser(ctx);
    const form = await formFor(ctx, formId, "read");
    const blocks = (
      await ctx.db
        .query("blocks")
        .withIndex("by_form_order", (q) => q.eq("formId", formId))
        .collect()
    )
      .sort((a, b) => a.order - b.order)
      .map(storedBlock);

    const title = name?.trim() || form.title;
    // Saved templates are the person's own, so the slug only has to be unique
    // to them; a clash with a built-in would shadow it, which it must not.
    const base = `${title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}-${user._id.slice(-6)}`;

    return ctx.db.insert("templates", {
      ownerId: user._id,
      slug: base,
      name: title,
      topic: topic?.trim() || "Saved",
      blurb: blurb?.trim() || `Your own ${title.toLowerCase()} form, ready to reuse.`,
      blocks,
      welcome: form.welcome,
      thanks: form.thanks,
      theme: form.theme,
      createdAt: Date.now(),
    });
  },
});

export const remove = mutation({
  args: { templateId: v.id("templates") },
  returns: v.null(),
  handler: async (ctx, { templateId }) => {
    const user = await requireUser(ctx);
    const row = await ctx.db.get(templateId);
    if (!row) return null;
    if (row.ownerId !== user._id) throw new Error("That template is not yours to delete.");
    await ctx.db.delete(templateId);
    return null;
  },
});
