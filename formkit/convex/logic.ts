import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { formFor } from "./model/forms";
import { requireFeature } from "./model/plans";
import { conditionsOf } from "./model/logicEval";

/**
 * Conditional logic. Rules read like sentences: when someone answers this way,
 * skip ahead, or show or hide another question. The first rule that matches
 * wins, and rules are scoped to their form — a rule written against one form's
 * questions never appears on another.
 *
 * Operators are type-aware. A number question offers "is at least" as well as
 * "is greater than", because "18 or older" must include 18 — the original set
 * only had "is greater than" and quietly excluded it.
 */
export const OPERATORS: Record<string, { value: string; label: string }[]> = {
  choice: [
    { value: "is", label: "is" },
    { value: "is-not", label: "is not" },
    { value: "is-empty", label: "is empty" },
    { value: "is-not-empty", label: "is not empty" },
  ],
  number: [
    { value: "at-least", label: "is at least" },
    { value: "at-most", label: "is at most" },
    { value: "greater", label: "is greater than" },
    { value: "less", label: "is less than" },
    { value: "is-empty", label: "is empty" },
  ],
  text: [
    { value: "contains", label: "contains" },
    { value: "is", label: "is" },
    { value: "is-empty", label: "is empty" },
    { value: "is-not-empty", label: "is not empty" },
  ],
};

/**
 * Which operator set a question gets. A short-text question whose wording
 * implies a number ("How old are you?", "How many…") is read as numeric, with
 * a note saying so.
 */
export function operatorGroup(type: string | undefined, title: string | undefined) {
  if (!type) return "text";
  if (["single-choice", "multi-choice", "dropdown", "yes-no", "rating", "scale"].includes(type)) {
    return "choice";
  }
  if (type === "number") return "number";
  if (type === "short-text" && title && /\b(how old|how many|how much|age|number of)\b/i.test(title)) {
    return "number";
  }
  return "text";
}

const condition = v.object({
  id: v.optional(v.string()),
  source: v.optional(v.union(v.literal("answer"), v.literal("calc"), v.literal("ai"))),
  blockId: v.optional(v.id("blocks")),
  ref: v.optional(v.string()),
  operator: v.string(),
  value: v.optional(v.string()),
  value2: v.optional(v.string()),
  fallback: v.optional(v.boolean()),
});
const group = v.object({ join: v.union(v.literal("and"), v.literal("or")), conditions: v.array(condition) });
const action = v.union(
  v.literal("show"),
  v.literal("hide"),
  v.literal("require"),
  v.literal("jump"),
  v.literal("hide-options"),
  v.literal("ending"),
);

/**
 * What a rule may use on the owner's plan: several endings and hidden options
 * are Pro, AI conditions Business. Refused with the upgrade sheet's error.
 */
async function checkPlan(
  ctx: Parameters<typeof requireFeature>[0],
  ownerId: Parameters<typeof requireFeature>[1],
  r: { action?: string; conditions?: { source?: string }[]; groups?: { conditions: { source?: string }[] }[] },
) {
  if (r.action === "hide-options" || r.action === "ending") await requireFeature(ctx, ownerId, "logic.advanced");
  const all = [...(r.conditions ?? []), ...(r.groups ?? []).flatMap((g) => g.conditions)];
  if (all.some((c) => c.source === "ai")) await requireFeature(ctx, ownerId, "logic.ai");
}

/** AI conditions need a stable id for their judgement to be kept against. */
function withIds<T extends { id?: string; source?: string }>(list: T[]): T[] {
  return list.map((c) => (c.source === "ai" && !c.id ? { ...c, id: crypto.randomUUID().slice(0, 12) } : c));
}

export const list = query({
  args: { formId: v.id("forms") },
  handler: async (ctx, { formId }) => {
    await formFor(ctx, formId, "read");
    const rules = await ctx.db
      .query("logicRules")
      .withIndex("by_form", (q) => q.eq("formId", formId))
      .collect();
    return rules.sort((a, b) => a.order - b.order);
  },
});

