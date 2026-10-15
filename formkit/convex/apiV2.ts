import { v } from "convex/values";
import { remember } from "./model/history";
import { httpAction, internalMutation, internalQuery } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { sha256Hex } from "./model/apiKeys";
import { API_RATE, KEY_PATTERN, TOKEN_PATTERN, scopesOf, type Scope } from "./model/apiAuth";
import { allow } from "./model/rateLimit";
import { flagOn } from "./model/flags";
import { hasFeature, planOfId } from "./model/plans";
import { formUrl } from "./model/handles";
import { recount } from "./model/forms";
import { needsApproval } from "./model/team";
import { logActivity } from "./model/access";
import { conditionsOf } from "./model/logicEval";
import { toDraft, toItem, type RawDraft, type RawItem } from "./model/aiForms";
import { insertDraftForm, presetTheme } from "./model/draftForm";
import { THEME_PRESETS } from "./model/themePresets";
import { draftChanges, publishNow, setOpen } from "./forms";
import { summarize } from "./model/summary";
import { searchTextOf } from "./model/responseSearch";
import { statusesOfForm } from "./model/statuses";
import { EVENTS, publicHttps } from "./connections";

/**
 * The API, version 2: what scripts, Zapier and AI assistants (through the
 * MCP server at /api/mcp) use. Every plan; summaries and AI insights on Pro.
 *
 *   GET   /api/v2/forms                       forms:read
 *   POST  /api/v2/forms                       forms:write     a new draft from a spec
 *   GET   /api/v2/forms/{id}                  forms:read
 *   PATCH /api/v2/forms/{id}                  forms:write     changes to the draft only
 *   POST  /api/v2/forms/{id}/publish          forms:publish
 *   POST  /api/v2/forms/{id}/close|reopen     forms:publish
 *   GET   /api/v2/forms/{id}/responses        responses:read
 *   GET   /api/v2/forms/{id}/search?q=        responses:read
 *   GET   /api/v2/forms/{id}/summary          insights:read
 *   GET   /api/v2/forms/{id}/insights         insights:read   reports already written
 *   GET   /api/v2/responses/{id}              responses:read
 *   PATCH /api/v2/responses/{id}              responses:write status and tags
 *   GET   /api/v2/me                          any             who the key belongs to
 *   POST  /api/v2/hooks                       responses:read  subscribe a URL to new responses (Pro)
 *   DELETE /api/v2/hooks/{id}                 responses:read  unsubscribe it
 *
 * Authorization: Bearer fk_live_… (a key from Settings → Developers) or an
 * access token a connected app was given. One account's own forms only, and
 * nothing is ever deleted.
 */

type Json = Record<string, unknown> | unknown[];
type Out = { status: number; body: Json };

const SITE = process.env.SITE_URL ?? "https://formkit.app";
const MAX_TAGS = 12;

const ok = (body: Json, status = 200): Out => ({ status, body });
const err = (status: number, message: string): Out => ({ status, body: { error: { status, message } } });
const NOT_FOUND = err(404, "Not found.");

const json = (out: Out, extra: Record<string, string> = {}) =>
  new Response(JSON.stringify(out.body, null, 2), {
    status: out.status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "Access-Control-Allow-Origin": "*",
      ...extra,
    },
  });

/* ------------------------------------------------------------------ */
/* Who is calling                                                       */

export type Caller = { ownerId: Id<"users">; scopes: Scope[]; pro: boolean; via: "key" | "app" };

/**
 * The key or app token behind a request, counted against its account's
 * allowance for the minute. A mutation, so the count and the check are one.
 */
