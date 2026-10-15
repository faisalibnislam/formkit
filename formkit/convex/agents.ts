import { ConvexError, v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import { httpAction, internalMutation, internalQuery, mutation, type QueryCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import { formFor, shouldAutoClose } from "./model/forms";
import { flagOn } from "./model/flags";
import { hasFeature } from "./model/plans";
import { securityOf } from "./model/security";
import { servedForm } from "./model/served";
import { formUrl } from "./model/handles";
import { applyLogic, type Rule } from "./model/logicEval";
import { endingOf } from "./model/jumps";
import { RULES, allowForm } from "./model/rateLimit";
import { spamReason } from "./model/spamText";
import { admit, answerProblems, store, type AnswerIn } from "./publicForm";
import { takesPayment } from "./payments";

/**
 * Forms an AI agent can fill in for someone: their assistant books the
 * appointment or sends the enquiry without driving a browser.
 *
 * Off unless the owner switches it on for the form (every plan). Then
 * formkit.app/api/agent/forms/{slug} describes the questions (GET) and takes
 * answers (POST). The answers go through the same checks as the form in a
 * browser - rules, required questions, places left, one answer per person -
 * plus a spam check, and limits per form and per caller. The response is
 * labelled as sent by an agent, with the name it gave.
 *
 * Forms an agent can't complete say so: a password, a payment, a quiz, or a
 * required upload, signature or recording.
 */

const SITE = (process.env.SITE_URL ?? "https://formkit.app").replace(/\/$/, "");
const endpoint = (slug: string) => `${SITE}/api/agent/forms/${encodeURIComponent(slug)}`;

/** Questions an agent can't answer for someone: they need the person's hand or voice. */
const BY_HAND = new Set(["file", "signature", "voice"]);

const FORMAT: Record<string, string> = {
  email: "an email address",
  phone: "a phone number, with country code",
  url: "a web address",
  number: "a number",
  date: "a date, YYYY-MM-DD",
  time: "a time, HH:MM (24-hour)",
  "yes-no": '"Yes" or "No"',
  rating: "a whole number from 1 to the scale's top",
  scale: "a whole number within the scale",
  "multi-choice": "a list of the options",
  matrix: 'a list of "Row: Column" pairs',
  ranking: "every option, in order, as a list",
};

/** Why an agent can't fill the form in at all, or null. */
async function blocker(ctx: QueryCtx, form: Doc<"forms">, blocks: Doc<"blocks">[]) {
  const s = securityOf(form.security);
  if (s.password) return "It needs a password.";
  if (await takesPayment(ctx, form)) return "It takes a payment.";
  if (form.quiz?.enabled && (await hasFeature(ctx, form, "quiz"))) return "It is a quiz.";
  const byHand = blocks.find((b) => b.kind === "field" && b.required && BY_HAND.has(b.type ?? ""));
  if (byHand) return `“${byHand.title ?? "A question"}” needs the person themselves (an upload, a signature or a recording).`;
  return null;
}

type Reply = { status: number; body: Record<string, unknown> };

async function open(ctx: QueryCtx, slug: string): Promise<{ form: Doc<"forms"> } | Reply> {
  const form = await ctx.db
    .query("forms")
    .withIndex("by_slug", (q) => q.eq("slug", slug))
    .first();
  if (!form || form.deletedAt) return { status: 404, body: { error: "There is no form at this address." } };
  if (!(await flagOn(ctx, "forms.agents", form.ownerId))) {
    return { status: 503, body: { error: "Forms for AI agents are paused. Try again later, or open the form in a browser." } };
  }
  const url = await formUrl(ctx, form);
  if (!form.agents) {
    return { status: 403, body: { error: "The owner of this form hasn't let AI agents fill it in. Give the person the link instead.", url } };
  }
  if (form.status !== "published" || shouldAutoClose(form, Date.now())) {
    return { status: 410, body: { error: "This form isn't taking answers right now.", url } };
  }
  return { form };
}

export const describe = internalQuery({
  args: { slug: v.string() },
  handler: async (ctx, { slug }): Promise<Reply> => {
    const opened = await open(ctx, slug);
    if (!("form" in opened)) return opened;
    const { form } = opened;
    const served = await servedForm(ctx, form);
    const url = await formUrl(ctx, form);
    const stop = await blocker(ctx, served.form, served.blocks);
    let page = 1;
    const questions = [];
    for (const b of served.blocks) {
      if (b.kind === "pagebreak") page++;
      if (b.kind !== "field" || b.type === "hidden" || BY_HAND.has(b.type ?? "")) continue;
      const conditional = served.rules.some((r) => r.enabled && r.targetId === b._id && (r.action === "show" || r.action === "hide" || r.action === "require"));
      questions.push({
        id: b._id,
        ...(b.key ? { key: b.key } : {}),
        type: b.type,
        title: b.title ?? "",
        ...(b.help ? { help: b.help } : {}),
        required: !!b.required,
        ...(conditional ? { dependsOnEarlierAnswers: true } : {}),
        ...(b.type === "yes-no" ? { options: ["Yes", "No"] } : b.options?.length ? { options: b.options } : {}),
        ...(b.allowOther ? { otherAllowed: true } : {}),
        ...(b.rows?.length ? { rows: b.rows } : {}),
        ...(b.scaleMin !== undefined || b.scaleMax !== undefined ? { min: b.scaleMin, max: b.scaleMax } : {}),
        ...(FORMAT[b.type ?? ""] ? { answerAs: FORMAT[b.type ?? ""] } : {}),
        page,
      });
    }
    return {
      status: 200,
      body: {
        form: { title: served.form.title, ...(served.form.description ? { description: served.form.description } : {}), url, language: served.form.language ?? "en" },
        fillable: !stop,
        ...(stop ? { reason: `An agent can't fill this form in. ${stop} Give the person the link instead.` } : {}),
        instructions:
          "Ask the person you're acting for before you send: their answers go to the form's owner, labelled as sent by an AI agent. " +
          "POST JSON here: {\"agent\": {\"name\": \"Your assistant's name\", \"url\": \"https://… (optional)\"}, \"onBehalfOf\": \"their name (optional)\", " +
          "\"answers\": {\"<question id or key>\": \"answer\" or [\"answers\"]}}. Some questions apply only after certain answers; " +
          "the reply lists anything to fix, question by question.",
        submit: { method: "POST", url: endpoint(slug), contentType: "application/json" },
        questions,
      },
    };
  },
});

type Body = { agent?: { name?: unknown; url?: unknown }; onBehalfOf?: unknown; answers?: unknown };

const text = (x: unknown, max: number) => (typeof x === "string" ? x.trim().slice(0, max) : "");

export const submit = internalMutation({
  args: { slug: v.string(), body: v.any(), caller: v.string() },
  handler: async (ctx, { slug, body, caller }): Promise<Reply> => {
    const opened = await open(ctx, slug);
    if (!("form" in opened)) return opened;
    const { form } = opened;
    const served = await servedForm(ctx, form);
    const stop = await blocker(ctx, served.form, served.blocks);
    if (stop) return { status: 403, body: { error: `An agent can't fill this form in. ${stop}`, url: await formUrl(ctx, form) } };

    const b = (body ?? {}) as Body;
    const name = text(b.agent?.name, 80);
    if (!name) return { status: 400, body: { error: "Say who is sending: agent.name, the assistant's name." } };
    const agentUrl = text(b.agent?.url, 200);
    const forWhom = text(b.onBehalfOf, 120);
    if (!b.answers || typeof b.answers !== "object" || Array.isArray(b.answers)) {
      return { status: 400, body: { error: "answers is an object: question id or key to the answer." } };
    }

    // Answers by question id or key, in the shapes the form keeps.
    const fields = served.blocks.filter((x) => x.kind === "field" && x.type !== "hidden" && !BY_HAND.has(x.type ?? ""));
    const answers: AnswerIn[] = [];
    const unknown: string[] = [];
    for (const [k, raw] of Object.entries(b.answers as Record<string, unknown>)) {
      const q = fields.find((x) => x._id === k || (x.key && x.key === k));
      if (!q) {
        unknown.push(k);
        continue;
      }
      const list = Array.isArray(raw) ? raw : [raw];
      const strings = list
        .filter((x) => x !== null && x !== undefined && x !== "")
        .map((x) => (typeof x === "boolean" ? (x ? "Yes" : "No") : String(x).slice(0, 5000)))
        .slice(0, 50);
      if (!strings.length) continue;
      const many = q.type === "multi-choice" || q.type === "matrix" || q.type === "ranking";
      answers.push(many ? { blockId: q._id, values: strings } : { blockId: q._id, value: strings[0] });
    }
    if (unknown.length) {
      return { status: 422, body: { error: "Some answers name no question on this form.", unknown, questions: endpoint(slug) } };
    }

    if (!(await allowForm(ctx, "agent", form._id, caller, RULES.agentsPerForm, RULES.agentsPerCaller))) {
      return { status: 429, body: { error: "Too many answers from agents just now. Try again in an hour." } };
    }
    const why = spamReason([name, forWhom, ...answers.flatMap((a) => a.values ?? [a.value ?? ""])]);
    if (why) return { status: 422, body: { error: `That looks like spam (${why}), so it wasn't sent.` } };

    const problems = await answerProblems(ctx, form, { partial: false, answers });
    if (problems.length) {
      return {
        status: 422,
        body: {
          error: "Some answers need fixing before this can be sent.",
          problems: problems.map((p) => ({ ...(p.blockId ? { question: p.blockId } : {}), message: p.message })),
        },
      };
    }

    // The ending the answers lead to, as the form in a browser would work it out.
    const types = Object.fromEntries(served.blocks.map((x) => [x._id as string, x.type]));
    const advanced = await hasFeature(ctx, form, "logic.advanced");
    const rules = served.rules.filter((r) => r.enabled && (advanced || (r.action !== "hide-options" && r.action !== "ending")));
    const outcome = applyLogic(rules as unknown as Rule[], {
      answers: Object.fromEntries(answers.map((a) => [a.blockId as string, { value: a.value, values: a.values }])),
      types,
    });
    const finish = outcome.jumps.find((r) => !r.targetId && r.endingId);
    const ending = finish ? endingOf(finish.endingId!) : (outcome.ending ?? undefined);

    const deviceId = `agent:${caller}`;
    try {
      await admit(ctx, form, { deviceId, answers }, null);
    } catch (e) {
      const message = e instanceof ConvexError ? String(e.data) : "That couldn't be sent.";
      return { status: 409, body: { error: message } };
    }
    const sent = await store(ctx, form, { partial: false, device: "AI agent", source: `AI agent · ${name}`, deviceId, ending, answers }, null, false);
    await ctx.db.patch(sent.responseId, {
      agent: { name, ...(agentUrl.startsWith("https://") ? { url: agentUrl } : {}), ...(forWhom ? { forWhom } : {}) },
    });
    const saved = await ctx.db.get(sent.responseId);
    return {
      status: 201,
      body: {
        ok: true,
        message: "Sent. The form's owner has the answers.",
        ...(saved?.receiptToken ? { receipt: `${SITE}/receipt/${saved.receiptToken}` } : {}),
      },
    };
  },
});

/** The builder's switch: Settings → Who can answer → AI agents. */
export const setEnabled = mutation({
  args: { formId: v.id("forms"), on: v.boolean() },
  returns: v.null(),
  handler: async (ctx, { formId, on }) => {
    await formFor(ctx, formId);
    await ctx.db.patch(formId, { agents: on || undefined, updatedAt: Date.now() });
    return null;
  },
});

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const json = (r: Reply) =>
  new Response(JSON.stringify(r.body, null, 2), { status: r.status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...CORS } });

/** A caller's address, hashed: counted against, never kept as it is. */
async function callerOf(request: Request) {
  const ip = (request.headers.get("x-forwarded-for") ?? "").split(",")[0]!.trim() || "unknown";
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`agent:${ip}`)));
  return Array.from(digest.slice(0, 12), (x) => x.toString(16).padStart(2, "0")).join("");
}

/** /agent/forms/{slug}: GET describes, POST sends. */
export const http = httpAction(async (ctx, request) => {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  const slug = decodeURIComponent(new URL(request.url).pathname.split("/").filter(Boolean).pop() ?? "");
  if (!slug) return json({ status: 404, body: { error: "There is no form at this address." } });
  if (request.method === "GET") return json(await ctx.runQuery(internal.agents.describe, { slug }));
  if (request.method !== "POST") return json({ status: 405, body: { error: "GET to read the form, POST to send answers." } });
  let body: unknown;
  try {
    const raw = await request.text();
    if (raw.length > 200_000) return json({ status: 413, body: { error: "That is too much to send at once." } });
    body = JSON.parse(raw);
  } catch {
    return json({ status: 400, body: { error: "Send JSON." } });
  }
  return json(await ctx.runMutation(internal.agents.submit, { slug, body, caller: await callerOf(request) }));
});
