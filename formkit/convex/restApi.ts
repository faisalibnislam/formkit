import { v } from "convex/values";
import { httpAction, internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import type { QueryCtx } from "./_generated/server";
import { sha256Hex } from "./model/apiKeys";
import { formUrl } from "./model/handles";
import { hasFeature } from "./model/plans";

/**
 * Business: a small, read-only REST API.
 *
 *   GET /api/v1/forms
 *   GET /api/v1/forms/{id}
 *   GET /api/v1/forms/{id}/responses?after=<ms>&limit=<1-100>
 *   GET /api/v1/responses/{id}
 *
 * Authorization: Bearer fk_live_… - a key made in Settings → Controls. Keys
 * belong to one account and read only that account's forms.
 */

type Json = Record<string, unknown> | unknown[];

const json = (body: Json, status = 200) =>
  new Response(JSON.stringify(body, null, 2), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "Access-Control-Allow-Origin": "*",
    },
  });

const fail = (status: number, message: string) => json({ error: { status, message } }, status);

export const keyOwner = internalQuery({
  args: { hash: v.string() },
  handler: async (ctx, { hash }) => {
    const key = await ctx.db
      .query("apiKeys")
      .withIndex("by_hash", (q) => q.eq("hash", hash))
      .first();
    if (!key) return null;
    const allowed = await hasFeature(ctx, key.ownerId, "api");
    return { keyId: key._id, ownerId: key.ownerId, allowed, lastUsedAt: key.lastUsedAt ?? 0 };
  },
});

export const touchKey = internalMutation({
  args: { keyId: v.id("apiKeys") },
  returns: v.null(),
  handler: async (ctx, { keyId }) => {
    if (await ctx.db.get(keyId)) await ctx.db.patch(keyId, { lastUsedAt: Date.now() });
    return null;
  },
});

async function fieldsOf(ctx: QueryCtx, formId: Id<"forms">) {
  return (
    await ctx.db
      .query("blocks")
      .withIndex("by_form_order", (q) => q.eq("formId", formId))
      .collect()
  )
    .filter((b) => b.kind === "field")
    .sort((a, b) => a.order - b.order);
}

function formRow(f: Doc<"forms">, url: string | null) {
  return {
    id: f._id,
    title: f.title,
    status: f.status,
    url,
    responses: f.responsesCount,
    createdAt: new Date(f._creationTime).toISOString(),
    updatedAt: new Date(f.updatedAt).toISOString(),
  };
}

/** Links to every uploaded file and voice recording on these responses. */
async function fileLinks(ctx: QueryCtx, rows: Doc<"responses">[]) {
  const links = new Map<string, string>();
  for (const r of rows)
    for (const a of r.answers)
      if (a.fileId && !links.has(a.fileId)) {
        const url = await ctx.storage.getUrl(a.fileId);
        if (url) links.set(a.fileId, url);
      }
  return links;
}

function responseRow(r: Doc<"responses">, byId: Map<string, Doc<"blocks">>, links: Map<string, string>) {
  return {
    id: r._id,
    formId: r.formId,
    submittedAt: new Date(r.submittedAt).toISOString(),
    submittedAtMs: r.submittedAt,
    complete: !r.partial,
    respondent: {
      name: r.respondentName ?? null,
      email: r.respondentEmail ?? null,
      phone: r.respondentPhone ?? null,
      company: r.respondentCompany ?? null,
    },
    answers: r.answers.map((a) => ({
      questionId: a.blockId,
      key: byId.get(a.blockId)?.key ?? null,
      question: a.question,
      value: a.values?.length ? a.values : (a.fileName ?? a.value ?? null),
      ...(a.fileId ? { fileUrl: links.get(a.fileId) ?? null } : {}),
    })),
    calculations: r.calc ?? {},
    payment: r.payment ? { status: r.payment.status, amount: r.payment.amount, currency: r.payment.currency } : null,
    source: r.source ?? null,
    tags: r.tags ?? [],
  };
}

