import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { conditionsOf } from "./logicEval";
import { platformValue } from "./identity";
import { CREDIT_COST, CREDIT_LIFE_MS, PLANS, planOfSpace, type AiKind, type SpaceRef } from "./plans";
import { seatsOf, spaceKey, spaceOfForm } from "./spaces";

/**
 * A company's monthly AI allowance, and the credits behind it.
 *
 * Four things are counted: new forms built by Ask Formkit, AI edits, responses
 * AI works on (once each, however many AI features run on them) and insights
 * reports. On a paid plan each seat adds the plan's allowance to one pool the
 * company shares; a Free company has it once. When a kind runs out, the
 * action is paid for in bought credits at CREDIT_COST; with none left, it is
 * refused and the caller falls back (a confirmation instead of a reply, the
 * "no" path for AI logic).
 */

export const period = (at = Date.now()) => new Date(at).toISOString().slice(0, 7);

const KINDS: AiKind[] = ["builds", "edits", "responses", "reports"];

/** The pool for this month: per seat on a paid plan, once on Free. */
export async function poolOf(ctx: QueryCtx | MutationCtx, space: SpaceRef) {
  const plan = await planOfSpace(ctx, space);
  const seats = plan === "free" ? 1 : await seatsOf(ctx, space);
  const base = { ...PLANS[plan].ai };
  // Staff can tune Free's build allowance from the admin console.
  if (plan === "free") base.builds = (await platformValue<number>(ctx, "aiDefault")) ?? base.builds;
  const pool = Object.fromEntries(KINDS.map((k) => [k, base[k] * seats])) as Record<AiKind, number>;
  // A one-off grant or a personal limit set by staff, on the owner's own company.
  if (space.brand === "me") {
    const row = await ctx.db
      .query("aiAccess")
      .withIndex("by_user", (q) => q.eq("userId", space.ownerId))
      .unique();
    if (row?.limitOverride !== undefined) pool.builds = row.limitOverride;
    pool.builds += row?.granted ?? 0;
  }
  return { plan, seats, pool };
}

async function usageRow(ctx: QueryCtx | MutationCtx, key: string) {
  return await ctx.db
    .query("aiAllowance")
    .withIndex("by_space_period", (q) => q.eq("space", key).eq("period", period()))
    .unique();
}

async function creditRow(ctx: QueryCtx | MutationCtx, key: string) {
  return await ctx.db
    .query("aiCredits")
    .withIndex("by_space", (q) => q.eq("space", key))
    .unique();
}

/** Credits not yet spent or lapsed. */
function liveCredits(row: Awaited<ReturnType<typeof creditRow>>, now = Date.now()) {
  return (row?.lots ?? []).filter((l) => l.expires > now).reduce((n, l) => n + l.left, 0);
}

/** Where a company stands this month: pool, used, left, and credits. */
export async function aiStatus(ctx: QueryCtx | MutationCtx, space: SpaceRef) {
  const key = spaceKey(space);
  const { plan, seats, pool } = await poolOf(ctx, space);
  const row = await usageRow(ctx, key);
  const used = Object.fromEntries(KINDS.map((k) => [k, row?.[k] ?? 0])) as Record<AiKind, number>;
  const left = Object.fromEntries(KINDS.map((k) => [k, Math.max(0, pool[k] - used[k])])) as Record<AiKind, number>;
  return { plan, seats, pool, used, left, credits: liveCredits(await creditRow(ctx, key)) };
}

/** Whether the company can do this now, from its allowance or its credits. */
export async function canSpend(ctx: QueryCtx | MutationCtx, space: SpaceRef, kind: AiKind, n = 1) {
  const s = await aiStatus(ctx, space);
  return s.left[kind] >= n || s.credits >= CREDIT_COST[kind] * n;
}

/**
 * Takes an action from the allowance, or pays for it in credits. Returns where
 * it came from, or null when neither covers it (nothing is taken then).
 */
