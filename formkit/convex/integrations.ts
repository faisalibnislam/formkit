import { ConvexError, v } from "convex/values";
import { action, httpAction, internalMutation, internalQuery, mutation, query } from "./_generated/server";
import type { ActionCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { requireUser } from "./model/identity";
import { formFor } from "./model/forms";
import { hasFeature, requireFeature } from "./model/plans";
import { seal, unseal } from "./model/sealed";
import { flagOn } from "./model/flags";
import { PROVIDERS, PROVIDER_IDS, credentials, type ProviderId } from "./model/providers";

/**
 * Responses into other apps, over OAuth (Pro): a live Google Sheet that
 * Formkit makes and keeps, a Notion database, an Airtable table, and HubSpot
 * contacts.
 *
 * Someone connects an account once (begin → the app's sign-in → callback),
 * then each form picks where its responses go (setup). Each new response is
 * added there as it arrives; a changed one updates what it became
 * (integrationRefs), never adds a second. Tokens are sealed, refreshed when
 * they run out, and go with the account.
 */

const SITE = (process.env.SITE_URL ?? "https://formkit.app").replace(/\/$/, "");
const redirectUri = (p: ProviderId) => `${SITE}/integrations/callback/${p}`;
const NOTION_VERSION = "2022-06-28";

const random = (bytes = 32) => {
  const b = new Uint8Array(bytes);
  crypto.getRandomValues(b);
  return btoa(String.fromCharCode(...b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};
async function s256(verifier: string) {
  const d = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier)));
  return btoa(String.fromCharCode(...d)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/* ------------------------------------------------------------------ */
/* Connecting an account                                                */

/** Which apps Formkit has been set up for, and the person's connected accounts. */
export const available = query({
  args: {},
  handler: async (ctx) => {
    const me = await requireUser(ctx);
    const accounts = await ctx.db
      .query("integrationAccounts")
      .withIndex("by_owner", (q) => q.eq("ownerId", me._id))
      .collect();
    return {
      providers: PROVIDER_IDS.filter((p) => credentials(p)).map((p) => ({ id: p, label: PROVIDERS[p].label, kind: PROVIDERS[p].kind })),
      accounts: accounts.map((a) => ({ id: a._id, provider: a.provider, label: a.label })),
    };
  },
});

/** Where to send someone to sign in to an app; they come back to `returnTo`. */
export const begin = mutation({
  args: { provider: v.string(), returnTo: v.string() },
  returns: v.string(),
  handler: async (ctx, { provider, returnTo }) => {
    const me = await requireUser(ctx);
    if (!PROVIDER_IDS.includes(provider as ProviderId)) throw new ConvexError("Formkit does not connect to that app.");
    const p = provider as ProviderId;
    const creds = credentials(p);
    if (!creds) throw new ConvexError(`${PROVIDERS[p].label} is not set up on Formkit yet.`);
    if (!returnTo.startsWith("/app/")) throw new ConvexError("Come back to somewhere in Formkit.");
    const state = random(24);
    const verifier = PROVIDERS[p].pkce ? random(48) : undefined;
    await ctx.db.insert("integrationStates", { state, userId: me._id, provider: p, verifier, returnTo, expiresAt: Date.now() + 15 * 60_000 });
    const u = new URL(PROVIDERS[p].authUrl);
    u.searchParams.set("client_id", creds.id);
    u.searchParams.set("redirect_uri", redirectUri(p));
    u.searchParams.set("response_type", "code");
    u.searchParams.set("state", state);
    if (PROVIDERS[p].scopes.length) u.searchParams.set("scope", PROVIDERS[p].scopes.join(" "));
    if (verifier) {
      u.searchParams.set("code_challenge", await s256(verifier));
      u.searchParams.set("code_challenge_method", "S256");
    }
    for (const [k, val] of Object.entries(PROVIDERS[p].authParams ?? {})) u.searchParams.set(k, val);
    return u.toString();
  },
});

export const takeState = internalMutation({
  args: { state: v.string() },
  handler: async (ctx, { state }) => {
    const row = await ctx.db
      .query("integrationStates")
      .withIndex("by_state", (q) => q.eq("state", state))
      .first();
    if (!row) return null;
    await ctx.db.delete(row._id);
    return row.expiresAt < Date.now() ? null : row;
  },
});

type Tokens = { access_token?: string; refresh_token?: string; expires_in?: number; workspace_name?: string; id_token?: string };

async function tokenRequest(p: ProviderId, params: Record<string, string>): Promise<Tokens> {
  const prov = PROVIDERS[p];
  const creds = credentials(p)!;
  const headers: Record<string, string> = { Accept: "application/json" };
  const all = { ...params, ...(prov.tokenAuth === "body" ? { client_id: creds.id, client_secret: creds.secret } : {}) };
  if (prov.tokenAuth === "basic") headers.Authorization = `Basic ${btoa(`${creds.id}:${creds.secret}`)}`;
  let body: string;
  if (prov.tokenJson) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(all);
  } else {
    headers["Content-Type"] = "application/x-www-form-urlencoded";
    body = new URLSearchParams(all).toString();
  }
  const res = await fetch(prov.tokenUrl, { method: "POST", headers, body, signal: AbortSignal.timeout(15_000) });
  const out = (await res.json().catch(() => ({}))) as Tokens & { error?: string };
  if (!res.ok || !out.access_token) throw new Error(out.error ?? `Token request answered ${res.status}`);
  return out;
}

/** A name to show for the account: an email, a workspace, a portal. */
async function labelFor(p: ProviderId, t: Tokens) {
  try {
    if (p === "google" && t.id_token) {
      const payload = JSON.parse(atob(t.id_token.split(".")[1]!.replace(/-/g, "+").replace(/_/g, "/"))) as { email?: string };
      return payload.email ?? "Google";
    }
    if (p === "notion") return t.workspace_name ?? "Notion";
    if (p === "hubspot") {
      const res = await fetch(`https://api.hubapi.com/oauth/v1/access-tokens/${t.access_token}`);
      const info = (await res.json()) as { hub_domain?: string; user?: string };
      return info.hub_domain ?? info.user ?? "HubSpot";
    }
  } catch {
    /* a plain name will do */
  }
  return PROVIDERS[p].label;
}

export const saveAccount = internalMutation({
  args: {
    ownerId: v.id("users"),
    provider: v.union(v.literal("google"), v.literal("notion"), v.literal("airtable"), v.literal("hubspot")),
    label: v.string(),
    access: v.string(),
    refresh: v.optional(v.string()),
    expiresAt: v.optional(v.number()),
  },
  returns: v.id("integrationAccounts"),
  handler: async (ctx, a) => {
    // The same account connected again replaces its tokens.
    const same = (
      await ctx.db
        .query("integrationAccounts")
        .withIndex("by_owner", (q) => q.eq("ownerId", a.ownerId))
        .collect()
    ).find((x) => x.provider === a.provider && x.label === a.label);
    if (same) {
      await ctx.db.patch(same._id, { access: a.access, refresh: a.refresh ?? same.refresh, expiresAt: a.expiresAt });
      return same._id;
    }
    return await ctx.db.insert("integrationAccounts", { ...a, createdAt: Date.now() });
  },
});

/** formkit.app/integrations/callback/{provider}: the app sends the person back here with a code. */
export const callback = httpAction(async (ctx, req) => {
  const url = new URL(req.url);
  const provider = url.searchParams.get("provider") as ProviderId;
  const back = (path: string, note?: string) =>
    new Response(null, { status: 302, headers: { Location: `${SITE}${path}${note ? `${path.includes("?") ? "&" : "?"}connected=${encodeURIComponent(note)}` : ""}` } });
  const state = await ctx.runMutation(internal.integrations.takeState, { state: url.searchParams.get("state") ?? "" });
  if (!state || state.provider !== provider || !PROVIDER_IDS.includes(provider)) return back("/app", "expired");
  const code = url.searchParams.get("code");
  if (!code) return back(state.returnTo, "cancelled");
  try {
    const t = await tokenRequest(provider, {
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri(provider),
      ...(state.verifier ? { code_verifier: state.verifier } : {}),
    });
    await ctx.runMutation(internal.integrations.saveAccount, {
      ownerId: state.userId,
      provider,
      label: (await labelFor(provider, t)).slice(0, 80),
      access: await seal(t.access_token!),
      refresh: t.refresh_token ? await seal(t.refresh_token) : undefined,
      expiresAt: t.expires_in ? Date.now() + t.expires_in * 1000 : undefined,
    });
    return back(state.returnTo, provider);
  } catch {
    return back(state.returnTo, "failed");
  }
});

export const disconnect = mutation({
  args: { accountId: v.id("integrationAccounts") },
  returns: v.null(),
  handler: async (ctx, { accountId }) => {
    const me = await requireUser(ctx);
    const a = await ctx.db.get(accountId);
    if (!a || a.ownerId !== me._id) return null;
    await ctx.db.delete(accountId);
    return null;
  },
});

/* ------------------------------------------------------------------ */
/* Tokens                                                               */

export const account = internalQuery({
  args: { accountId: v.id("integrationAccounts") },
  handler: async (ctx, { accountId }) => {
    const a = await ctx.db.get(accountId);
    return a ? { ...a, paused: !(await flagOn(ctx, "connect.apps", a.ownerId)) } : null;
  },
});

export const ownAccount = internalQuery({
  args: { accountId: v.id("integrationAccounts") },
  handler: async (ctx, { accountId }) => {
    const me = await requireUser(ctx);
    const a = await ctx.db.get(accountId);
    return a && a.ownerId === me._id ? a : null;
  },
});

export const storeTokens = internalMutation({
  args: { accountId: v.id("integrationAccounts"), access: v.string(), refresh: v.optional(v.string()), expiresAt: v.optional(v.number()) },
  returns: v.null(),
  handler: async (ctx, { accountId, ...t }) => {
    const a = await ctx.db.get(accountId);
    if (a) await ctx.db.patch(accountId, { access: t.access, refresh: t.refresh ?? a.refresh, expiresAt: t.expiresAt });
    return null;
  },
});

/** A working access token for an account, refreshed first when it is about to run out. */
async function tokenFor(ctx: Pick<ActionCtx, "runMutation">, a: Doc<"integrationAccounts">) {
  if (!a.expiresAt || a.expiresAt > Date.now() + 60_000 || !a.refresh) return unseal(a.access);
  const t = await tokenRequest(a.provider, { grant_type: "refresh_token", refresh_token: await unseal(a.refresh) });
  await ctx.runMutation(internal.integrations.storeTokens, {
    accountId: a._id,
    access: await seal(t.access_token!),
    refresh: t.refresh_token ? await seal(t.refresh_token) : undefined,
    expiresAt: t.expires_in ? Date.now() + t.expires_in * 1000 : undefined,
  });
  return t.access_token!;
}

async function call(token: string, url: string, init: { method?: string; body?: unknown; notion?: boolean } = {}) {
  const res = await fetch(url, {
    method: init.method ?? (init.body ? "POST" : "GET"),
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init.notion ? { "Notion-Version": NOTION_VERSION } : {}),
    },
    body: init.body ? JSON.stringify(init.body) : undefined,
    signal: AbortSignal.timeout(20_000),
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const message = (data.error as { message?: string } | undefined)?.message ?? (data.message as string | undefined) ?? `answered ${res.status}`;
    throw Object.assign(new Error(String(message).slice(0, 200)), { status: res.status });
  }
  return data;
}

