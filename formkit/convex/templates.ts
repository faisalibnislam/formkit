import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireUser } from "./model/identity";
import { formFor, storedBlock } from "./model/forms";
import { BUILTIN_TEMPLATES } from "./model/builtinTemplates";
import { logActivity } from "./model/access";

/**
 * The template library: the thirteen Formkit ships with, plus anything the
 * person has saved from one of their own forms.
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
      icon: t.icon,
      accent: t.accent,
      mine: false,
      _id: null,
      keeps: null,
      createdAt: null,
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
        icon: "bookmark",
        accent: "var(--blue-100)",
        mine: true,
        _id: t._id,
        keeps: [
          "Questions & pages",
          ...(t.keepsTheme !== false && t.theme ? ["Theme"] : []),
          ...(t.rules?.length ? ["Logic"] : []),
          ...(t.keepsCopy !== false && t.welcome ? ["Welcome & thanks"] : []),
        ],
        createdAt: t.createdAt,
      })),
    ];
  },
});

/** One template, question by question, for the library's preview. */
export const get = query({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    const user = await requireUser(ctx);
    const saved = (
      await ctx.db
        .query("templates")
        .withIndex("by_slug", (q) => q.eq("slug", slug))
        .collect()
    ).find((t) => t.ownerId === user._id);
    const t = saved ?? BUILTIN_TEMPLATES.find((b) => b.slug === slug);
    if (!t) return null;
    const blocks = t.blocks as { kind?: string; type?: string; title?: string; pageName?: string; required?: boolean; options?: string[]; help?: string }[];
    return {
      slug: t.slug,
      name: t.name,
      topic: t.topic,
      blurb: t.blurb,
      welcome: (t.welcome ?? null) as { title: string; message: string } | null,
      blocks: blocks.map((b) => ({
        kind: b.kind ?? "field",
        type: b.type ?? null,
        title: b.title ?? b.pageName ?? "",
        help: b.help ?? null,
        required: !!b.required,
        options: b.options ?? null,
      })),
    };
  },
});

/**
 * "Save as template" on a form. The questions and pages always go; the theme,
 * the logic, and the welcome and thank-you copy each go if asked.
 */
export const saveFrom = mutation({
  args: {
    formId: v.id("forms"),
    name: v.optional(v.string()),
    blurb: v.optional(v.string()),
    topic: v.optional(v.string()),
    keepCopy: v.optional(v.boolean()),
    keepTheme: v.optional(v.boolean()),
    keepLogic: v.optional(v.boolean()),
  },
  returns: v.id("templates"),
  handler: async (ctx, { formId, name, blurb, topic, keepCopy = true, keepTheme = true, keepLogic = true }) => {
    const user = await requireUser(ctx);
    const form = await formFor(ctx, formId, "read");
    const rows = (
      await ctx.db
        .query("blocks")
        .withIndex("by_form_order", (q) => q.eq("formId", formId))
        .collect()
    ).sort((a, b) => a.order - b.order);
    const index = new Map(rows.map((b, i) => [b._id as string, i]));

    const rules = keepLogic
      ? (
          await ctx.db
            .query("logicRules")
            .withIndex("by_form", (q) => q.eq("formId", formId))
            .collect()
        )
          .sort((a, b) => a.order - b.order)
          .map((r) => ({
            name: r.name,
            enabled: r.enabled,
            join: r.join,
            action: r.action,
            targetIndex: r.targetId ? (index.get(r.targetId) ?? null) : null,
            conditions: r.conditions.map((c) => ({
              index: c.blockId ? (index.get(c.blockId) ?? null) : null,
              operator: c.operator,
              value: c.value,
            })),
          }))
      : undefined;

    const title = name?.trim() || form.title;
    // Unique on its own, so two templates with one name never shadow each other.
    const slug = `${title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "template"}-${Date.now().toString(36)}`;

    const id = await ctx.db.insert("templates", {
      ownerId: user._id,
      slug,
      name: title,
      topic: topic?.trim() || "Business",
      blurb: blurb?.trim() || `Saved from ${form.title}.`,
      blocks: rows.map(storedBlock),
      welcome: keepCopy ? form.welcome : undefined,
      thanks: keepCopy ? form.thanks : undefined,
      theme: keepTheme ? form.theme : undefined,
      rules,
      keepsCopy: keepCopy,
      keepsTheme: keepTheme,
      keepsLogic: keepLogic,
      createdAt: Date.now(),
    });
    await logActivity(ctx, formId, user._id, `saved ${title} as a template`, "bookmark");
    return id;
  },
});

/** Rename a saved template, or change what it says about itself. */
export const update = mutation({
  args: {
    templateId: v.id("templates"),
    name: v.optional(v.string()),
    blurb: v.optional(v.string()),
    topic: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, { templateId, name, blurb, topic }) => {
    const user = await requireUser(ctx);
    const row = await ctx.db.get(templateId);
    if (!row || row.ownerId !== user._id) throw new Error("That template is not yours to change.");
    await ctx.db.patch(templateId, {
      ...(name?.trim() ? { name: name.trim() } : {}),
      ...(blurb !== undefined ? { blurb: blurb.trim() } : {}),
      ...(topic?.trim() ? { topic: topic.trim() } : {}),
    });
    return null;
  },
});

export const duplicate = mutation({
  args: { templateId: v.id("templates") },
  returns: v.id("templates"),
  handler: async (ctx, { templateId }) => {
    const user = await requireUser(ctx);
    const row = await ctx.db.get(templateId);
    if (!row || row.ownerId !== user._id) throw new Error("That template is not yours to copy.");
    const { _id, _creationTime, ...rest } = row;
    return ctx.db.insert("templates", {
      ...rest,
      name: `${row.name} (copy)`,
      slug: `${row.slug.replace(/-[a-z0-9]+$/, "")}-${Date.now().toString(36)}`,
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
