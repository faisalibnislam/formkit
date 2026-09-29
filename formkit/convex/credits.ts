import { v } from "convex/values";
import { internalMutation, query } from "./_generated/server";
import { requireUser } from "./model/identity";
import { aiStatus, spendAi } from "./model/aiMeter";
import { CREDIT_COST, CREDIT_PACKS } from "./model/plans";
import { currentSpace } from "./model/spaces";

/**
 * The company's AI allowance and credits, as the app shows them, and the
 * spend actions call once their AI has worked.
 */

const kind = v.union(v.literal("builds"), v.literal("edits"), v.literal("responses"), v.literal("reports"));

export const spend = internalMutation({
  args: { ownerId: v.id("users"), brand: v.union(v.literal("me"), v.id("companies")), kind },
  returns: v.union(v.literal("allowance"), v.literal("credits"), v.null()),
  handler: async (ctx, { ownerId, brand, kind }) => spendAi(ctx, { ownerId, brand }, kind),
});

/** This month's AI for the company the person is working in, with the credit prices. */
export const status = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    const s = await aiStatus(ctx, await currentSpace(ctx, user));
    return { ...s, costs: CREDIT_COST, packs: CREDIT_PACKS };
  },
});