export const authorize = internalMutation({
  args: { hash: v.string(), kind: v.union(v.literal("key"), v.literal("token")) },
  handler: async (ctx, { hash, kind }): Promise<({ ok: true } & Caller) | { ok: false; status: number; message: string }> => {
    let ownerId: Id<"users">;
    let scopes: Scope[];
    if (kind === "key") {
      const key = await ctx.db
        .query("apiKeys")
        .withIndex("by_hash", (q) => q.eq("hash", hash))
        .first();
      if (!key) return { ok: false, status: 401, message: "That API key is not valid. It may have been revoked." };
      ownerId = key.ownerId;
      scopes = scopesOf(key.scopes);
      if (Date.now() - (key.lastUsedAt ?? 0) > 60_000) await ctx.db.patch(key._id, { lastUsedAt: Date.now() });
    } else {
      const token = await ctx.db
        .query("oauthTokens")
        .withIndex("by_access", (q) => q.eq("accessHash", hash))
        .first();
      if (!token || token.revokedAt || token.accessExpiresAt < Date.now()) {
        return { ok: false, status: 401, message: "That access token has expired or was revoked." };
      }
      ownerId = token.userId;
      scopes = scopesOf(token.scopes);
      if (!(await flagOn(ctx, "api.connectedApps", ownerId))) {
        return { ok: false, status: 503, message: "Connected apps are paused for a moment. Try again later." };
      }
      if (Date.now() - (token.lastUsedAt ?? 0) > 60_000) await ctx.db.patch(token._id, { lastUsedAt: Date.now() });
    }
    const owner = await ctx.db.get(ownerId);
    if (!owner) return { ok: false, status: 401, message: "That account no longer exists." };
    const plan = await planOfId(ctx, ownerId);
    if (!(await allow(ctx, `api:${ownerId}`, API_RATE[plan === "free" ? "free" : "paid"]))) {
      return { ok: false, status: 429, message: "Too many requests this minute. Wait a little and try again." };
    }
    return { ok: true, ownerId, scopes, pro: await hasFeature(ctx, ownerId, "ai.insights"), via: kind === "key" ? "key" : "app" };
  },
});

/* ------------------------------------------------------------------ */
/* Shapes                                                               */

async function ownForm(ctx: QueryCtx, ownerId: Id<"users">, id: string) {
  const formId = ctx.db.normalizeId("forms", id);
  const form = formId ? await ctx.db.get(formId) : null;
  return form && form.ownerId === ownerId && !form.deletedAt ? form : null;
}

async function blocksOf(ctx: QueryCtx, formId: Id<"forms">) {
  return (
    await ctx.db
      .query("blocks")
      .withIndex("by_form_order", (q) => q.eq("formId", formId))
      .collect()
  ).sort((a, b) => a.order - b.order);
}

async function formRow(ctx: QueryCtx, f: Doc<"forms">) {
  return {
    id: f._id,
    title: f.title,
    status: f.status,
    url: f.status === "published" || f.status === "closed" ? await formUrl(ctx, f) : null,
    editUrl: `${SITE}/app/forms/${f._id}`,
    responses: f.responsesCount,
    completed: f.completedCount,
    createdAt: new Date(f._creationTime).toISOString(),
    updatedAt: new Date(f.updatedAt).toISOString(),
  };
}

function questionRow(b: Doc<"blocks">, page: string | null) {
  return {
    id: b._id,
    key: b.key ?? null,
    type: b.type ?? null,
    title: b.title ?? null,
    help: b.help ?? null,
    required: b.required ?? false,
    options: b.options ?? null,
    page,
  };
}

async function fullForm(ctx: QueryCtx, form: Doc<"forms">) {
  const blocks = await blocksOf(ctx, form._id);
  const rules = await ctx.db
    .query("logicRules")
    .withIndex("by_form", (q) => q.eq("formId", form._id))
    .collect();
  const questions = [];
  let page: string | null = null;
  for (const b of blocks) {
    if (b.kind === "pagebreak") page = b.pageName ?? "Next page";
    else if (b.kind === "field") questions.push(questionRow(b, page));
  }
  return {
    ...(await formRow(ctx, form)),
    description: form.description ?? null,
    welcome: form.welcome ?? null,
    thanks: form.thanks ?? null,
    theme: (form.theme as { preset?: string } | undefined)?.preset ?? null,
    liveVersion: form.liveVersion ?? null,
    /** The statuses its responses can have: the company's own, with "new" and "read" built in. */
    statuses: await statusesOfForm(ctx, form),
    /** Changes in the draft that are not live yet. Publish to put them live. */
    unpublishedChanges: await draftChanges(ctx, form),
    questions,
    rules: rules
      .sort((a, b) => a.order - b.order)
      .map((r) => ({
        name: r.name,
        enabled: r.enabled,
        join: r.join,
        when: conditionsOf(r).map((c) => ({ questionId: c.blockId ?? null, operator: c.operator, value: c.value ?? null })),
        action: r.action,
        targetId: r.targetId ?? null,
      })),
  };
}