export const read = internalQuery({
  args: {
    ownerId: v.id("users"),
    route: v.union(v.literal("forms"), v.literal("form"), v.literal("responses"), v.literal("response")),
    id: v.optional(v.string()),
    after: v.optional(v.number()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { ownerId, route, id, after, limit }): Promise<{ status: number; body: Json }> => {
    const notFound = { status: 404, body: { error: { status: 404, message: "Not found." } } };
    if (route === "forms") {
      const forms = (
        await ctx.db
          .query("forms")
          .withIndex("by_owner", (q) => q.eq("ownerId", ownerId))
          .collect()
      )
        .filter((f) => !f.deletedAt)
        .sort((a, b) => b.updatedAt - a.updatedAt);
      const data = [];
      for (const f of forms) data.push(formRow(f, f.status === "published" ? await formUrl(ctx, f) : null));
      return { status: 200, body: { data } };
    }
    if (route === "form" || route === "responses") {
      const formId = ctx.db.normalizeId("forms", id ?? "");
      const form = formId ? await ctx.db.get(formId) : null;
      if (!form || form.ownerId !== ownerId || form.deletedAt) return notFound;
      const fields = await fieldsOf(ctx, form._id);
      if (route === "form") {
        return {
          status: 200,
          body: {
            ...formRow(form, form.status === "published" ? await formUrl(ctx, form) : null),
            questions: fields.map((b) => ({
              id: b._id,
              key: b.key ?? null,
              type: b.type ?? null,
              title: b.title ?? null,
              required: b.required ?? false,
              options: b.options ?? null,
            })),
            calculations: (form.calc ?? []).map((c) => c.name),
          },
        };
      }
      const n = Math.max(1, Math.min(100, Math.floor(limit ?? 50)));
      const rows = (
        await ctx.db
          .query("responses")
          .withIndex("by_form_submitted", (q) => q.eq("formId", form._id).gt("submittedAt", after ?? 0))
          .take(n + 20)
      )
        .filter((r) => !r.preview)
        .slice(0, n + 1);
      const byId = new Map(fields.map((b) => [b._id as string, b]));
      const page = rows.slice(0, n);
      const links = await fileLinks(ctx, page);
      return {
        status: 200,
        body: {
          data: page.map((r) => responseRow(r, byId, links)),
          hasMore: rows.length > n,
          next: rows.length > n ? page[page.length - 1]!.submittedAt : null,
        },
      };
    }
    const responseId = ctx.db.normalizeId("responses", id ?? "");
    const r = responseId ? await ctx.db.get(responseId) : null;
    if (!r || r.ownerId !== ownerId || r.preview) return notFound;
    const fields = await fieldsOf(ctx, r.formId);
    return { status: 200, body: responseRow(r, new Map(fields.map((b) => [b._id as string, b])), await fileLinks(ctx, [r])) };
  },
});

/** Every /api/v1/… request. */
export const handle = httpAction(async (ctx, req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Authorization",
        "Access-Control-Allow-Methods": "GET",
      },
    });
  }
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.replace(/^Bearer\s+/i, "").trim();
  if (!/^fk_live_[0-9a-f]{48}$/.test(token)) return fail(401, "Send your API key as: Authorization: Bearer fk_live_…");
  const key: { keyId: Id<"apiKeys">; ownerId: Id<"users">; allowed: boolean; lastUsedAt: number } | null =
    await ctx.runQuery(internal.restApi.keyOwner, { hash: await sha256Hex(token) });
  if (!key) return fail(401, "That API key is not valid. It may have been revoked.");
  if (!key.allowed) return fail(403, "The API is part of the Business plan.");
  if (Date.now() - key.lastUsedAt > 60_000) await ctx.runMutation(internal.restApi.touchKey, { keyId: key.keyId });

  const url = new URL(req.url);
  const parts = url.pathname.replace(/^\/api\/v1\/?/, "").split("/").filter(Boolean);
  const after = Number(url.searchParams.get("after") ?? "") || undefined;
  const limit = Number(url.searchParams.get("limit") ?? "") || undefined;
  let route: "forms" | "form" | "responses" | "response" | null = null;
  let id: string | undefined;
  if (parts[0] === "forms" && parts.length === 1) route = "forms";
  else if (parts[0] === "forms" && parts.length === 2) [route, id] = ["form", parts[1]];
  else if (parts[0] === "forms" && parts.length === 3 && parts[2] === "responses") [route, id] = ["responses", parts[1]];
  else if (parts[0] === "responses" && parts.length === 2) [route, id] = ["response", parts[1]];
  if (!route) return fail(404, "No such endpoint. See formkit.app/api-docs.");

  const out: { status: number; body: Json } = await ctx.runQuery(internal.restApi.read, {
    ownerId: key.ownerId,
    route,
    id,
    after,
    limit,
  });
  return json(out.body, out.status);
});
