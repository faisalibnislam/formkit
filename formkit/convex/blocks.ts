import { conditionsOf } from "./model/logicEval";
import { ConvexError, v } from "convex/values";
import { mutation } from "./_generated/server";
import { questionType } from "./schema";
import { formFor, recount } from "./model/forms";
import { requireFeature } from "./model/plans";
import { validKey } from "./model/calc";
import { voiceLength } from "./model/voice";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";

/**
 * Questions and page breaks share one ordered list, exactly as the builder
 * canvas presents them. A page break splits the form in two; without one the
 * whole form is a single scroll.
 */

const blockFields = {
  type: v.optional(questionType),
  title: v.optional(v.string()),
  help: v.optional(v.string()),
  placeholder: v.optional(v.string()),
  required: v.optional(v.boolean()),
  options: v.optional(v.array(v.string())),
  accept: v.optional(v.array(v.string())),
  scaleMin: v.optional(v.number()),
  scaleMax: v.optional(v.number()),
  maxSeconds: v.optional(v.number()),
  pageName: v.optional(v.string()),
  key: v.optional(v.string()),
  scores: v.optional(v.array(v.number())),
  defaultValue: v.optional(v.string()),
  limits: v.optional(v.array(v.number())),
  answerKey: v.optional(v.array(v.string())),
  marks: v.optional(v.number()),
  extract: v.optional(v.union(v.object({ from: v.id("blocks"), what: v.string() }), v.null())),
};

/** A key not already used on this form: "source", then "source_2" and on. */
async function freeKey(ctx: MutationCtx, formId: Id<"forms">, want: string) {
  const base = validKey(want) ? want : "field";
  const used = new Set(
    (
      await ctx.db
        .query("blocks")
        .withIndex("by_form_order", (q) => q.eq("formId", formId))
        .collect()
    ).map((b) => b.key),
  );
  if (!used.has(base)) return base;
  for (let i = 2; ; i++) if (!used.has(`${base}_${i}`)) return `${base}_${i}`;
}

export const add = mutation({
  args: {
    formId: v.id("forms"),
    kind: v.union(v.literal("field"), v.literal("pagebreak")),
    /** Insert position. Omitted appends to the end. */
    at: v.optional(v.number()),
    ...blockFields,
  },
  returns: v.id("blocks"),
  handler: async (ctx, { formId, kind, at, ...fields }) => {
    const form = await formFor(ctx, formId);
    if (fields.type === "hidden") await requireFeature(ctx, form, "logic.hidden");

    const blocks = (
      await ctx.db
        .query("blocks")
        .withIndex("by_form_order", (q) => q.eq("formId", formId))
        .collect()
    ).sort((a, b) => a.order - b.order);

    const index = at === undefined ? blocks.length : Math.max(0, Math.min(at, blocks.length));
    // Re-number from the insertion point so `order` stays dense.
    for (let i = index; i < blocks.length; i++) {
      await ctx.db.patch(blocks[i]!._id, { order: i + 1 });
    }

    const id = await ctx.db.insert("blocks", {
      formId,
      order: index,
      kind,
      ...(kind === "pagebreak"
        ? { pageName: fields.pageName ?? "New page" }
        : {
            type: fields.type ?? "short-text",
            title: fields.title ?? "Untitled question",
            help: fields.help,
            placeholder: fields.placeholder,
            required: fields.required ?? false,
            options: fields.options,
            accept: fields.accept,
            scaleMin: fields.scaleMin,
            scaleMax: fields.scaleMax,
            ...(fields.type === "voice" ? { maxSeconds: voiceLength(fields.maxSeconds) } : {}),
            ...(fields.type === "hidden"
              ? { key: await freeKey(ctx, formId, fields.key ?? "source"), defaultValue: fields.defaultValue }
              : {}),
          }),
    });

    await ctx.db.patch(formId, { updatedAt: Date.now() });

    await recount(ctx, formId);
    return id;
  },
});