async function responseRow(ctx: QueryCtx, r: Doc<"responses">, keys: Map<string, string | undefined>) {
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
    insight: r.insight ?? null,
    source: r.source ?? null,
    utm: r.utm ?? null,
    viewUrl: `${SITE}/app/responses?open=${r._id}`,
  };
}

async function keysOf(ctx: QueryCtx, formId: Id<"forms">) {
  return new Map((await blocksOf(ctx, formId)).map((b) => [b._id as string, b.key]));
}

const iso = (s: unknown) => {
  if (typeof s !== "string" || !s) return undefined;
  const t = Date.parse(s);
  return Number.isFinite(t) ? t : undefined;
};

/* ------------------------------------------------------------------ */
/* Reading                                                              */

export const read = internalQuery({
  args: {
    ownerId: v.id("users"),
    pro: v.boolean(),
    route: v.string(),
    id: v.optional(v.string()),
    params: v.record(v.string(), v.string()),
  },
  handler: async (ctx, { ownerId, pro, route, id, params }): Promise<Out> => {
    if (route === "forms") {
      const status = params.status;
      const term = params.search?.trim().toLowerCase();
      const forms = (
        await ctx.db
          .query("forms")
          .withIndex("by_owner", (q) => q.eq("ownerId", ownerId))
          .collect()
      )
        .filter((f) => !f.deletedAt && (!status || f.status === status) && (!term || f.title.toLowerCase().includes(term)))
        .sort((a, b) => b.updatedAt - a.updatedAt)
        .slice(0, 200);
      const data = [];
      for (const f of forms) data.push(await formRow(ctx, f));
      return ok({ data });
    }

    if (route === "response") {
      const responseId = ctx.db.normalizeId("responses", id ?? "");
      const r = responseId ? await ctx.db.get(responseId) : null;
      if (!r || r.ownerId !== ownerId || r.preview) return NOT_FOUND;
      return ok(await responseRow(ctx, r, await keysOf(ctx, r.formId)));
    }

    if (route === "me") {
      const me = await ctx.db.get(ownerId);
      return ok({ id: ownerId, name: me?.name ?? null, email: me?.email ?? null, plan: await planOfId(ctx, ownerId) });
    }

    const form = await ownForm(ctx, ownerId, id ?? "");
    if (!form) return NOT_FOUND;

    if (route === "form") return ok(await fullForm(ctx, form));

    if (route === "responses") {
      const limit = Math.max(1, Math.min(100, Math.floor(Number(params.limit) || 25)));
      const since = iso(params.since);
      const until = iso(params.until);
      const page = await ctx.db
        .query("responses")
        .withIndex("by_form_preview_submitted", (q) => {
          const base = q.eq("formId", form._id).eq("preview", undefined);
          if (since !== undefined && until !== undefined) return base.gte("submittedAt", since).lt("submittedAt", until);
          if (since !== undefined) return base.gte("submittedAt", since);
          if (until !== undefined) return base.lt("submittedAt", until);
          return base;
        })
        .order("desc")
        .paginate({ cursor: params.cursor || null, numItems: limit });
      const keys = await keysOf(ctx, form._id);
      const data = [];
      for (const r of page.page) {
        if (params.status && r.status !== params.status) continue;
        if (params.tag && !(r.tags ?? []).some((t) => t.toLowerCase() === params.tag!.toLowerCase())) continue;
        if (params.complete === "true" && r.partial) continue;
        if (params.complete === "false" && !r.partial) continue;
        data.push(await responseRow(ctx, r, keys));
      }
      // A filtered page can hold fewer than asked for; keep following `next`.
      return ok({ data, next: page.isDone ? null : page.continueCursor });
    }

    if (route === "search") {
      const term = params.q?.trim().slice(0, 100);
      if (!term) return err(400, "Say what to look for, as ?q=…");
      const found = await ctx.db
        .query("responses")
        .withSearchIndex("search", (q) => q.search("searchText", term).eq("ownerId", ownerId).eq("formId", form._id))
        .take(Math.max(1, Math.min(50, Math.floor(Number(params.limit) || 20))));
      const keys = await keysOf(ctx, form._id);
      const data = [];
      for (const r of found) if (!r.preview) data.push(await responseRow(ctx, r, keys));
      return ok({ data });
    }

    if (route === "summary" || route === "insights") {
      if (!pro) return err(403, "Summaries and AI insights through the API are part of Pro.");
      if (route === "insights") {
        const latest = await ctx.db
          .query("aiReports")
          .withIndex("by_form", (q) => q.eq("formId", form._id))
          .order("desc")
          .first();
        return ok({
          report: latest ? { writtenAt: new Date(latest.at).toISOString(), responsesRead: latest.count, ...latest.report } : null,
          note: latest ? undefined : `No report has been written yet. Ask for one at ${SITE}/app/forms/${form._id}/insights.`,
        });
      }
      const blocks = await blocksOf(ctx, form._id);
      const rows: Doc<"responses">[] = [];
      let capped = false;
      for await (const r of ctx.db
        .query("responses")
        .withIndex("by_form_preview_submitted", (q) => q.eq("formId", form._id).eq("preview", undefined))
        .order("desc")) {
        if (r.partial) continue;
        if (rows.length === 2000) {
          capped = true;
          break;
        }
        rows.push(r);
      }
      return ok({
        completed: form.completedCount,
        started: form.responsesCount,
        views: form.views,
        read: rows.length,
        capped,
        questions: summarize(blocks, rows),
      });
    }

    return err(404, "No such endpoint. See formkit.app/api-docs.");
  },
});

