import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";

/**
 * One response as JSON: what API v2 returns (apiV2.ts) and what the JSON
 * export downloads, so a script written for one reads the other.
 */

const SITE = (process.env.SITE_URL ?? "https://formkit.app").replace(/\/$/, "");

/** Each question's key, by question id, for the answers' `key`. */
export async function keysOf(ctx: QueryCtx, formId: Id<"forms">) {
  const blocks = await ctx.db
    .query("blocks")
    .withIndex("by_form_order", (q) => q.eq("formId", formId))
    .collect();
  return new Map(blocks.map((b) => [b._id as string, b.key]));
}

export async function responseRow(ctx: QueryCtx, r: Doc<"responses">, keys: Map<string, string | undefined>) {
  const answers = [];
  for (const a of r.answers) {
    answers.push({
      questionId: a.blockId,
      key: keys.get(a.blockId) ?? null,
      question: a.question,
      value: a.values?.length ? a.values : (a.fileName ?? a.value ?? null),
      ...(a.fileId ? { fileUrl: await ctx.storage.getUrl(a.fileId) } : {}),
      ...(a.transcript ? { transcript: a.transcript } : {}),
      ...(a.followUp?.answer.trim() ? { followUp: a.followUp } : {}),
    });
  }
  return {
    id: r._id,
    formId: r.formId,
    submittedAt: new Date(r.submittedAt).toISOString(),
    complete: !r.partial,
    status: r.status,
    tags: r.tags ?? [],
    respondent: {
      name: r.respondentName ?? null,
      email: r.respondentEmail ?? null,
      phone: r.respondentPhone ?? null,
      company: r.respondentCompany ?? null,
    },
    answers,
    calculations: r.calc ?? {},
    /** In the currency's minor unit (cents), as Stripe counts it. */
    payment: r.payment
      ? {
          status: r.payment.status,
          amount: r.payment.amount,
          currency: r.payment.currency,
          ...(r.payment.quantity ? { quantity: r.payment.quantity } : {}),
          ...(r.payment.tax ? { tax: r.payment.tax } : {}),
          ...(r.payment.discount ? { discount: r.payment.discount } : {}),
          ...(r.payment.at ? { paidAt: new Date(r.payment.at).toISOString() } : {}),
        }
      : null,
    insight: r.insight ?? null,
    source: r.source ?? null,
    utm: r.utm ?? null,
    ...(r.agent ? { agent: r.agent } : {}),
    viewUrl: `${SITE}/app/responses?open=${r._id}`,
  };
}

export type ResponseJson = Awaited<ReturnType<typeof responseRow>>;