export const update = mutation({
  args: { blockId: v.id("blocks"), patch: v.object(blockFields) },
  returns: v.null(),
  handler: async (ctx, { blockId, patch }) => {
    const block = await ctx.db.get(blockId);
    if (!block) throw new Error("That question no longer exists.");
    const form = await formFor(ctx, block.formId);
    if (patch.type === "hidden" && block.type !== "hidden") await requireFeature(ctx, form, "logic.hidden");
    if (patch.scores?.some((n) => n !== 0)) await requireFeature(ctx, form, "logic.calc");
    if (patch.limits?.some((n) => n > 0)) await requireFeature(ctx, form, "logic.advanced");
    if (patch.answerKey?.length || patch.marks !== undefined) {
      await requireFeature(ctx, form, "quiz");
      patch = {
        ...patch,
        ...(patch.answerKey ? { answerKey: patch.answerKey.map((a) => a.trim().slice(0, 200)).filter(Boolean).slice(0, 20) } : {}),
        ...(patch.marks !== undefined ? { marks: Math.max(0, Math.min(1000, Math.round(patch.marks * 10) / 10)) } : {}),
      };
    }
    if (patch.maxSeconds !== undefined) patch = { ...patch, maxSeconds: voiceLength(patch.maxSeconds) };
    if (patch.extract) {
      await requireFeature(ctx, form, "logic.ai");
      if ((patch.type ?? block.type) !== "hidden") throw new ConvexError("Only a hidden field can be filled in by AI.");
      patch = { ...patch, extract: { from: patch.extract.from, what: patch.extract.what.trim().slice(0, 300) } };
    }
    if (patch.key !== undefined) {
      const key = patch.key.trim().toLowerCase();
      if (key && !validKey(key)) {
        throw new ConvexError("A key is lowercase letters, numbers and underscores, starting with a letter, like budget or first_name.");
      }
      if (key) {
        const clash = (
          await ctx.db
            .query("blocks")
            .withIndex("by_form_order", (q) => q.eq("formId", block.formId))
            .collect()
        ).find((b) => b._id !== blockId && b.key === key);
        if (clash) throw new ConvexError(`“${key}” is already the key of “${clash.title ?? "another question"}”.`);
        if ((form.calc ?? []).some((c) => c.name === key)) throw new ConvexError(`“${key}” is already a calculation's name.`);
      }
      patch.key = key || undefined;
    }
    // null clears the AI extraction; the stored field cannot hold null.
    const { extract, ...rest } = patch;
    await ctx.db.patch(blockId, { ...rest, ...(extract === null ? { extract: undefined } : extract ? { extract } : {}) });
    await ctx.db.patch(block.formId, { updatedAt: Date.now() });
    return null;
  },
});

/** Deleting a question also removes the logic rules that point at it. */
export const remove = mutation({
  args: { blockId: v.id("blocks") },
  returns: v.null(),
  handler: async (ctx, { blockId }) => {
    const block = await ctx.db.get(blockId);
    if (!block) return null;
    await formFor(ctx, block.formId);

    const rules = await ctx.db
      .query("logicRules")
      .withIndex("by_form", (q) => q.eq("formId", block.formId))
      .collect();
    for (const rule of rules) {
      const triggers = conditionsOf(rule).some((c) => c.blockId === blockId);
      if (triggers || rule.targetId === blockId) await ctx.db.delete(rule._id);
    }

    await ctx.db.delete(blockId);

    const rest = (
      await ctx.db
        .query("blocks")
        .withIndex("by_form_order", (q) => q.eq("formId", block.formId))
        .collect()
    ).sort((a, b) => a.order - b.order);
    for (const [i, b] of rest.entries()) {
      if (b.order !== i) await ctx.db.patch(b._id, { order: i });
    }

    await ctx.db.patch(block.formId, { updatedAt: Date.now() });

    await recount(ctx, block.formId);
    return null;
  },
});

export const duplicate = mutation({
  args: { blockId: v.id("blocks") },
  returns: v.id("blocks"),
  handler: async (ctx, { blockId }) => {
    const block = await ctx.db.get(blockId);
    if (!block) throw new Error("That question no longer exists.");
    await formFor(ctx, block.formId);

    const { _id, _creationTime, order, ...rest } = block;
    const blocks = (
      await ctx.db
        .query("blocks")
        .withIndex("by_form_order", (q) => q.eq("formId", block.formId))
        .collect()
    ).sort((a, b) => a.order - b.order);

    for (let i = order + 1; i < blocks.length; i++) {
      await ctx.db.patch(blocks[i]!._id, { order: i + 1 });
    }
    const id = await ctx.db.insert("blocks", { ...rest, order: order + 1 });
    await ctx.db.patch(block.formId, { updatedAt: Date.now() });
    await recount(ctx, block.formId);
    return id;
  },
});