/* ------------------------------------------------------------------ */
/* Writing                                                              */

type Body = Record<string, unknown>;

const str = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : undefined);

export const write = internalMutation({
  args: {
    ownerId: v.id("users"),
    route: v.string(),
    id: v.optional(v.string()),
    body: v.any(),
    via: v.union(v.literal("key"), v.literal("app")),
  },
  handler: async (ctx, { ownerId, route, id, body: raw, via }): Promise<Out> => {
    const body = (raw && typeof raw === "object" ? raw : {}) as Body;
    const owner = await ctx.db.get(ownerId);
    if (!owner) return err(401, "That account no longer exists.");
    const how = via === "key" ? "through the API" : "from a connected app";

    if (route === "create") {
      const checked = toDraft(specOf(body), { verbatim: true });
      if (!checked) return err(422, "A form needs a title and at least one question in `items`. See formkit.app/api-docs.");
      const formId = await insertDraftForm(ctx, {
        draft: checked.draft,
        ownerId,
        actorId: ownerId,
        activity: `created the form ${how}`,
        icon: "code",
      });
      const form = (await ctx.db.get(formId))!;
      return ok(await fullForm(ctx, form), 201);
    }

    if (route === "hook-remove") {
      const hookId = ctx.db.normalizeId("connections", id ?? "");
      const hook = hookId ? await ctx.db.get(hookId) : null;
      if (!hook || hook.ownerId !== ownerId || !hook.viaApi) return NOT_FOUND;
      await ctx.db.delete(hook._id);
      return ok({ id: hook._id, removed: true });
    }

    if (route === "hook-add") {
      const form = await ownForm(ctx, ownerId, String(body.formId ?? ""));
      if (!form) return err(404, "No form with that `formId` on this account.");
      if (!(await hasFeature(ctx, form, "connect.webhooks"))) return err(403, "Sending responses to Zapier, Make or a webhook is part of Pro.");
      const url = publicHttps(String(body.url ?? ""));
      if (!url) return err(422, "`url` must be a public https address.");
      const event = String(body.event ?? "response.created");
      if (!(EVENTS as readonly string[]).includes(event)) return err(422, `\`event\` is one of ${EVENTS.join(", ")}.`);
      const existing = await ctx.db
        .query("connections")
        .withIndex("by_form", (q) => q.eq("formId", form._id))
        .collect();
      if (existing.length >= 10) return err(409, "Ten connections is the most one form can have.");
      const hookId = await ctx.db.insert("connections", {
        formId: form._id,
        ownerId,
        kind: "webhook",
        label: str(body.label, 60) || "Zapier",
        url,
        secret: `fks_${crypto.randomUUID().replace(/-/g, "")}`,
        events: [event],
        viaApi: true,
        enabled: true,
        createdAt: Date.now(),
      });
      return ok({ id: hookId, formId: form._id, url, event }, 201);
    }

    if (route === "response") {
      const responseId = ctx.db.normalizeId("responses", id ?? "");
      const r = responseId ? await ctx.db.get(responseId) : null;
      if (!r || r.ownerId !== ownerId || r.preview) return NOT_FOUND;
      const patch: Partial<Doc<"responses">> = {};
      if (body.status !== undefined) {
        const form = await ctx.db.get(r.formId);
        const list = form ? await statusesOfForm(ctx, form) : [];
        if (!list.some((s) => s.key === body.status)) return err(422, `\`status\` is one of ${list.map((s) => s.key).join(", ")}.`);
        patch.status = String(body.status);
      }
      if (body.tags !== undefined || body.addTags !== undefined || body.removeTags !== undefined) {
        const list = (v: unknown) => (Array.isArray(v) ? v.map((t) => str(t, 32)).filter((t): t is string => !!t) : []);
        let tags = body.tags !== undefined ? list(body.tags) : [...(r.tags ?? [])];
        for (const t of list(body.addTags)) if (!tags.some((x) => x.toLowerCase() === t.toLowerCase())) tags.push(t);
        const drop = new Set(list(body.removeTags).map((t) => t.toLowerCase()));
        tags = tags.filter((t, i, all) => !drop.has(t.toLowerCase()) && all.findIndex((x) => x.toLowerCase() === t.toLowerCase()) === i);
        patch.tags = tags.length ? tags.slice(0, MAX_TAGS) : undefined;
        patch.searchText = searchTextOf({ ...r, tags: patch.tags });
      }
      if (Object.keys(patch).length) await ctx.db.patch(r._id, patch);
      return ok(await responseRow(ctx, (await ctx.db.get(r._id))!, await keysOf(ctx, r.formId)));
    }

    const form = await ownForm(ctx, ownerId, id ?? "");
    if (!form) return NOT_FOUND;

    if (route === "publish") {
      if (form.status === "archived") return err(409, "That form is archived. Restore it in Formkit first.");
      if (await needsApproval(ctx, form, ownerId)) {
        return err(409, "Forms on this team are approved by an admin before they go live. Ask for approval in Formkit.");
      }
      await publishNow(ctx, form, owner);
      return ok(await fullForm(ctx, (await ctx.db.get(form._id))!));
    }

    if (route === "close" || route === "reopen") {
      if (route === "close" && form.status !== "published") return err(409, "Only a published form can be closed.");
      if (route === "reopen" && form.status !== "closed") return err(409, "Only a closed form can be reopened.");
      await setOpen(ctx, form, owner, route === "reopen");
      return ok(await fullForm(ctx, (await ctx.db.get(form._id))!));
    }

    if (route === "edit") {
      const problem = await editDraft(ctx, form, body, ownerId, how);
      if (problem) return err(422, problem);
      return ok(await fullForm(ctx, (await ctx.db.get(form._id))!));
    }

    return err(404, "No such endpoint. See formkit.app/api-docs.");
  },
});