/* ------------------------------------------------------------------ */
/* Where a form's responses go                                          */

/** What can be picked in an account: Notion pages to make a database in, Airtable bases to make a table in. */
export const places = action({
  args: { accountId: v.id("integrationAccounts") },
  handler: async (ctx, { accountId }): Promise<{ id: string; name: string }[]> => {
    const a = await ctx.runQuery(internal.integrations.ownAccount, { accountId });
    if (!a) throw new ConvexError("That account is not connected any more.");
    const token = await tokenFor(ctx, a);
    if (a.provider === "notion") {
      const found = await call(token, "https://api.notion.com/v1/search", {
        notion: true,
        body: { filter: { property: "object", value: "page" }, page_size: 50 },
      });
      return ((found.results as { id: string; properties?: Record<string, { type: string; title?: { plain_text: string }[] }> }[]) ?? []).map((pg) => {
        const title = Object.values(pg.properties ?? {}).find((x) => x.type === "title")?.title?.map((t) => t.plain_text).join("") ?? "";
        return { id: pg.id, name: title || "Untitled page" };
      });
    }
    if (a.provider === "airtable") {
      const bases = await call(token, "https://api.airtable.com/v0/meta/bases");
      return ((bases.bases as { id: string; name: string }[]) ?? []).map((b) => ({ id: b.id, name: b.name }));
    }
    return [];
  },
});

