import { v } from "convex/values";
import {
  action,
  internalMutation,
  internalQuery,
  mutation,
  type ActionCtx,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { aiAllowed, aiLimit, requireUser } from "./model/identity";
import { formFor, recount, uniqueSlug } from "./model/forms";
import { hasFeature } from "./model/plans";
import { logActivity } from "./model/access";
import { OPERATORS } from "./logic";
import { THEME_PRESETS } from "./model/themePresets";
import {
  checkRule,
  clean,
  coerceType,
  describe,
  draftAsJson,
  DRAFT_SCHEMA,
  FORM_RULES,
  ITEM_SCHEMA,
  PERSONAL_TYPES,
  RULE_SCHEMA,
  toDraft,
  toItem,
  VOICE,
  type Draft,
  type DraftItem,
  type DraftRule,
  type RawDraft,
  type RawItem,
} from "./model/aiForms";
import { aiIntent, type Intent } from "./model/aiIntent";
import { generate, ModelError, parseJson, voice, type Meter, type Part } from "./model/gemini";
import { flagOn } from "./model/flags";

export type { Draft, DraftItem, DraftRule };

/**
 * Ask Formkit, on Gemini.
 *
 * Access is an admin-granted allow-list, off by default. An account without it
 * has no AI surface anywhere in the product - this module refuses, and the app
 * never renders a locked state or an upsell. That was decided deliberately;
 * please do not add one back.
 *
 * Only building a new form spends a credit, and only once the model has
 * answered with something usable - a refused, failed or unreadable call costs
 * nothing. Adding questions, rewriting them, writing logic, picking a theme,
 * reading responses and talking are free.
 *
 * Every answer from the model is treated as untrusted input: types are coerced,
 * rules are checked against the same operators the Logic tab offers, a theme
 * can only be one of the presets, and nothing personal from a response (names,
 * emails, phone numbers, addresses, files) is ever sent to it.
 */

/* ------------------------------------------------------------------ */
/* Shapes                                                               */

type Snapshot = {
  id: Id<"forms">;
  title: string;
  brandColor: string | null;
  blocks: {
    id: Id<"blocks">;
    kind: "field" | "pagebreak";
    type?: string;
    title?: string;
    help?: string;
    required?: boolean;
    options?: string[];
    pageName?: string;
  }[];
};

type Attach = {
  kind: "brief" | "form" | "file";
  label: string;
  text?: string;
  formId?: Id<"forms">;
  storageId?: Id<"_storage">;
  mime?: string;
};

type HistoryTurn = { from: "user" | "fk"; text: string };

export type AskResult =
  | { kind: "chat"; text: string; note?: string }
  | { kind: "draft"; draft: Draft; note?: string; revised: boolean; used: number; limit: number }
  | { kind: "added"; formId: Id<"forms">; title: string; items: { type: string; title: string; options?: string[] }[] }
  | {
      kind: "rules";
      formId: Id<"forms">;
      title: string;
      items: { name: string; when: string; operator: string; value?: string; action: string; target: string }[];
    }
  | { kind: "theme"; formId: Id<"forms">; title: string; name: string; swatches: string[]; brand: boolean }
  | {
      kind: "diff";
      formId: Id<"forms">;
      title: string;
      mode: string;
      items: { blockId: Id<"blocks">; before: string; after: string }[];
    }
  | { kind: "insight"; formId: Id<"forms">; title: string; text: string; items: { k: string; v: string; n: string }[] }
  | { kind: "limit"; used: number; limit: number }
  | { kind: "say"; text: string; note?: string };

/* ------------------------------------------------------------------ */
/* Reading                                                              */

function currentPeriod() {
  return new Date().toISOString().slice(0, 7);
}

async function snapshot(ctx: QueryCtx, form: Doc<"forms">): Promise<Snapshot> {
  const blocks = (
    await ctx.db
      .query("blocks")
      .withIndex("by_form_order", (q) => q.eq("formId", form._id))
      .collect()
  ).sort((a, b) => a.order - b.order);
  const company = form.brand !== "me" ? await ctx.db.get(form.brand) : null;
  return {
    id: form._id,
    title: form.title,
    brandColor: company?.brandColor ?? null,
    blocks: blocks.map((b) => ({
      id: b._id,
      kind: b.kind,
      type: b.type,
      title: b.title,
      help: b.help,
      required: b.required,
      options: b.options,
      pageName: b.pageName,
    })),
  };
}

export const context = internalQuery({
  args: { formId: v.optional(v.id("forms")), riffId: v.optional(v.id("forms")) },
  handler: async (ctx, { formId, riffId }) => {
    const user = await requireUser(ctx);
    const allowed = await aiAllowed(ctx, user._id);
    const limit = await aiLimit(ctx, user._id);
    const used = user.aiPeriod === currentPeriod() ? (user.aiUsed ?? 0) : 0;
    const form = formId ? await snapshot(ctx, await formFor(ctx, formId, "read")) : null;
    const riff = riffId ? await snapshot(ctx, await formFor(ctx, riffId, "read")) : null;
    return {
      userId: user._id,
      firstName: (user.name ?? "").split(/\s+/)[0] ?? "",
      allowed,
      limit,
      used,
      form,
      riff,
      live: await flagOn(ctx, "ai.live", user._id),
      brief: (await flagOn(ctx, "ai.brief", user._id)) && (await hasFeature(ctx, user, "ai.brief")),
    };
  },
});

/**
 * What the responses say, reduced to what the model needs: counts, timings,
 * how choice questions split, and a sample of written answers. Nothing that
 * identifies a respondent leaves this function.
 */
export const responsesFor = internalQuery({
  args: { formId: v.id("forms") },
  handler: async (ctx, { formId }) => {
    const form = await formFor(ctx, formId, "read");
    const blocks = await ctx.db
      .query("blocks")
      .withIndex("by_form_order", (q) => q.eq("formId", formId))
      .collect();
    const all = (await ctx.db.query("responses").withIndex("by_form", (q) => q.eq("formId", formId)).collect())
      .filter((r) => !r.preview)
      .sort((a, b) => b.submittedAt - a.submittedAt);
    const rows = all.slice(0, 400);

    const complete = rows.filter((r) => !r.partial);
    const durations = complete
      .map((r) => r.durationMs ?? 0)
      .filter((d) => d > 0)
      .sort((a, b) => a - b);
    const median = durations.length ? durations[Math.floor(durations.length / 2)]! : 0;

    const questions = blocks
      .filter((b) => b.kind === "field" && b.type && !PERSONAL_TYPES.has(b.type))
      .sort((a, b) => a.order - b.order)
      .slice(0, 20)
      .map((b) => {
        const answers = rows.flatMap((r) => r.answers.filter((a) => a.blockId === b._id));
        const counted = new Map<string, number>();
        const written: string[] = [];
        for (const a of answers) {
          const values = a.values?.length ? a.values : a.value ? [a.value] : [];
          if (["long-text", "short-text"].includes(b.type!)) {
            for (const text of values) if (written.length < 25) written.push(text.slice(0, 220));
          } else {
            for (const val of values) counted.set(val, (counted.get(val) ?? 0) + 1);
          }
        }
        return {
          question: b.title ?? "",
          type: b.type,
          answered: answers.length,
          split: [...counted.entries()].sort((x, y) => y[1] - x[1]).slice(0, 8),
          written,
        };
      });

    // Where people stopped: the first unanswered question of each partial.
    const stops = new Map<string, number>();
    for (const r of rows.filter((x) => x.partial)) {
      const answered = new Set(r.answers.map((a) => a.blockId));
      const first = blocks
        .filter((b) => b.kind === "field")
        .sort((a, b) => a.order - b.order)
        .find((b) => !answered.has(b._id));
      if (first?.title) stops.set(first.title, (stops.get(first.title) ?? 0) + 1);
    }

    return {
      title: form.title,
      total: all.length,
      read: rows.length,
      complete: complete.length,
      partial: rows.length - complete.length,
      unread: all.filter((r) => r.status === "new").length,
      views: form.views ?? 0,
      medianMs: median,
      stops: [...stops.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3),
      questions,
    };
  },
});

/* ------------------------------------------------------------------ */
/* Writing                                                              */

export const spend = internalMutation({
  args: { userId: v.id("users") },
  returns: v.number(),
  handler: async (ctx, { userId }) => {
    const user = await ctx.db.get(userId);
    if (!user) throw new Error("That account no longer exists.");
    const period = currentPeriod();
    const used = (user.aiPeriod === period ? (user.aiUsed ?? 0) : 0) + 1;
    await ctx.db.patch(userId, { aiPeriod: period, aiUsed: used });
    return used;
  },
});

async function nextOrder(ctx: MutationCtx, formId: Id<"forms">) {
  const last = await ctx.db
    .query("blocks")
    .withIndex("by_form_order", (q) => q.eq("formId", formId))
    .order("desc")
    .first();
  return last ? last.order + 1 : 0;
}

const itemValidator = v.object({
  type: v.string(),
  title: v.string(),
  help: v.optional(v.string()),
  required: v.boolean(),
  options: v.optional(v.array(v.string())),
});

export const addQuestions = internalMutation({
  args: { formId: v.id("forms"), items: v.array(itemValidator) },
  handler: async (ctx, { formId, items }) => {
    const user = await requireUser(ctx);
    await formFor(ctx, formId);
    let order = await nextOrder(ctx, formId);
    for (const it of items) {
      await ctx.db.insert("blocks", {
        formId,
        order: order++,
        kind: "field",
        type: coerceType(it.type),
        title: it.title,
        help: it.help,
        required: it.required,
        options: it.options,
      });
    }
    await ctx.db.patch(formId, { updatedAt: Date.now() });
    await recount(ctx, formId);
    await logActivity(
      ctx,
      formId,
      user._id,
      `added ${items.length} ${items.length === 1 ? "question" : "questions"} with Ask Formkit`,
      "sparkles",
    );
  },
});

export const addRules = internalMutation({
  args: {
    formId: v.id("forms"),
    rules: v.array(
      v.object({
        name: v.string(),
        whenId: v.id("blocks"),
        operator: v.string(),
        value: v.optional(v.string()),
        action: v.union(v.literal("show"), v.literal("hide"), v.literal("require")),
        targetId: v.id("blocks"),
      }),
    ),
  },
  handler: async (ctx, { formId, rules }) => {
    const user = await requireUser(ctx);
    await formFor(ctx, formId);
    const existing = await ctx.db
      .query("logicRules")
      .withIndex("by_form", (q) => q.eq("formId", formId))
      .collect();
    let order = existing.length;
    for (const r of rules) {
      await ctx.db.insert("logicRules", {
        formId,
        name: r.name,
        enabled: true,
        join: "and",
        conditions: [{ blockId: r.whenId, operator: r.operator, value: r.value }],
        action: r.action,
        targetId: r.targetId,
        order: order++,
      });
    }
    await ctx.db.patch(formId, { updatedAt: Date.now() });
    await logActivity(
      ctx,
      formId,
      user._id,
      `added ${rules.length} logic ${rules.length === 1 ? "rule" : "rules"} with Ask Formkit`,
      "git-branch",
    );
  },
});

function presetTheme(id: string, primary?: string) {
  const p = THEME_PRESETS.find((t) => t.id === id) ?? THEME_PRESETS[0]!;
  return { preset: p.id, bg: p.bg, surface: p.surface, text: p.text, primary: primary ?? p.primary, radius: p.radius };
}

export const setTheme = internalMutation({
  args: { formId: v.id("forms"), preset: v.string(), primary: v.optional(v.string()) },
  handler: async (ctx, { formId, preset, primary }) => {
    const user = await requireUser(ctx);
    const form = await formFor(ctx, formId);
    await ctx.db.patch(formId, {
      theme: { ...((form.theme as object | undefined) ?? {}), ...presetTheme(preset, primary) },
      updatedAt: Date.now(),
    });
    await logActivity(ctx, formId, user._id, "set the theme with Ask Formkit", "palette");
  },
});

/** Apply a rewrite the person has read and accepted. */
export const applyRewrite = mutation({
  args: {
    formId: v.id("forms"),
    items: v.array(v.object({ blockId: v.id("blocks"), title: v.string() })),
  },
  returns: v.number(),
  handler: async (ctx, { formId, items }) => {
    const user = await requireUser(ctx);
    await formFor(ctx, formId);
    let changed = 0;
    for (const it of items) {
      const block = await ctx.db.get(it.blockId);
      if (!block || block.formId !== formId || block.kind !== "field") continue;
      const title = it.title.trim().slice(0, 240);
      if (!title || title === block.title) continue;
      await ctx.db.patch(it.blockId, { title });
      changed += 1;
    }
    if (changed) {
      await ctx.db.patch(formId, { updatedAt: Date.now() });
      await logActivity(ctx, formId, user._id, `rewrote ${changed} ${changed === 1 ? "question" : "questions"} with Ask Formkit`, "sparkles");
    }
    return changed;
  },
});

/** Turn a draft into a real form: questions, rules and theme together. */
export const commit = mutation({
  args: { draft: v.any() },
  returns: v.id("forms"),
  handler: async (ctx, { draft: raw }) => {
    const user = await requireUser(ctx);
    if (!(await aiAllowed(ctx, user._id))) throw new Error("Ask Formkit is not on for this account.");
    // The draft came back through the browser, so it is checked again here.
    const checked = toDraft(parseJson<RawDraft>(draftAsJson(raw as Draft)));
    if (!checked) throw new Error("That draft could not be read. Ask for it again.");
    const draft = checked.draft;
    const now = Date.now();

    const companies = await ctx.db
      .query("companies")
      .withIndex("by_owner", (q) => q.eq("ownerId", user._id))
      .collect();
    const branded = companies.find((c) => c.useBranding);
    const formId = await ctx.db.insert("forms", {
      ownerId: user._id,
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
    await logActivity(ctx, formId, user._id, "created the form with Ask Formkit", "sparkles");
    return formId;
  },
});

/* ------------------------------------------------------------------ */
/* The conversation                                                     */

function chatFallback(t: string, left: number, limit: number, formTitle: string | null) {
  const p = ` ${t.toLowerCase()} `;
  if (/how many credits|credits left|what do you cost|how much/.test(p)) {
    return left > 0
      ? `You have ${left} of ${limit} form credits left this month. Building a new form spends one. Adding questions, rewriting them, writing logic, picking a theme and reading responses are all free.`
      : `You have used all ${limit} form credits this month. Changing forms you already have is still free, and the count resets on the first.`;
  }
  if (/^\s*(thanks|thank you|cheers|ta|nice one|great|perfect|cool)\b/.test(p)) return "Any time.";
  if (/^\s*(bye|never mind|nevermind)\b/.test(p)) return "I am here when you need me.";
  return formTitle
    ? `I am looking at ${formTitle}. Ask me to add questions, rewrite them in a different tone, write logic rules, pick a theme or read its responses.`
    : "Describe the form you need in a sentence and I will write it. Or pick a form above and ask me to change it, or what its responses are saying.";
}

function base64(bytes: Uint8Array) {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

export const run = action({
  args: {
    text: v.string(),
    formId: v.optional(v.id("forms")),
    draft: v.optional(v.any()),
    attach: v.optional(
      v.object({
        kind: v.union(v.literal("brief"), v.literal("form"), v.literal("file")),
        label: v.string(),
        text: v.optional(v.string()),
        formId: v.optional(v.id("forms")),
        storageId: v.optional(v.id("_storage")),
        mime: v.optional(v.string()),
      }),
    ),
    history: v.optional(v.array(v.object({ from: v.union(v.literal("user"), v.literal("fk")), text: v.string() }))),
  },
  handler: async (ctx, args): Promise<AskResult> => {
    const text = args.text.trim().slice(0, 4000);
    const attach = args.attach as Attach | undefined;
    const seat = await ctx.runQuery(internal.ai.context, {
      formId: args.formId,
      riffId: attach?.kind === "form" ? attach.formId : undefined,
    });
    if (!seat.allowed) throw new Error("Ask Formkit is not on for this account.");
    // Every model call below is costed to the person asking.
    const m: Asker = { ctx, userId: seat.userId };

    const pending = args.draft ? toDraft(parseJson<RawDraft>(draftAsJson(args.draft as Draft)))?.draft : undefined;
    const intent: Intent = aiIntent(text, { hasForm: Boolean(seat.form), hasDraft: Boolean(pending) });
    const left = Math.max(0, seat.limit - seat.used);

    try {
      // The "Live AI generation" flag: off, nothing reaches the model and
      // nothing is written or spent; plain questions still get an answer.
      if (!seat.live) {
        if (intent === "chat") {
          return { kind: "chat", text: chatFallback(text, left, seat.limit, seat.form?.title ?? null), note: "Answered offline" };
        }
        return {
          kind: "say",
          text: "Formkit has switched off AI writing for the moment. Nothing was changed and no credit was used.",
          note: "Nothing spent",
        };
      }
      // "Build from a brief": off, attachments are refused rather than ignored.
      if (attach && !seat.brief) {
        return {
          kind: "say",
          text: "Working from a brief, a document or another form is switched off for now. Ask again without the attachment.",
          note: "Nothing spent",
        };
      }
      switch (intent) {
        case "chat":
          return await chat(m, text, args.history ?? [], seat, left);
        case "create":
          if (left <= 0) return { kind: "limit", used: seat.used, limit: seat.limit };
          return await create(ctx, m, text, attach, seat);
        case "revise":
          return await revise(m, text, pending!, seat);
        case "insight":
          return await insight(ctx, m, text, seat.form);
        default:
          if (pending) return await revise(m, text, pending, seat);
          if (!seat.form) {
            return {
              kind: "say",
              text: "Pick a form to work on from the menu above, or describe a new one and I will build it.",
            };
          }
          if (intent === "append") return await append(ctx, m, text, seat.form);
          if (intent === "logic") return await logic(ctx, m, text, seat.form);
          if (intent === "theme") return await theme(ctx, m, text, seat.form);
          return await tone(m, text, seat.form);
      }
    } catch (e) {
      if (e instanceof ModelError) {
        if (intent === "chat") {
          return { kind: "chat", text: chatFallback(text, left, seat.limit, seat.form?.title ?? null), note: "Answered offline" };
        }
        return {
          kind: "say",
          text:
            e.reason === "no-key"
              ? "Ask Formkit is not connected to its model yet. An admin needs to add the key."
              : `${e.message} Nothing was changed${intent === "create" ? " and no credit was used" : ""}.`,
          note: e.reason === "no-key" ? undefined : "Nothing spent",
        };
      }
      throw e;
    } finally {
      // An uploaded document is read once and not kept.
      if (attach?.storageId) await ctx.storage.delete(attach.storageId).catch(() => {});
    }
  },
});

/** Who is asking, for costing each model call to them. */
type Asker = Omit<Meter, "feature">;

type Seat = {
  userId: Id<"users">;
  firstName: string;
  limit: number;
  used: number;
  form: Snapshot | null;
  riff: Snapshot | null;
};

async function chat(m: Asker, text: string, history: HistoryTurn[], seat: Seat, left: number): Promise<AskResult> {
  const system = `You are Formkit, a form building tool, talking to the person using it${seat.firstName ? ` (${seat.firstName})` : ""}.
Reply in plain text, no markdown, at most three sentences. Never say you are an AI model.
${VOICE}
State what is true and what they can do next.
Facts you may use: they have ${left} of ${seat.limit} monthly form credits left. Building a new form spends one credit; adding questions, rewriting questions, writing logic rules, picking a theme and summarising responses are free. Credits reset on the first of the month. Formkit has three plans: Free, Pro and Business. For prices and what each includes, send them to formkit.app/pricing rather than quoting figures.
${seat.form ? `They are working on the form "${seat.form.title}".` : "No form is selected; they can pick one from the menu above the chat."}
You can: write a whole form from a sentence, a pasted brief or a document; add questions; rewrite questions in another tone; write show, hide and require rules; pick one of the ten themes; read what the responses say.
You cannot: publish, send email, delete questions or change settings. Those are done in the builder.
If they greet you or ask what you do, answer briefly and invite them to describe a form. Do not write a form here.`;
  const turns = [
    ...history.slice(-8).map((h) => ({ role: h.from === "user" ? ("user" as const) : ("model" as const), parts: [{ text: h.text.slice(0, 1500) }] })),
    { role: "user" as const, parts: [{ text }] },
  ];
  // The API wants the conversation to open with the person.
  while (turns.length && turns[0]!.role !== "user") turns.shift();
  const { text: reply } = await generate({ meter: { ...m, feature: "ask.chat" }, system, turns, maxTokens: 400, timeoutMs: 20_000, temperature: 0.5 });
  return { kind: "chat", text: voice(reply.replace(/[*_#`]/g, "")).slice(0, 700) };
}

async function create(
  ctx: ActionCtx,
  m: Asker,
  text: string,
  attach: Attach | undefined,
  seat: Seat,
): Promise<AskResult> {
  const parts: Part[] = [{ text: `Write a form for this: ${text}` }];
  if (attach?.kind === "brief" && attach.text) {
    parts.push({ text: `Here is the brief to work from:\n"""\n${attach.text.slice(0, 12000)}\n"""` });
  }
  if (attach?.kind === "form" && seat.riff) {
    parts.push({
      text: `Base it on the shape of this existing form, "${seat.riff.title}", without copying it word for word:\n${describe(seat.riff.blocks)}`,
    });
  }
  if (attach?.kind === "file") {
    if (attach.text) {
      parts.push({ text: `The person attached "${attach.label}". Its text:\n"""\n${attach.text.slice(0, 20000)}\n"""` });
    } else if (attach.storageId) {
      const blob = await ctx.storage.get(attach.storageId);
      if (blob && blob.size <= 8 * 1024 * 1024) {
        parts.push({ text: `The person attached "${attach.label}". Work from it:` });
        parts.push({
          inlineData: { mimeType: attach.mime ?? "application/pdf", data: base64(new Uint8Array(await blob.arrayBuffer())) },
        });
      }
    }
  }

  const system = `You design forms for Formkit. Reply with the form as JSON matching the schema.
${FORM_RULES}
Rules: optional. Only add a rule when some questions plainly apply to some people and not others. A rule names the questions it reads and changes by their exact wording, and a choice rule's value is one of that question's options exactly. Actions: show, hide, require.
Theme: optional, one of ${THEME_PRESETS.map((t) => `${t.id} (${t.name})`).join(", ")}. Leave it out unless the request suggests a mood.`;

  const { text: raw } = await generate({ meter: { ...m, feature: "ask.build" }, system, turns: [{ role: "user", parts }], schema: DRAFT_SCHEMA, maxTokens: 6000 });
  const checked = toDraft(parseJson<RawDraft>(raw));
  if (!checked) throw new ModelError("What came back was not a usable form.", "empty");

  const used = await ctx.runMutation(internal.ai.spend, { userId: seat.userId });
  return { kind: "draft", draft: checked.draft, note: checked.note || undefined, revised: false, used, limit: seat.limit };
}


async function revise(m: Asker, text: string, draft: Draft, seat: Seat): Promise<AskResult> {
  const system = `You edit a draft form for Formkit. Reply with the whole form as JSON matching the schema, changed as asked and otherwise left as it was.
${FORM_RULES}
Rules name questions by their exact wording; keep them in step if you reword a question. Theme is one of ${THEME_PRESETS.map((t) => t.id).join(", ")}.
In note, say in one sentence what you changed.`;
  const { text: raw } = await generate({ meter: { ...m, feature: "ask.build" },
    system,
    turns: [{ role: "user", parts: [{ text: `The draft:\n${draftAsJson(draft)}\n\nChange it: ${text}` }] }],
    schema: DRAFT_SCHEMA,
    maxTokens: 6000,
  });
  const checked = toDraft(parseJson<RawDraft>(raw));
  if (!checked) throw new ModelError("What came back was not a usable form.", "empty");
  return {
    kind: "draft",
    draft: checked.draft,
    note: checked.note || undefined,
    revised: true,
    used: seat.used,
    limit: seat.limit,
  };
}

async function append(ctx: ActionCtx, m: Asker, text: string, form: Snapshot): Promise<AskResult> {
  const system = `You add questions to an existing Formkit form. Reply with JSON matching the schema: only the new questions, at most four, none repeating one already there.
${FORM_RULES}`;
  const { text: raw } = await generate({ meter: { ...m, feature: "ask.edit" },
    system,
    turns: [{ role: "user", parts: [{ text: `The form "${form.title}":\n${describe(form.blocks)}\n\nAdd: ${text}` }] }],
    schema: { type: "OBJECT", properties: { questions: { type: "ARRAY", items: ITEM_SCHEMA } }, required: ["questions"] },
    maxTokens: 1500,
  });
  const have = new Set(form.blocks.map((b) => (b.title ?? "").toLowerCase()));
  const items = (parseJson<{ questions?: RawItem[] }>(raw)?.questions ?? [])
    .map((q) => toItem({ ...q, kind: "question" }))
    .filter((q): q is Extract<DraftItem, { kind: "field" }> => q?.kind === "field" && !have.has(q.title.toLowerCase()))
    .slice(0, 4);
  if (!items.length) return { kind: "say", text: "Those questions are already in this form." };
  await ctx.runMutation(internal.ai.addQuestions, { formId: form.id, items });
  return {
    kind: "added",
    formId: form.id,
    title: form.title,
    items: items.map((i) => ({ type: i.type, title: i.title, options: i.options })),
  };
}

async function logic(ctx: ActionCtx, m: Asker, text: string, form: Snapshot): Promise<AskResult> {
  const fields = form.blocks.filter((b) => b.kind === "field");
  if (!fields.some((f) => ["single-choice", "multi-choice", "dropdown", "yes-no", "rating", "scale", "number"].includes(f.type ?? ""))) {
    return {
      kind: "say",
      text: "Logic needs a question to branch on: a choice, a yes / no, a rating or a number. Add one and ask me again.",
    };
  }
  const system = `You write conditional logic for a Formkit form. Reply with JSON matching the schema: at most four rules.
A rule reads one question and shows, hides or requires another, which comes after it. Name both questions by their exact wording, as listed. For a choice or yes / no question the value is one of its options exactly ("Yes" or "No" for yes / no). Operators by kind. Choice: is, is-not, is-empty, is-not-empty; number: at-least, at-most, greater, less, is-empty; text: contains, is, is-empty, is-not-empty.
Only write rules that make sense for the people answering. If nothing sensible can be written, return no rules.
${VOICE}`;
  const { text: raw } = await generate({ meter: { ...m, feature: "ask.edit" },
    system,
    turns: [{ role: "user", parts: [{ text: `The form "${form.title}":\n${describe(form.blocks)}\n\nWhat to do: ${text}` }] }],
    schema: { type: "OBJECT", properties: { rules: { type: "ARRAY", items: RULE_SCHEMA } }, required: ["rules"] },
    maxTokens: 1500,
  });
  const rules = (parseJson<{ rules?: Parameters<typeof checkRule>[0][] }>(raw)?.rules ?? [])
    .map((r) => checkRule(r, fields))
    .filter((r): r is DraftRule => r !== null && r.target > r.when)
    .slice(0, 4);
  if (!rules.length) {
    return { kind: "say", text: "I could not find a rule worth adding. Every question here seems to apply to everyone." };
  }
  await ctx.runMutation(internal.ai.addRules, {
    formId: form.id,
    rules: rules.map((r) => ({
      name: r.name,
      whenId: fields[r.when - 1]!.id,
      operator: r.operator,
      value: r.value,
      action: r.action,
      targetId: fields[r.target - 1]!.id,
    })),
  });
  const label = (op: string) => Object.values(OPERATORS).flat().find((o) => o.value === op)?.label ?? op;
  return {
    kind: "rules",
    formId: form.id,
    title: form.title,
    items: rules.map((r) => ({
      name: r.name,
      when: fields[r.when - 1]!.title ?? "",
      operator: label(r.operator),
      value: r.value,
      action: r.action,
      target: fields[r.target - 1]!.title ?? "",
    })),
  };
}

async function theme(ctx: ActionCtx, m: Asker, text: string, form: Snapshot): Promise<AskResult> {
  const system = `You pick a theme for a Formkit form from a fixed list. Reply with JSON matching the schema.
Themes: ${THEME_PRESETS.map((t) => `${t.id}: ${t.name}, background ${t.bg}, accent ${t.primary}${t.bg === "#21282E" ? ", dark" : ""}`).join("; ")}.
Set useBrandColour to true only when they ask for their own or their brand's colour${form.brandColor ? "" : ". This form has no brand colour, so always false"}.`;
  const { text: raw } = await generate({ meter: { ...m, feature: "ask.edit" },
    system,
    turns: [{ role: "user", parts: [{ text: `Form: "${form.title}". What they want: ${text}` }] }],
    schema: {
      type: "OBJECT",
      properties: {
        preset: { type: "STRING", enum: THEME_PRESETS.map((t) => t.id) },
        useBrandColour: { type: "BOOLEAN" },
      },
      required: ["preset", "useBrandColour"],
    },
    maxTokens: 300,
    temperature: 0.3,
  });
  const picked = parseJson<{ preset?: string; useBrandColour?: boolean }>(raw);
  const preset = THEME_PRESETS.find((t) => t.id === picked?.preset);
  if (!preset) throw new ModelError("What came back was not a theme.", "empty");
  const brand = Boolean(picked?.useBrandColour && form.brandColor);
  const primary = brand ? form.brandColor! : preset.primary;
  await ctx.runMutation(internal.ai.setTheme, {
    formId: form.id,
    preset: preset.id,
    primary: brand ? primary : undefined,
  });
  return {
    kind: "theme",
    formId: form.id,
    title: form.title,
    name: preset.name,
    swatches: [preset.bg, preset.surface, preset.text, primary],
    brand,
  };
}

async function tone(m: Asker, text: string, form: Snapshot): Promise<AskResult> {
  const fields = form.blocks.filter((b) => b.kind === "field" && b.title);
  if (!fields.length) return { kind: "say", text: "This form has no questions yet. Add some and I will rewrite them." };
  const system = `You rewrite the questions of a Formkit form in the tone asked for. Reply with JSON matching the schema.
Keep each question's meaning and what kind of answer it expects. Leave a question out of rewrites if it already reads right. mode is two or three words for the tone, like "warmer" or "more formal".
${VOICE}`;
  const { text: raw } = await generate({ meter: { ...m, feature: "ask.edit" },
    system,
    turns: [{ role: "user", parts: [{ text: `The form "${form.title}":\n${describe(form.blocks)}\n\nRewrite: ${text}` }] }],
    schema: {
      type: "OBJECT",
      properties: {
        mode: { type: "STRING" },
        rewrites: {
          type: "ARRAY",
          items: { type: "OBJECT", properties: { n: { type: "INTEGER" }, title: { type: "STRING" } }, required: ["n", "title"] },
        },
      },
      required: ["mode", "rewrites"],
    },
    maxTokens: 3000,
  });
  const parsed = parseJson<{ mode?: string; rewrites?: { n?: number; title?: string }[] }>(raw);
  const seen = new Set<number>();
  const items = (parsed?.rewrites ?? [])
    .map((r) => {
      const f = fields[(r.n ?? 0) - 1];
      const after = clean(r.title, 240);
      if (!f || !after || after === f.title || seen.has(r.n!)) return null;
      seen.add(r.n!);
      return { blockId: f.id, before: f.title!, after };
    })
    .filter((x): x is { blockId: Id<"blocks">; before: string; after: string } => x !== null);
  if (!items.length) return { kind: "say", text: "These questions already read that way. I would only be changing them for the sake of it." };
  return { kind: "diff", formId: form.id, title: form.title, mode: clean(parsed?.mode, 40).toLowerCase() || "as asked", items };
}

async function insight(
  ctx: ActionCtx,
  m: Asker,
  text: string,
  form: Snapshot | null,
): Promise<AskResult> {
  if (!form) return { kind: "say", text: "Pick a form from the menu above and I will read its responses." };
  type Data = {
    title: string;
    total: number;
    read: number;
    complete: number;
    partial: number;
    unread: number;
    views: number;
    medianMs: number;
    stops: [string, number][];
    questions: { question: string; type?: string; answered: number; split: [string, number][]; written: string[] }[];
  };
  const data: Data = await ctx.runQuery(internal.ai.responsesFor, { formId: form.id });
  if (!data.total) {
    return { kind: "say", text: `There are no responses on ${form.title} yet. Once they land I can read them.` };
  }

  const minutes = Math.floor(data.medianMs / 60000);
  const seconds = Math.round((data.medianMs % 60000) / 1000);
  const finish = data.read ? Math.round((data.complete / data.read) * 100) : 0;
  const items = [
    { k: "Responses", v: data.total.toLocaleString("en-GB"), n: data.unread ? `${data.unread} not read yet` : "you are all caught up" },
    { k: "Finished", v: `${finish}%`, n: `${data.partial} stopped part of the way` },
    {
      k: "Median time to finish",
      v: data.medianMs ? `${minutes}m ${seconds}s` : "-",
      n: data.medianMs > 240_000 ? "long enough that some people will drop out" : "short enough to hold attention",
    },
  ];
  if (data.stops[0]) items.push({ k: "Where people stop", v: `${data.stops[0][1]}`, n: `at "${data.stops[0][0]}"` });

  const system = `You read the responses to a Formkit form and say what they show. Reply with JSON matching the schema.
summary: two or three sentences, the most useful thing first, with numbers where they help. findings: up to three short observations, each with a label (k), a value (v) and a one-line note (n).
Say only what the data supports. No names or personal details; there are none in the data.
${VOICE}`;
  try {
    const { text: raw } = await generate({ meter: { ...m, feature: "ask.insight" },
      system,
      turns: [
        {
          role: "user",
          parts: [{ text: `Question from the form owner: ${text}\n\nThe data, as JSON:\n${JSON.stringify(data).slice(0, 30000)}` }],
        },
      ],
      schema: {
        type: "OBJECT",
        properties: {
          summary: { type: "STRING" },
          findings: {
            type: "ARRAY",
            items: {
              type: "OBJECT",
              properties: { k: { type: "STRING" }, v: { type: "STRING" }, n: { type: "STRING" } },
              required: ["k", "v", "n"],
            },
          },
        },
        required: ["summary", "findings"],
      },
      maxTokens: 1200,
      temperature: 0.4,
    });
    const parsed = parseJson<{ summary?: string; findings?: { k?: string; v?: string; n?: string }[] }>(raw);
    for (const f of (parsed?.findings ?? []).slice(0, 3)) {
      if (f.k && f.v) items.push({ k: clean(f.k, 40), v: clean(f.v, 40), n: clean(f.n, 160) });
    }
    return {
      kind: "insight",
      formId: form.id,
      title: form.title,
      items,
      text: clean(parsed?.summary, 600) || `${data.total} responses read.`,
    };
  } catch (e) {
    // The counts stand on their own if the model cannot write them up.
    if (!(e instanceof ModelError) || e.reason === "no-key") throw e;
    return { kind: "insight", formId: form.id, title: form.title, items, text: `${data.total} responses read.` };
  }
}
