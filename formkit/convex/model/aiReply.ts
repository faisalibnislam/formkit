import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { internal } from "../_generated/api";
import { PLANS, REPLY_PACK, hasFeature, planOf } from "./plans";
import { notify } from "./inbox";

/**
 * Business: AI replies. Each plan month includes a number of them; bought
 * packs of more roll over until used and are spent only once the month's are
 * gone. Out of both, a response simply gets the form's usual confirmation,
 * and the owner is told once a month.
 */

export const month = () => new Date().toISOString().slice(0, 7);

export function replyAllowance(owner: Doc<"users">) {
  const monthly = PLANS[planOf(owner)].aiReplies;
  const used = owner.aiReplyPeriod === month() ? (owner.aiReplyUsed ?? 0) : 0;
  const credits = owner.aiReplyCredits ?? 0;
  return { monthly, used, credits, left: Math.max(0, monthly - used) + credits };
}

/** Takes one reply from the allowance: this month's first, then a pack's. */
export async function chargeReply(ctx: MutationCtx, owner: Doc<"users">): Promise<"monthly" | "pack" | null> {
  const a = replyAllowance(owner);
  if (a.used < a.monthly) {
    await ctx.db.patch(owner._id, { aiReplyPeriod: month(), aiReplyUsed: a.used + 1 });
    return "monthly";
  }
  if (a.credits > 0) {
    await ctx.db.patch(owner._id, { aiReplyCredits: a.credits - 1 });
    return "pack";
  }
  return null;
}

/** Hands a reply back when it could not be written. */
export async function refundReply(ctx: MutationCtx, ownerId: Id<"users">, charged: "monthly" | "pack" | undefined) {
  const owner = await ctx.db.get(ownerId);
  if (!owner || !charged) return;
  if (charged === "pack") await ctx.db.patch(ownerId, { aiReplyCredits: (owner.aiReplyCredits ?? 0) + 1 });
  else if (owner.aiReplyPeriod === month()) await ctx.db.patch(ownerId, { aiReplyUsed: Math.max(0, (owner.aiReplyUsed ?? 0) - 1) });
}

/**
 * Called as a complete response is stored: queues its reply, or records why
 * there won't be one.
 */
export async function queueReply(ctx: MutationCtx, form: Doc<"forms">, responseId: Id<"responses">) {
  if (!form.aiReply?.enabled || !form.aiReply.prompt.trim()) return;
  const owner = await ctx.db.get(form.ownerId);
  if (!owner || !(await hasFeature(ctx, owner, "ai.reply"))) return;

  const charged = await chargeReply(ctx, owner);
  if (!charged) {
    await ctx.db.patch(responseId, { aiReply: { status: "skipped", reason: "allowance", at: Date.now() } });
    const period = month();
    if (owner.aiReplyWarned !== period) {
      await ctx.db.patch(owner._id, { aiReplyWarned: period });
      await notify(ctx, owner._id, {
        kind: "ai",
        title: "You’ve used this month’s AI replies",
        body: `New responses get your usual confirmation until next month. Add ${REPLY_PACK.replies} more for $${REPLY_PACK.price} — they roll over until used.`,
        href: "/app/settings?tab=plan",
        action: "Add AI replies",
        icon: "sparkles",
        formId: form._id,
      });
    }
    return;
  }
  await ctx.db.patch(responseId, { aiReply: { status: "pending", charged, at: Date.now() } });
  await ctx.scheduler.runAfter(0, internal.aiReply.generate, { responseId });
}

/** Whether the reply goes by email, so the usual confirmation can wait for it. */
export function emailsReply(form: Pick<Doc<"forms">, "aiReply">) {
  return !!form.aiReply?.enabled && form.aiReply.delivery !== "form";
}