export const setupContext = internalQuery({
  args: { formId: v.id("forms"), accountId: v.id("integrationAccounts") },
  handler: async (ctx, { formId, accountId }) => {
    const form = await formFor(ctx, formId);
    const me = await requireUser(ctx);
    const a = await ctx.db.get(accountId);
    if (!a || a.ownerId !== me._id) throw new ConvexError("That account is not connected any more.");
    await requireFeature(ctx, form, a.provider === "google" ? "connect.sheets" : "connect.apps");
    const existing = await ctx.db
      .query("connections")
      .withIndex("by_form", (q) => q.eq("formId", formId))
      .collect();
    if (existing.length >= 10) throw new ConvexError("Ten connections is the most one form can have.");
    const questions = (
      await ctx.db
        .query("blocks")
        .withIndex("by_form_order", (q) => q.eq("formId", formId))
        .collect()
    )
      .filter((b) => b.kind === "field" && b.type !== "hidden")
      .sort((x, y) => x.order - y.order)
      .map((b) => b.title?.trim() || "Question");
    return { account: a, title: form.title, ownerId: form.ownerId, questions };
  },
});

export const addConnection = internalMutation({
  args: {
    formId: v.id("forms"),
    ownerId: v.id("users"),
    kind: v.union(v.literal("gsheets"), v.literal("notion"), v.literal("airtable"), v.literal("hubspot")),
    accountId: v.id("integrationAccounts"),
    label: v.string(),
    target: v.object({ id: v.string(), sub: v.optional(v.string()), name: v.string(), url: v.optional(v.string()), columns: v.optional(v.array(v.string())) }),
  },
  returns: v.id("connections"),
  handler: async (ctx, a) =>
    ctx.db.insert("connections", { ...a, events: ["response.created", "response.updated", "response.paid"], enabled: true, createdAt: Date.now() }),
});

