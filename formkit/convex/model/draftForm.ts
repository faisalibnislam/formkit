import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import type { Draft } from "./aiForms";
import { logActivity } from "./access";
import { recount, uniqueSlug } from "./forms";
import { THEME_PRESETS } from "./themePresets";

/**
 * A checked draft (model/aiForms.ts toDraft) made into a real form: questions,
 * pages, rules and theme together, as a draft nobody can answer until it is
 * published. Ask Formkit, the API and imports all build forms this way.
 */

export function presetTheme(id: string, primary?: string) {
  const p = THEME_PRESETS.find((t) => t.id === id) ?? THEME_PRESETS[0]!;
  return { preset: p.id, bg: p.bg, surface: p.surface, text: p.text, primary: primary ?? p.primary, radius: p.radius };
}

export async function insertDraftForm(
  ctx: MutationCtx,
  {
    draft,
    ownerId,
    actorId,
    activity,
    icon = "sparkles",
  }: { draft: Draft; ownerId: Id<"users">; actorId: Id<"users">; activity: string; icon?: string },
) {
  const now = Date.now();
  // In the owner's branded company when they have one, as a new form would be.
  const companies = await ctx.db
    .query("companies")
    .withIndex("by_owner", (q) => q.eq("ownerId", ownerId))
    .collect();
  const branded = companies.find((c) => c.useBranding);
  const formId = await ctx.db.insert("forms", {
    ownerId,
    brand: branded ? branded._id : "me",
    title: draft.title,
    description: draft.description || undefined,
    slug: await uniqueSlug(ctx, draft.title),
    status: "draft",
    welcome: draft.welcome,
    thanks: draft.thanks,
    theme: draft.theme ? presetTheme(draft.theme) : undefined,
    responsesCount: 0,
    completedCount: 0,
    views: 0,
    starts: 0,
    createdAt: now,
    updatedAt: now,
  });

  const fieldIds: Id<"blocks">[] = [];
  for (const [order, it] of draft.items.entries()) {
    const id = await ctx.db.insert(
      "blocks",
      it.kind === "pagebreak"
        ? { formId, order, kind: "pagebreak", pageName: it.pageName }
        : {
            formId,
            order,
            kind: "field",
            type: it.type,
            title: it.title,
            help: it.help,
            required: it.required,
            options: it.options,
          },
    );
    if (it.kind === "field") fieldIds.push(id);
  }
  for (const [order, r] of draft.rules.entries()) {
    const whenId = fieldIds[r.when - 1];
    const targetId = fieldIds[r.target - 1];
    if (!whenId || !targetId) continue;
    await ctx.db.insert("logicRules", {
      formId,
      name: r.name,
      enabled: true,
      join: "and",
      conditions: [{ blockId: whenId, operator: r.operator, value: r.value }],
      action: r.action,
      targetId,
      order,
    });
  }
  await recount(ctx, formId);
  await logActivity(ctx, formId, actorId, activity, icon);
  return formId;
}
