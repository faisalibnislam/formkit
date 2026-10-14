import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { internal } from "../_generated/api";
import { CREDIT_PACKS, hasFeature } from "./plans";
import { chargeResponse } from "./aiMeter";
import { notify } from "./inbox";
import { aiAllowed } from "./identity";
import { servedForm } from "./served";

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
export async function queueReply(
  ctx: MutationCtx,
  form: Doc<"forms">,
  responseId: Id<"responses">,
  { hold = false }: { hold?: boolean } = {},
): Promise<boolean> {
  if (!form.aiReply?.enabled || !form.aiReply.prompt.trim()) return false;
  const owner = await ctx.db.get(form.ownerId);
  if (!owner || !(await hasFeature(ctx, form, "ai.reply"))) return false;
  // Staff paused AI for everyone, or turned it off for this account.
  if (!(await aiAllowed(ctx, owner._id))) {
    await ctx.db.patch(responseId, { aiReply: { status: "skipped", reason: "off", at: Date.now() } });
    return false;
  }

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
    return false;
  }
  await ctx.db.patch(responseId, { aiReply: { status: "pending", at: Date.now() } });
  // Held while its voice answers are written out; the transcription starts it.
  if (!hold) await ctx.scheduler.runAfter(0, internal.aiReply.generate, { responseId });
  return true;
}

/** Whether the reply goes by email, so the usual confirmation can wait for it. */
export function emailsReply(form: Pick<Doc<"forms">, "aiReply">) {
  return !!form.aiReply?.enabled && form.aiReply.delivery !== "form";
}

/**
 * Pro: a form that reads every response (aiClassify) without writing replies
 * queues just the reading. A form with AI reply on gets it from the reply.
 * Counted once against the company's AI, like every per-response AI feature.
 */
export async function queueClassify(
  ctx: MutationCtx,
  form: Doc<"forms">,
  responseId: Id<"responses">,
  { hold = false }: { hold?: boolean } = {},
): Promise<boolean> {
  if (!form.aiClassify || form.aiReply?.enabled) return false;
  if (!(await hasFeature(ctx, form, "ai.insights"))) return false;
  if (!(await aiAllowed(ctx, form.ownerId))) return false;
  if (!(await chargeResponse(ctx, form, responseId))) return false;
  if (!hold) await ctx.scheduler.runAfter(0, internal.insights.classify, { responseId });
  return true;
}

/**
 * Pro: the voice answers a complete response has on questions that ask to be
 * written out. Counted once against the company's AI, like the rest.
 */
export async function voiceToWrite(ctx: MutationCtx, form: Doc<"forms">, response: Doc<"responses">) {
  const { blocks } = await servedForm(ctx, form);
  const asked = new Set<string>(blocks.filter((b) => b.type === "voice" && b.transcribe).map((b) => b._id));
  const waiting = response.answers.filter((a) => a.fileId && asked.has(a.blockId) && !a.transcript);
  if (!waiting.length) return false;
  if (!(await hasFeature(ctx, form, "ai.transcribe"))) return false;
  if (!(await aiAllowed(ctx, form.ownerId))) return false;
  return !!(await chargeResponse(ctx, form, response._id));
}