/** Names that work as Notion properties and Airtable fields: unique, short, never reserved. */
function fieldNames(questions: string[], reserved: string[]) {
  const used = new Set(reserved.map((r) => r.toLowerCase()));
  return questions.map((q) => {
    let name = q.replace(/[\r\n]+/g, " ").slice(0, 90);
    for (let n = 2; used.has(name.toLowerCase()); n++) name = `${q.slice(0, 86)} (${n})`;
    used.add(name.toLowerCase());
    return name;
  });
}

/**
 * Makes the place a form's responses go, and the connection to it: a new
 * spreadsheet, a new Notion database in the page picked, a new Airtable
 * table in the base picked, or (HubSpot) the account's contacts.
 */
export const setup = action({
  args: { formId: v.id("forms"), accountId: v.id("integrationAccounts"), place: v.optional(v.string()) },
  handler: async (ctx, { formId, accountId, place }): Promise<{ name: string; url: string | null }> => {
    const c = await ctx.runQuery(internal.integrations.setupContext, { formId, accountId });
    const token = await tokenFor(ctx, c.account);
    const kind = PROVIDERS[c.account.provider].kind;
    const head = ["Submitted", "Name", "Email", ...c.questions];
    let target: { id: string; sub?: string; name: string; url?: string; columns?: string[] };
    try {
      if (c.account.provider === "google") {
        const sheet = await call(token, "https://sheets.googleapis.com/v4/spreadsheets", {
          body: { properties: { title: `${c.title} (Formkit)` }, sheets: [{ properties: { title: "Responses" } }] },
        });
        const id = sheet.spreadsheetId as string;
        await call(token, `https://sheets.googleapis.com/v4/spreadsheets/${id}/values/Responses!A1?valueInputOption=RAW`, {
          method: "PUT",
          body: { values: [head] },
        });
        target = { id, name: `${c.title} (Formkit)`, url: sheet.spreadsheetUrl as string, columns: c.questions };
      } else if (c.account.provider === "notion") {
        if (!place) throw new ConvexError("Pick the Notion page to make the database in.");
        const names = fieldNames(c.questions, ["Name", "Submitted", "Email"]);
        const db = await call(token, "https://api.notion.com/v1/databases", {
          notion: true,
          body: {
            parent: { type: "page_id", page_id: place },
            title: [{ type: "text", text: { content: `${c.title} responses` } }],
            properties: {
              Name: { title: {} },
              Submitted: { date: {} },
              Email: { email: {} },
              ...Object.fromEntries(names.map((n) => [n, { rich_text: {} }])),
            },
          },
        });
        target = { id: db.id as string, name: `${c.title} responses`, url: db.url as string, columns: names };
      } else if (c.account.provider === "airtable") {
        if (!place) throw new ConvexError("Pick the Airtable base to make the table in.");
        const names = fieldNames(c.questions, ["Name", "Submitted", "Email"]);
        const table = await call(token, `https://api.airtable.com/v0/meta/bases/${place}/tables`, {
          body: {
            name: `${c.title} (Formkit)`.slice(0, 100),
            fields: [
              { name: "Name", type: "singleLineText" },
              { name: "Submitted", type: "dateTime", options: { timeZone: "utc", dateFormat: { name: "iso" }, timeFormat: { name: "24hour" } } },
              { name: "Email", type: "email" },
              ...names.map((n) => ({ name: n, type: "multilineText" })),
            ],
          },
        });
        target = { id: place, sub: table.id as string, name: `${c.title} (Formkit)`, url: `https://airtable.com/${place}/${table.id as string}`, columns: names };
      } else {
        target = { id: "contacts", name: "Contacts", url: "https://app.hubspot.com/contacts" };
      }
    } catch (e) {
      if (e instanceof ConvexError) throw e;
      throw new ConvexError(`${PROVIDERS[c.account.provider].label} did not take it: ${(e as Error).message}`);
    }
    await ctx.runMutation(internal.integrations.addConnection, {
      formId,
      ownerId: c.ownerId,
      kind,
      accountId,
      label: `${PROVIDERS[c.account.provider].label}: ${target.name}`.slice(0, 80),
      target,
    });
    return { name: target.name, url: target.url ?? null };
  },
});