/** A spec in the API's words, read the way Ask Formkit's drafts are. */
function specOf(b: Body): RawDraft {
  const welcome = (b.welcome ?? {}) as Body;
  const thanks = (b.thanks ?? {}) as Body;
  return {
    title: b.title as string,
    description: b.description as string,
    welcomeTitle: (welcome.title ?? b.welcomeTitle) as string,
    welcomeMessage: (welcome.message ?? b.welcomeMessage) as string,
    thanksTitle: (thanks.title ?? b.thanksTitle) as string,
    thanksMessage: (thanks.message ?? b.thanksMessage) as string,
    items: Array.isArray(b.items) ? (b.items as RawItem[]) : Array.isArray(b.questions) ? (b.questions as RawItem[]) : undefined,
    rules: Array.isArray(b.rules) ? (b.rules as RawDraft["rules"]) : [],
    theme: b.theme as string,
  };
}

/**
 * Changes to a form's draft: its words and theme, and questions added,
 * changed, moved or taken out. The live form is untouched until published.
 * Returns what was wrong, or nothing.
 */
async function editDraft(ctx: MutationCtx, form: Doc<"forms">, b: Body, actorId: Id<"users">, how: string) {
  const patch: Partial<Doc<"forms">> = {};
  const title = str(b.title, 120);
  if (title) patch.title = title;
  if (b.description !== undefined) patch.description = str(b.description, 300) || undefined;
  for (const k of ["welcome", "thanks"] as const) {
    const part = b[k] as Body | undefined;
    if (part && typeof part === "object") {
      const current = (form[k] ?? {}) as Record<string, unknown>;
      patch[k] = {
        ...current,
        ...(str(part.title, 120) ? { title: str(part.title, 120) } : {}),
        ...(part.message !== undefined ? { message: str(part.message, 400) ?? "" } : {}),
      } as never;
    }
  }
  if (b.theme !== undefined) {
    if (!THEME_PRESETS.some((t) => t.id === b.theme)) return `\`theme\` is one of ${THEME_PRESETS.map((t) => t.id).join(", ")}.`;
    patch.theme = { ...((form.theme as object | undefined) ?? {}), ...presetTheme(String(b.theme)) };
  }

  const ops = Array.isArray(b.ops) ? (b.ops as Body[]) : [];
  if (ops.length > 50) return "At most 50 changes at a time.";
  if (ops.length) await remember(ctx, form._id, `Changes made ${how}`, { userId: actorId });
  let blocks = await blocksOf(ctx, form._id);
  const own = (qid: unknown) => blocks.find((x) => x._id === qid && x.kind === "field");
  const renumber = async (order: Doc<"blocks">[]) => {
    for (const [i, x] of order.entries()) if (x.order !== i) await ctx.db.patch(x._id, { order: i });
    blocks = await blocksOf(ctx, form._id);
  };
  // Puts `moving` straight after the question `after`, or first for null.
  const place = async (moving: Id<"blocks">, after: unknown) => {
    const rest = blocks.filter((x) => x._id !== moving);
    let at = 0;
    if (after !== null) {
      const i = rest.findIndex((x) => x._id === after);
      if (i < 0) return false;
      at = i + 1;
    }
    await renumber([...rest.slice(0, at), blocks.find((x) => x._id === moving)!, ...rest.slice(at)]);
    return true;
  };

  let changed = 0;
  for (const [n, op] of ops.entries()) {
    const where = `ops[${n}]`;
    if (op.op === "add") {
      const item = toItem((op.question ?? {}) as RawItem, true);
      if (!item || item.kind !== "field") return `${where}: a question needs a \`title\` and a \`type\`.`;
      const id = await ctx.db.insert("blocks", {
        formId: form._id,
        order: blocks.length,
        kind: "field",
        type: item.type,
        title: item.title,
        help: item.help,
        required: item.required,
        options: item.options,
      });
      blocks = await blocksOf(ctx, form._id);
      if (op.after !== undefined && !(await place(id, op.after))) return `${where}: no question ${String(op.after)} to put it after.`;
    } else if (op.op === "update") {
      const q = own(op.id);
      if (!q) return `${where}: no question ${String(op.id)} on this form.`;
      const next: Partial<Doc<"blocks">> = {};
      const t = str(op.title, 240);
      if (t) next.title = t;
      if (op.help !== undefined) next.help = str(op.help, 200) || undefined;
      if (typeof op.required === "boolean") next.required = op.required;
      if (op.options !== undefined) {
        const checked = toItem({ type: q.type, title: q.title ?? "Question", options: op.options }, true);
        if (!checked || checked.kind !== "field" || !checked.options) return `${where}: a choice question needs at least two options.`;
        next.options = checked.options;
      }
      await ctx.db.patch(q._id, next);
    } else if (op.op === "move") {
      const q = own(op.id);
      if (!q) return `${where}: no question ${String(op.id)} on this form.`;
      if (!(await place(q._id, op.after ?? null))) return `${where}: no question ${String(op.after)} to put it after.`;
    } else if (op.op === "remove") {
      const q = own(op.id);
      if (!q) return `${where}: no question ${String(op.id)} on this form.`;
      // Rules that read or change it go with it, as in the builder. Answers
      // already sent keep their copy of the question.
      for (const rule of await ctx.db
        .query("logicRules")
        .withIndex("by_form", (x) => x.eq("formId", form._id))
        .collect()) {
        if (conditionsOf(rule).some((c) => c.blockId === q._id) || rule.targetId === q._id) await ctx.db.delete(rule._id);
      }
      await ctx.db.delete(q._id);
      await renumber(blocks.filter((x) => x._id !== q._id));
    } else {
      return `${where}: \`op\` is one of add, update, move or remove.`;
    }
    changed++;
  }

  if (Object.keys(patch).length || changed) {
    await ctx.db.patch(form._id, { ...patch, updatedAt: Date.now() });
    await recount(ctx, form._id);
    await logActivity(ctx, form._id, actorId, `edited the draft ${how}`, "code");
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* HTTP                                                                 */

const NEEDS: Record<string, Scope> = {
  forms: "forms:read",
  form: "forms:read",
  create: "forms:write",
  edit: "forms:write",
  publish: "forms:publish",
  close: "forms:publish",
  reopen: "forms:publish",
  responses: "responses:read",
  search: "responses:read",
  response: "responses:read",
  "response-write": "responses:write",
  me: "forms:read",
  "hook-add": "responses:read",
  "hook-remove": "responses:read",
  summary: "insights:read",
  insights: "insights:read",
};

/** Which operation a method and path name, or nothing. */
export function routeOf(method: string, path: string): { route: string; id?: string; write: boolean } | null {
  const p = path.replace(/^\/api\/v2\/?/, "").split("/").filter(Boolean);
  if (p[0] === "forms") {
    if (p.length === 1) return method === "GET" ? { route: "forms", write: false } : method === "POST" ? { route: "create", write: true } : null;
    if (p.length === 2) return method === "GET" ? { route: "form", id: p[1], write: false } : method === "PATCH" ? { route: "edit", id: p[1], write: true } : null;
    if (p.length === 3) {
      if (method === "POST" && ["publish", "close", "reopen"].includes(p[2]!)) return { route: p[2]!, id: p[1], write: true };
      if (method === "GET" && ["responses", "search", "summary", "insights"].includes(p[2]!)) return { route: p[2]!, id: p[1], write: false };
    }
  }
  if (p[0] === "responses" && p.length === 2) {
    if (method === "GET") return { route: "response", id: p[1], write: false };
    if (method === "PATCH") return { route: "response", id: p[1], write: true };
  }
  if (p[0] === "me" && p.length === 1 && method === "GET") return { route: "me", write: false };
  if (p[0] === "hooks" && p.length === 1 && method === "POST") return { route: "hook-add", write: true };
  if (p[0] === "hooks" && p.length === 2 && method === "DELETE") return { route: "hook-remove", id: p[1], write: true };
  return null;
}

/** Every /api/v2/… request. */
export const handle = httpAction(async (ctx, req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Authorization, Content-Type",
        "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE",
      },
    });
  }
  const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  const kind = KEY_PATTERN.test(token) ? "key" : TOKEN_PATTERN.test(token) ? "token" : null;
  if (!kind) return json(err(401, "Send your API key as: Authorization: Bearer fk_live_…"), { "WWW-Authenticate": "Bearer" });
  const who = await ctx.runMutation(internal.apiV2.authorize, { hash: await sha256Hex(token), kind });
  if (!who.ok) return json(err(who.status, who.message), who.status === 401 ? { "WWW-Authenticate": "Bearer" } : {});

  const url = new URL(req.url);
  const op = routeOf(req.method, url.pathname);
  if (!op) return json(err(404, "No such endpoint. See formkit.app/api-docs."));
  const needs = NEEDS[op.route === "response" && op.write ? "response-write" : op.route]!;
  if (!who.scopes.includes(needs)) return json(err(403, `This key cannot do that. It needs the ${needs} permission.`));

  if (!op.write) {
    const params: Record<string, string> = {};
    for (const [k, val] of url.searchParams) params[k] = val.slice(0, 200);
    return json(await ctx.runQuery(internal.apiV2.read, { ownerId: who.ownerId, pro: who.pro, route: op.route, id: op.id, params }));
  }
  let body: unknown = {};
  const text = await req.text();
  if (text.length > 200_000) return json(err(413, "That request is too large."));
  if (text.trim()) {
    try {
      body = JSON.parse(text);
    } catch {
      return json(err(400, "The body is not valid JSON."));
    }
  }
  return json(await ctx.runMutation(internal.apiV2.write, { ownerId: who.ownerId, route: op.route, id: op.id, body, via: who.via }));
});
