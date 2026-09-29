import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { internal } from "../_generated/api";
import { CREDIT_PACKS, hasFeature } from "./plans";
import { chargeResponse } from "./aiMeter";
import { notify } from "./inbox";

/**
 * AI replies. Each response a reply is written for counts once against the
 * company's AI allowance (model/aiMeter.ts), then its credits. Out of both, a
 * response simply gets the form's usual confirmation, and the owner is told
 * once a month.
 */

export const month = () => new Date().toISOString().slice(0, 7);

/**
 * Called as a complete response is stored: queues its reply, or records why
 * there won't be one.
 */
export async function queueReply(ctx: MutationCtx, form: Doc<"forms">, responseId: Id<"responses">) {
  if (!form.aiReply?.enabled || !form.aiReply.prompt.trim()) return;
  const owner = await ctx.db.get(form.ownerId);
  if (!owner || !(await hasFeature(ctx, form, "ai.reply"))) return;

  const charged = await chargeResponse(ctx, form, responseId);
  if (!charged) {
    await ctx.db.patch(responseId, { aiReply: { status: "skipped", reason: "allowance", at: Date.now() } });
    const period = month();
    if (owner.aiReplyWarned !== period) {
      await ctx.db.patch(owner._id, { aiReplyWarned: period });
      await notify(ctx, owner._id, {
        kind: "ai",
        title: "Your AI responses for this month are used up",
        body: `New responses get your usual confirmation until the 1st. AI credits keep replies going: ${CREDIT_PACKS[0].credits} for $${CREDIT_PACKS[0].price}.`,
        href: "/app/settings?tab=plan",
        action: "Get AI credits",
        icon: "sparkles",
        formId: form._id,
      });
    }
    return;
  }
  await ctx.db.patch(responseId, { aiReply: { status: "pending", at: Date.now() } });
  await ctx.scheduler.runAfter(0, internal.aiReply.generate, { responseId });
}

/** Whether the reply goes by email, so the usual confirmation can wait for it. */
export function emailsReply(form: Pick<Doc<"forms">, "aiReply">) {
  return !!form.aiReply?.enabled && form.aiReply.delivery !== "form";
}