/* ------------------------------------------------------------------ */
/* Sending a response                                                   */

type Delivered = { ok: boolean; status: number; detail?: string };
type Answer = { key: string | null; question: string; value: string; fileUrl?: string | null };
type Payload = {
  event: string;
  response: { id: string; submittedAt: string; respondent: { name: string | null; email: string | null }; answers: Answer[]; payment: { status: string } | null };
};

export const ref = internalQuery({
  args: { connectionId: v.id("connections"), responseId: v.id("responses") },
  handler: async (ctx, a) =>
    (
      await ctx.db
        .query("integrationRefs")
        .withIndex("by_connection_response", (q) => q.eq("connectionId", a.connectionId).eq("responseId", a.responseId))
        .first()
    )?.ref ?? null,
});

export const saveRef = internalMutation({
  args: { connectionId: v.id("connections"), responseId: v.id("responses"), ref: v.string() },
  returns: v.null(),
  handler: async (ctx, a) => {
    const had = await ctx.db
      .query("integrationRefs")
      .withIndex("by_connection_response", (q) => q.eq("connectionId", a.connectionId).eq("responseId", a.responseId))
      .first();
    if (had) await ctx.db.patch(had._id, { ref: a.ref });
    else await ctx.db.insert("integrationRefs", a);
    return null;
  },
});

/** Each column's answer, matched by question. */
function valuesFor(columns: string[], answers: Answer[]) {
  const byQuestion = new Map(answers.map((a) => [a.question.trim(), a.fileUrl ?? a.value]));
  return columns.map((c) => byQuestion.get(c.replace(/ \(\d+\)$/, "").trim()) ?? byQuestion.get(c.trim()) ?? "");
}

/**
 * Adds a response to the app, or updates what it already became. Called by
 * connections.deliver for app connections; the result goes in its log.
 */
