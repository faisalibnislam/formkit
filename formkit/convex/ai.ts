import { v } from "convex/values";
import { action, internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { aiAllowed, aiLimit, requireUser } from "./model/identity";
import { formFor, storedBlock, uniqueSlug } from "./model/forms";

/**
 * Ask Formkit.
 *
 * Access is an admin-granted allow-list, off by default. An account without it
 * has no AI surface anywhere in the product — this module refuses, and the app
 * never renders a locked state or an upsell. That was decided deliberately;
 * please do not add one back.
 *
 * A credit is spent when a request reaches the model, not when it succeeds, so
 * a refused or failed call does not silently consume one — the mutation that
 * counts runs only after a successful response.
 */

const MODEL = "claude-sonnet-5";
const QUESTION_TYPES = [
  "short-text",
  "long-text",
  "email",
  "phone",
  "url",
  "name",
  "company",
  "address",
  "number",
  "single-choice",
  "multi-choice",
  "dropdown",
  "yes-no",
  "date",
  "time",
  "rating",
  "scale",
  "file",
  "signature",
];

const SYSTEM = `You write forms for Formkit.

Return a form as JSON only, with no commentary. The shape is:
{"title": string, "welcome": {"title": string, "message": string},
 "thanks": {"title": string, "message": string},
 "blocks": [ {"kind":"field","type":<one of the types>,"title":string,
              "help"?:string,"required"?:boolean,"options"?:string[],
              "scaleMin"?:number,"scaleMax"?:number}
           | {"kind":"pagebreak","pageName":string} ]}

Types: ${QUESTION_TYPES.join(", ")}.

Rules:
- Ask the fewest questions that do the job. A shorter form gets finished.
- Write questions as a person would say them out loud, ending in a question mark.
- Only single-choice, multi-choice and dropdown carry options, and every option
  is a real answer somebody might give.
- Put a page break wherever the subject changes; never more than about six
  questions on one page.
- Mark a question required only when the form is useless without it.
- Never invent a question that collects more personal data than the stated
  purpose needs.`;

/* ------------------------------------------------------------------ */

export const context = internalQuery({
  args: { formId: v.optional(v.id("forms")) },
  handler: async (ctx, { formId }) => {
    const user = await requireUser(ctx);
    const allowed = await aiAllowed(ctx, user._id);
    const limit = await aiLimit(ctx, user._id);
    const period = new Date().toISOString().slice(0, 7);
    const used = user.aiPeriod === period ? (user.aiUsed ?? 0) : 0;

    const existing = formId
      ? await (async () => {
          const form = await formFor(ctx, formId, "read");
          const blocks = (
            await ctx.db
              .query("blocks")
              .withIndex("by_form_order", (q) => q.eq("formId", formId))
              .collect()
          ).sort((a, b) => a.order - b.order);
          return {
            title: form.title,
            blocks: blocks.map((b) => ({
              kind: b.kind,
              type: b.type,
              title: b.title,
              options: b.options,
              pageName: b.pageName,
            })),
          };
        })()
      : null;

    return { userId: user._id, allowed, limit, used, existing };
  },
});

/** Counting a credit and writing the questions happen together. */
export const apply = internalMutation({
  args: {
    userId: v.id("users"),
    formId: v.optional(v.id("forms")),
    form: v.any(),
  },
  returns: v.id("forms"),
  handler: async (ctx, { userId, formId, form }) => {
    const now = Date.now();
    const period = new Date().toISOString().slice(0, 7);
    const user = await ctx.db.get(userId);
    if (!user) throw new Error("That account no longer exists.");

    await ctx.db.patch(userId, {
      aiPeriod: period,
      aiUsed: (user.aiPeriod === period ? (user.aiUsed ?? 0) : 0) + 1,
    });

    const shape = form as {
      title?: string;
      welcome?: unknown;
      thanks?: unknown;
      blocks?: unknown[];
    };
    const blocks = (shape.blocks ?? []).filter(
      (b): b is Record<string, unknown> => typeof b === "object" && b !== null,
    );

    let target = formId ?? null;
    if (target) {
      // Replacing an existing form's questions; everything else is left alone.
      const existing = await ctx.db
        .query("blocks")
        .withIndex("by_form_order", (q) => q.eq("formId", target!))
        .collect();
      for (const b of existing) await ctx.db.delete(b._id);
    } else {
      const title = shape.title?.trim() || "Untitled form";
      const companies = await ctx.db
        .query("companies")
        .withIndex("by_owner", (q) => q.eq("ownerId", userId))
        .collect();
      const branded = companies.find((c) => c.useBranding);
      target = await ctx.db.insert("forms", {
        ownerId: userId,
        brand: branded ? branded._id : "me",
        title,
        slug: await uniqueSlug(ctx, title),
        status: "draft",
        welcome: shape.welcome as never,
        thanks: shape.thanks as never,
        responsesCount: 0,
        completedCount: 0,
        views: 0,
        starts: 0,
        createdAt: now,
        updatedAt: now,
      });
    }

    for (const [i, block] of blocks.entries()) {
      const kind = block.kind === "pagebreak" ? "pagebreak" : "field";
      const type = QUESTION_TYPES.includes(String(block.type)) ? block.type : "short-text";
      await ctx.db.insert("blocks", {
        ...storedBlock({ ...block, kind, type }),
        formId: target as Id<"forms">,
        order: i,
      });
    }

    await ctx.db.patch(target as Id<"forms">, { updatedAt: now });
    await ctx.db.insert("activity", {
      formId: target as Id<"forms">,
      userId,
      what: formId ? "Rewrote the questions with Ask Formkit" : "Created with Ask Formkit",
      at: now,
    });

    return target as Id<"forms">;
  },
});

/* ------------------------------------------------------------------ */

type AskResult = { formId: Id<"forms">; used: number; limit: number };

export const ask = action({
  args: { prompt: v.string(), formId: v.optional(v.id("forms")) },
  returns: v.object({ formId: v.id("forms"), used: v.number(), limit: v.number() }),
  handler: async (ctx, { prompt, formId }): Promise<AskResult> => {
    const seat: {
      userId: Id<"users">;
      allowed: boolean;
      limit: number;
      used: number;
      existing: unknown;
    } = await ctx.runQuery(internal.ai.context, { formId });

    if (!seat.allowed) throw new Error("Ask Formkit is not on for this account.");
    if (seat.used >= seat.limit) {
      throw new Error(
        `You have used all ${seat.limit} form credits this month. They reset on the first.`,
      );
    }

    const key = process.env.ANTHROPIC_API_KEY;
    if (!key) {
      throw new Error(
        "Ask Formkit has no model key configured. Set ANTHROPIC_API_KEY on the Convex deployment.",
      );
    }

    const instruction = seat.existing
      ? `Here is the form as it stands:\n${JSON.stringify(seat.existing)}\n\nChange it as asked: ${prompt}`
      : `Write a form for this: ${prompt}`;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 4096,
        system: SYSTEM,
        messages: [{ role: "user", content: instruction }],
      }),
    });

    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`The model did not answer — ${response.status}. ${detail.slice(0, 200)}`);
    }

    const payload = (await response.json()) as {
      content?: { type: string; text?: string }[];
    };
    const text = (payload.content ?? [])
      .filter((c) => c.type === "text")
      .map((c) => c.text ?? "")
      .join("");

    // The model is asked for JSON only, but a stray sentence must not lose the form.
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start < 0 || end <= start) {
      throw new Error("Formkit could not read that answer as a form. Try describing it again.");
    }

    let form: unknown;
    try {
      form = JSON.parse(text.slice(start, end + 1));
    } catch {
      throw new Error("Formkit could not read that answer as a form. Try describing it again.");
    }

    const written: Id<"forms"> = await ctx.runMutation(internal.ai.apply, {
      userId: seat.userId,
      formId,
      form,
    });

    return { formId: written, used: seat.used + 1, limit: seat.limit };
  },
});