/** Drag-to-reorder sends the whole new order, so one write settles it. */
export const reorder = mutation({
  args: { formId: v.id("forms"), ids: v.array(v.id("blocks")) },
  returns: v.null(),
  handler: async (ctx, { formId, ids }) => {
    await formFor(ctx, formId);
    for (const [i, id] of ids.entries()) {
      const block = await ctx.db.get(id);
      if (block?.formId === formId && block.order !== i) {
        await ctx.db.patch(id, { order: i });
      }
    }
    await ctx.db.patch(formId, { updatedAt: Date.now() });
    return null;
  },
});

/**
 * Deleting a page takes the page break and every question after it, up to the
 * next page break, with the logic rules that point at any of them. Deleting
 * only the break - to merge its questions into the page above - is `remove`.
 */
export const removePage = mutation({
  args: { blockId: v.id("blocks") },
  returns: v.number(),
  handler: async (ctx, { blockId }) => {
    const block = await ctx.db.get(blockId);
    if (!block || block.kind !== "pagebreak") return 0;
    await formFor(ctx, block.formId);

    const blocks = (
      await ctx.db
        .query("blocks")
        .withIndex("by_form_order", (q) => q.eq("formId", block.formId))
        .collect()
    ).sort((a, b) => a.order - b.order);

    const start = blocks.findIndex((b) => b._id === blockId);
    let end = start + 1;
    while (end < blocks.length && blocks[end]!.kind !== "pagebreak") end++;
    const gone = new Set(blocks.slice(start, end).map((b) => b._id as string));

    const rules = await ctx.db
      .query("logicRules")
      .withIndex("by_form", (q) => q.eq("formId", block.formId))
      .collect();
    for (const rule of rules) {
      const touches =
        conditionsOf(rule).some((c) => c.blockId && gone.has(c.blockId)) ||
        (rule.targetId && gone.has(rule.targetId));
      if (touches) await ctx.db.delete(rule._id);
    }

    for (const id of gone) await ctx.db.delete(id as never);

    const rest = blocks.filter((b) => !gone.has(b._id));
    for (const [i, b] of rest.entries()) {
      if (b.order !== i) await ctx.db.patch(b._id, { order: i });
    }

    await ctx.db.patch(block.formId, { updatedAt: Date.now() });

    await recount(ctx, block.formId);
    return gone.size - 1;
  },
});

/** A page is copied whole: the break and its questions, placed after the page. */
export const duplicatePage = mutation({
  args: { blockId: v.id("blocks") },
  returns: v.id("blocks"),
  handler: async (ctx, { blockId }) => {
    const block = await ctx.db.get(blockId);
    if (!block || block.kind !== "pagebreak") throw new Error("That page no longer exists.");
    await formFor(ctx, block.formId);

    const blocks = (
      await ctx.db
        .query("blocks")
        .withIndex("by_form_order", (q) => q.eq("formId", block.formId))
        .collect()
    ).sort((a, b) => a.order - b.order);

    const start = blocks.findIndex((b) => b._id === blockId);
    let end = start + 1;
    while (end < blocks.length && blocks[end]!.kind !== "pagebreak") end++;
    const run = blocks.slice(start, end);

    for (let i = end; i < blocks.length; i++) {
      await ctx.db.patch(blocks[i]!._id, { order: i + run.length });
    }
    let first: Id<"blocks"> | null = null;
    for (const [k, b] of run.entries()) {
      const { _id, _creationTime, order, ...rest } = b;
      const id = await ctx.db.insert("blocks", {
        ...rest,
        ...(k === 0 ? { pageName: `${b.pageName ?? "Page"} copy` } : {}),
        order: end + k,
      });
      first ??= id;
    }
    await ctx.db.patch(block.formId, { updatedAt: Date.now() });
    await recount(ctx, block.formId);
    return first!;
  },
});