export async function spendAi(
  ctx: MutationCtx,
  space: SpaceRef,
  kind: AiKind,
  n = 1,
): Promise<"allowance" | "credits" | null> {
  const key = spaceKey(space);
  const { pool } = await poolOf(ctx, space);
  const row = await usageRow(ctx, key);
  const used = row?.[kind] ?? 0;
  if (used + n <= pool[kind]) {
    if (row) await ctx.db.patch(row._id, { [kind]: used + n });
    else {
      await ctx.db.insert("aiAllowance", {
        space: key,
        period: period(),
        builds: 0,
        edits: 0,
        responses: 0,
        reports: 0,
        [kind]: n,
      });
    }
    return "allowance";
  }
  const cost = CREDIT_COST[kind] * n;
  const credits = await creditRow(ctx, key);
  const now = Date.now();
  if (!credits || liveCredits(credits, now) < cost) return null;
  // Oldest credits first, so the ones closest to lapsing are used up.
  let owed = cost;
  const lots = credits.lots.map((l) => {
    if (owed === 0 || l.expires <= now || l.left === 0) return l;
    const take = Math.min(l.left, owed);
    owed -= take;
    return { ...l, left: l.left - take };
  });
  await ctx.db.patch(credits._id, {
    lots: lots.filter((l) => l.left > 0 && l.expires > now),
    balance: liveCredits({ ...credits, lots }, now),
    updatedAt: now,
  });
  return "credits";
}

/** Adds bought credits to a company. They last a year from purchase. */
export async function addCredits(ctx: MutationCtx, space: SpaceRef, amount: number) {
  const key = spaceKey(space);
  const now = Date.now();
  const row = await creditRow(ctx, key);
  const lot = { amount, left: amount, at: now, expires: now + CREDIT_LIFE_MS };
  if (row) {
    const lots = [...row.lots.filter((l) => l.left > 0 && l.expires > now), lot];
    await ctx.db.patch(row._id, { lots, balance: liveCredits({ ...row, lots }, now), updatedAt: now });
  } else {
    await ctx.db.insert("aiCredits", { space: key, balance: amount, lots: [lot], updatedAt: now });
  }
}

/** Gives back one action that was charged but did not happen. */
export async function refundAi(
  ctx: MutationCtx,
  space: SpaceRef,
  kind: AiKind,
  from: "allowance" | "credits",
) {
  if (from === "credits") return addCredits(ctx, space, CREDIT_COST[kind]);
  const row = await usageRow(ctx, spaceKey(space));
  if (row) await ctx.db.patch(row._id, { [kind]: Math.max(0, row[kind] - 1) });
}

/**
 * Charges a response to its company's AI allowance, once: a response an AI
 * reply and AI logic both worked on still counts as one.
 */
export async function chargeResponse(
  ctx: MutationCtx,
  form: Doc<"forms">,
  responseId: Id<"responses">,
): Promise<"allowance" | "credits" | null> {
  const r = await ctx.db.get(responseId);
  if (!r) return null;
  if (r.aiCharge) return r.aiCharge;
  const from = await spendAi(ctx, spaceOfForm(form), "responses");
  if (from) await ctx.db.patch(responseId, { aiCharge: from });
  return from;
}

/** Hands a response's charge back, when the only AI on it failed. */
export async function refundResponse(ctx: MutationCtx, form: Doc<"forms">, responseId: Id<"responses">) {
  const r = await ctx.db.get(responseId);
  if (!r?.aiCharge) return;
  await refundAi(ctx, spaceOfForm(form), "responses", r.aiCharge);
  await ctx.db.patch(responseId, { aiCharge: undefined });
}

/** Whether a form reads answers with AI: an AI condition in a rule, or a fact pulled from an answer. */
export async function usesAiLogic(ctx: QueryCtx | MutationCtx, form: Doc<"forms">) {
  const rules = await ctx.db
    .query("logicRules")
    .withIndex("by_form", (q) => q.eq("formId", form._id))
    .collect();
  if (rules.some((r) => r.enabled && conditionsOf(r).some((c) => c.source === "ai"))) return true;
  const blocks = await ctx.db
    .query("blocks")
    .withIndex("by_form_order", (q) => q.eq("formId", form._id))
    .collect();
  return blocks.some((b) => b.type === "hidden" && !!b.extract?.what.trim());
}