export async function pushToApp(ctx: ActionCtx, c: Doc<"connections">, p: Payload, responseId: Id<"responses">): Promise<Delivered> {
  if (!c.accountId || !c.target) return { ok: false, status: 0, detail: "Not set up" };
  const a = await ctx.runQuery(internal.integrations.account, { accountId: c.accountId });
  if (!a) return { ok: false, status: 0, detail: "The account was disconnected. Connect it again." };
  if (a.paused) return { ok: false, status: 0, detail: "Paused by Formkit for a moment" };
  try {
    const token = await tokenFor(ctx, a);
    const t = c.target;
    const existing = await ctx.runQuery(internal.integrations.ref, { connectionId: c._id, responseId });
    const r = p.response;
    const cols = t.columns ?? [];
    const values = valuesFor(cols, r.answers);
    let made: string | null = null;
    if (c.kind === "gsheets") {
      const row = [r.submittedAt, r.respondent.name ?? "", r.respondent.email ?? "", ...values];
      if (existing) {
        await call(token, `https://sheets.googleapis.com/v4/spreadsheets/${t.id}/values/Responses!A${existing}?valueInputOption=RAW`, {
          method: "PUT",
          body: { values: [row] },
        });
      } else {
        const out = await call(token, `https://sheets.googleapis.com/v4/spreadsheets/${t.id}/values/Responses!A1:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`, {
          body: { values: [row] },
        });
        const range = ((out.updates as { updatedRange?: string } | undefined)?.updatedRange ?? "").match(/![A-Z]+(\d+)/);
        made = range?.[1] ?? null;
      }
    } else if (c.kind === "notion") {
      const properties = {
        Name: { title: [{ type: "text", text: { content: (r.respondent.name ?? r.respondent.email ?? "Response").slice(0, 200) } }] },
        Submitted: { date: { start: r.submittedAt } },
        Email: { email: r.respondent.email || null },
        ...Object.fromEntries(cols.map((col, i) => [col, { rich_text: values[i] ? [{ type: "text", text: { content: values[i]!.slice(0, 2000) } }] : [] }])),
      };
      if (existing) await call(token, `https://api.notion.com/v1/pages/${existing}`, { method: "PATCH", notion: true, body: { properties } });
      else made = (await call(token, "https://api.notion.com/v1/pages", { notion: true, body: { parent: { database_id: t.id }, properties } })).id as string;
    } else if (c.kind === "airtable") {
      const fields = {
        Name: r.respondent.name ?? "",
        Submitted: r.submittedAt,
        ...(r.respondent.email ? { Email: r.respondent.email } : {}),
        ...Object.fromEntries(cols.map((col, i) => [col, values[i]!.slice(0, 10000)])),
      };
      const at = `https://api.airtable.com/v0/${t.id}/${t.sub}`;
      if (existing) await call(token, at, { method: "PATCH", body: { records: [{ id: existing, fields }], typecast: true } });
      else made = ((await call(token, at, { body: { records: [{ fields }], typecast: true } })).records as { id: string }[])[0]!.id;
    } else if (c.kind === "hubspot") {
      const email = r.respondent.email?.trim();
      if (!email) return { ok: false, status: 0, detail: "No email address to match a contact to" };
      const [first, ...rest] = (r.respondent.name ?? "").trim().split(/\s+/);
      const out = await call(token, "https://api.hubapi.com/crm/v3/objects/contacts/batch/upsert", {
        body: {
          inputs: [
            {
              idProperty: "email",
              id: email,
              properties: { email, ...(first ? { firstname: first } : {}), ...(rest.length ? { lastname: rest.join(" ") } : {}) },
            },
          ],
        },
      });
      made = existing ? null : ((out.results as { id: string }[])?.[0]?.id ?? null);
    }
    if (made) await ctx.runMutation(internal.integrations.saveRef, { connectionId: c._id, responseId, ref: made });
    return { ok: true, status: 200, detail: existing ? "Updated" : undefined };
  } catch (e) {
    const status = (e as { status?: number }).status ?? 0;
    return { ok: false, status, detail: status === 401 || status === 403 ? "The app refused it. Connect the account again." : (e as Error).message };
  }
}

/** Account deletion and a form's purge take their app links with them. */
export async function forgetRefs(ctx: { db: import("./_generated/server").MutationCtx["db"] }, connectionId: Id<"connections">) {
  for (const r of await ctx.db
    .query("integrationRefs")
    .withIndex("by_connection_response", (q) => q.eq("connectionId", connectionId))
    .take(1000)) {
    await ctx.db.delete(r._id);
  }
}

export const connectedFor = query({
  args: { formId: v.id("forms") },
  handler: async (ctx, { formId }) => {
    const form = await formFor(ctx, formId, "read");
    return {
      sheets: await hasFeature(ctx, form, "connect.sheets"),
      apps: await hasFeature(ctx, form, "connect.apps"),
    };
  },
});