export const add = mutation({
  args: {
    formId: v.id("forms"),
    name: v.optional(v.string()),
    join: v.optional(v.union(v.literal("and"), v.literal("or"))),
    action,
    targetId: v.optional(v.id("blocks")),
    /** Where the rule starts. Omitted, the condition is left for the Logic page. */
    conditions: v.optional(v.array(condition)),
    groups: v.optional(v.array(group)),
    options: v.optional(v.array(v.string())),
    endingId: v.optional(v.string()),
  },
  returns: v.id("logicRules"),
  handler: async (ctx, { formId, name, join, action, targetId, conditions, groups, options, endingId }) => {
    const form = await formFor(ctx, formId);
    await checkPlan(ctx, form.ownerId, { action, conditions, groups });
    const existing = await ctx.db
      .query("logicRules")
      .withIndex("by_form", (q) => q.eq("formId", formId))
      .collect();

    const id = await ctx.db.insert("logicRules", {
      formId,
      name: name?.trim() || `Rule ${existing.length + 1}`,
      enabled: true,
      join: join ?? "and",
      conditions: withIds(conditions?.length ? conditions : [{ operator: "is" }]),
      groups: groups?.map((g) => ({ ...g, conditions: withIds(g.conditions) })),
      action,
      targetId,
      options,
      endingId,
      order: existing.length,
    });
    await ctx.db.patch(formId, { updatedAt: Date.now() });
    return id;
  },
});

export const update = mutation({
  args: {
    ruleId: v.id("logicRules"),
    patch: v.object({
      name: v.optional(v.string()),
      enabled: v.optional(v.boolean()),
      join: v.optional(v.union(v.literal("and"), v.literal("or"))),
      conditions: v.optional(v.array(condition)),
      /** null clears the groups, back to one list of conditions. */
      groups: v.optional(v.union(v.array(group), v.null())),
      action: v.optional(action),
      targetId: v.optional(v.id("blocks")),
      options: v.optional(v.array(v.string())),
      endingId: v.optional(v.string()),
    }),
  },
  returns: v.null(),
  handler: async (ctx, { ruleId, patch }) => {
    const rule = await ctx.db.get(ruleId);
    if (!rule) throw new Error("That rule no longer exists.");
    const form = await formFor(ctx, rule.formId);
    await checkPlan(ctx, form.ownerId, {
      action: patch.action,
      conditions: patch.conditions,
      groups: patch.groups ?? undefined,
    });
    const { groups, conditions, ...rest } = patch;
    await ctx.db.patch(ruleId, {
      ...rest,
      ...(conditions ? { conditions: withIds(conditions) } : {}),
      ...(groups === null ? { groups: undefined } : groups ? { groups: groups.map((g) => ({ ...g, conditions: withIds(g.conditions) })) } : {}),
    });
    await ctx.db.patch(rule.formId, { updatedAt: Date.now() });
    return null;
  },
});

export const remove = mutation({
  args: { ruleId: v.id("logicRules") },
  returns: v.null(),
  handler: async (ctx, { ruleId }) => {
    const rule = await ctx.db.get(ruleId);
    if (!rule) return null;
    await formFor(ctx, rule.formId);
    await ctx.db.delete(ruleId);
    await ctx.db.patch(rule.formId, { updatedAt: Date.now() });
    return null;
  },
});

/**
 * Unapplying a rule from a question clears that question from it — it never
 * deletes the rule, which stays on the Logic page.
 *
 * If the question was the affected side, only the target clears. If it was the
 * trigger, the rule is re-pointed at another question; only when no other
 * question exists does it clear and pause the rule.
 */
export const unapply = mutation({
  args: { ruleId: v.id("logicRules"), blockId: v.id("blocks") },
  returns: v.string(),
  handler: async (ctx, { ruleId, blockId }) => {
    const rule = await ctx.db.get(ruleId);
    if (!rule) throw new Error("That rule no longer exists.");
    await formFor(ctx, rule.formId);

    if (rule.targetId === blockId) {
      await ctx.db.patch(ruleId, { targetId: undefined });
      return "The rule no longer affects this question.";
    }

    const triggers = conditionsOf(rule).some((c) => c.blockId === blockId);
    if (!triggers) return "That rule does not involve this question.";

    const others = (
      await ctx.db
        .query("blocks")
        .withIndex("by_form_order", (q) => q.eq("formId", rule.formId))
        .collect()
    ).filter((b) => b.kind === "field" && b._id !== blockId);

    const replacement = others[0];
    const swap = (list: typeof rule.conditions) =>
      list.map((c) => (c.blockId === blockId ? { ...c, blockId: replacement?._id, value: undefined } : c));
    const conditions = swap(rule.conditions);
    const groups = rule.groups?.map((g) => ({ ...g, conditions: swap(g.conditions) }));

    if (!replacement) {
      await ctx.db.patch(ruleId, { conditions, groups, enabled: false });
      return "No other question could trigger the rule, so it is paused.";
    }
    await ctx.db.patch(ruleId, { conditions, groups });
    return `The rule now reads ${replacement.title ?? "another question"} instead.`;
  },
});
