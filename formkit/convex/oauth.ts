import { ConvexError, v } from "convex/values";
import { action, httpAction, internalMutation, internalQuery, mutation, query } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { getAuthUserId } from "@convex-dev/auth/server";
import { requireUser } from "./model/identity";
import { sha256Hex } from "./model/apiKeys";
import { SCOPES, SCOPE_TEXT, scopesOf, type Scope } from "./model/apiAuth";
import { allow } from "./model/rateLimit";

/**
 * Formkit as an OAuth 2.1 authorisation server, for AI assistants that
 * connect to its MCP server (Claude, ChatGPT and others).
 *
 * - An app is known by its Client ID Metadata Document (its client_id is the
 *   https address of a JSON file describing it), or registers itself
 *   (dynamic client registration). Public clients only: PKCE (S256) always.
 * - The person signs in to Formkit and sees what the app asks to do on the
 *   consent screen (/connect), and can untick any of it.
 * - Tokens are for the MCP server and the API behind it (RFC 8707). Access
 *   tokens last an hour; refresh tokens 30 days and are replaced each use.
 *   Only hashes are kept. Settings → Developers lists and revokes them.
 */

const SITE = (process.env.SITE_URL ?? "https://formkit.app").replace(/\/$/, "");
/** What tokens are for. The API alone is accepted too, for clients that name it. */
export const RESOURCES = [`${SITE}/api/mcp`, `${SITE}/api/v2`, SITE];

const CODE_MS = 5 * 60_000;
const ACCESS_MS = 60 * 60_000;
const REFRESH_MS = 30 * 24 * 60 * 60_000;
/** A metadata document is read again after this. */
const DOC_FRESH_MS = 24 * 60 * 60_000;
const DEFAULT_SCOPES: Scope[] = ["forms:read", "forms:write", "forms:publish", "responses:read"];

const random = (bytes = 24) => {
  const b = new Uint8Array(bytes);
  crypto.getRandomValues(b);
  return [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
};

/* ------------------------------------------------------------------ */
/* Checking an app and where it sends people back                       */

/** Loopback addresses may use any port (RFC 8252); everything else must match exactly. */
export function redirectAllowed(registered: string[], uri: string) {
  if (registered.includes(uri)) return true;
  let u: URL;
  try {
    u = new URL(uri);
  } catch {
    return false;
  }
  if (u.protocol !== "http:" || !["127.0.0.1", "localhost", "[::1]"].includes(u.hostname)) return false;
  return registered.some((r) => {
    try {
      const x = new URL(r);
      return x.protocol === "http:" && x.hostname === u.hostname && x.pathname === u.pathname;
    } catch {
      return false;
    }
  });
}

/** A redirect an app may register: https, or loopback http for apps on the person's own computer. */
function redirectShapeOk(uri: string) {
  try {
    const u = new URL(uri);
    if (u.hash) return false;
    if (u.protocol === "https:") return true;
    if (u.protocol === "http:") return ["127.0.0.1", "localhost", "[::1]"].includes(u.hostname);
    // Custom schemes for desktop apps (e.g. cursor://), never javascript: or data:.
    return /^[a-z][a-z0-9+.-]*:$/.test(u.protocol) && !["javascript:", "data:", "file:", "vbscript:"].includes(u.protocol);
  } catch {
    return false;
  }
}

/** A client_id that is a metadata document's address: https, a path, no tricks. */
function isDocumentId(clientId: string) {
  try {
    const u = new URL(clientId);
    return (
      u.protocol === "https:" &&
      u.pathname.length > 1 &&
      !u.hash &&
      !u.username &&
      !u.password &&
      !/^(\d+\.){3}\d+$|^\[|^localhost$|\.local$|\.internal$/i.test(u.hostname)
    );
  } catch {
    return false;
  }
}

export const clientRow = internalQuery({
  args: { clientId: v.string() },
  handler: async (ctx, { clientId }) =>
    ctx.db
      .query("oauthClients")
      .withIndex("by_client", (q) => q.eq("clientId", clientId))
      .first(),
});

export const saveDocumentClient = internalMutation({
  args: { clientId: v.string(), name: v.string(), redirectUris: v.array(v.string()), logoUri: v.optional(v.string()), clientUri: v.optional(v.string()) },
  returns: v.null(),
  handler: async (ctx, a) => {
    const row = await ctx.db
      .query("oauthClients")
      .withIndex("by_client", (q) => q.eq("clientId", a.clientId))
      .first();
    const fields = { ...a, kind: "document" as const, fetchedAt: Date.now() };
    if (row) await ctx.db.patch(row._id, fields);
    else await ctx.db.insert("oauthClients", { ...fields, createdAt: Date.now() });
    return null;
  },
});

/** Reads an app's metadata document (small, quick, https only) and keeps what it says. */
async function readDocument(clientId: string) {
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), 5000);
  try {
    const res = await fetch(clientId, { headers: { Accept: "application/json" }, redirect: "error", signal: abort.signal });
    if (!res.ok) return null;
    const raw = await res.text();
    if (raw.length > 20_000) return null;
    const doc = JSON.parse(raw) as Record<string, unknown>;
    if (doc.client_id !== clientId) return null;
    const redirectUris = (Array.isArray(doc.redirect_uris) ? doc.redirect_uris : []).map(String).filter(redirectShapeOk).slice(0, 10);
    if (!redirectUris.length) return null;
    const https = (x: unknown) => (typeof x === "string" && x.startsWith("https://") ? x.slice(0, 500) : undefined);
    return {
      name: String(doc.client_name ?? new URL(clientId).hostname).slice(0, 80),
      redirectUris,
      logoUri: https(doc.logo_uri),
      clientUri: https(doc.client_uri),
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

type Prepared =
  | { ok: true; client: { name: string; host: string; logoUri: string | null; verified: boolean }; scopes: { scope: Scope; label: string; detail: string }[] }
  | { ok: false; message: string; redirect?: string };

/**
 * What the consent screen shows: who is asking, for what. Checks everything
 * about the request first; a request that cannot be trusted is never sent
 * back to its redirect address.
 */
export const prepare = action({
  args: {
    clientId: v.string(),
    redirectUri: v.string(),
    responseType: v.string(),
    codeChallenge: v.string(),
    codeChallengeMethod: v.string(),
    scope: v.optional(v.string()),
    resource: v.optional(v.string()),
    state: v.optional(v.string()),
  },
  handler: async (ctx, a): Promise<Prepared> => {
    if (!(await getAuthUserId(ctx))) return { ok: false, message: "Sign in to Formkit first." };
    let client: Doc<"oauthClients"> | null = await ctx.runQuery(internal.oauth.clientRow, { clientId: a.clientId });
    if (isDocumentId(a.clientId) && (!client || Date.now() - (client.fetchedAt ?? 0) > DOC_FRESH_MS)) {
      const doc = await readDocument(a.clientId);
      if (doc) {
        await ctx.runMutation(internal.oauth.saveDocumentClient, { clientId: a.clientId, ...doc });
        client = await ctx.runQuery(internal.oauth.clientRow, { clientId: a.clientId });
      }
    }
    if (!client) return { ok: false, message: "Formkit does not know this app. Ask its makers to check how it connects." };
    if (!redirectAllowed(client.redirectUris, a.redirectUri)) {
      return { ok: false, message: "This app asked to send you somewhere it has not registered, so Formkit stopped." };
    }
    const back = (error: string, description: string) => {
      const u = new URL(a.redirectUri);
      u.searchParams.set("error", error);
      u.searchParams.set("error_description", description);
      if (a.state) u.searchParams.set("state", a.state);
      u.searchParams.set("iss", SITE);
      return u.toString();
    };
    if (a.responseType !== "code") return { ok: false, message: "This app asked in a way Formkit does not support.", redirect: back("unsupported_response_type", "Only code is supported.") };
    if (a.codeChallengeMethod !== "S256" || !/^[A-Za-z0-9_-]{43,128}$/.test(a.codeChallenge)) {
      return { ok: false, message: "This app did not secure its request (PKCE), so Formkit stopped.", redirect: back("invalid_request", "PKCE with S256 is required.") };
    }
    if (a.resource && !RESOURCES.includes(a.resource.replace(/\/$/, ""))) {
      return { ok: false, message: "This app asked for access to something that is not Formkit.", redirect: back("invalid_target", "Unknown resource.") };
    }
    const asked = a.scope ? SCOPES.filter((s) => a.scope!.split(/\s+/).includes(s)) : DEFAULT_SCOPES;
    if (!asked.length) return { ok: false, message: "This app asked for nothing Formkit can give.", redirect: back("invalid_scope", "No known scope.") };
    return {
      ok: true,
      client: {
        name: client.name,
        host: (() => {
          try {
            return new URL(client.kind === "document" ? client.clientId : (client.redirectUris[0] ?? "")).host;
          } catch {
            return "";
          }
        })(),
        logoUri: client.logoUri ?? null,
        // Known by an address it publishes, rather than registered by itself.
        verified: client.kind === "document",
      },
      scopes: asked.map((scope) => ({ scope, ...SCOPE_TEXT[scope] })),
    };
  },
});

/** The person said yes: a one-time code for the app to swap for tokens. */
export const approve = mutation({
  args: {
    clientId: v.string(),
    redirectUri: v.string(),
    codeChallenge: v.string(),
    scopes: v.array(v.string()),
    resource: v.optional(v.string()),
  },
  returns: v.string(),
  handler: async (ctx, a) => {
    const me = await requireUser(ctx);
    const client = await ctx.db
      .query("oauthClients")
      .withIndex("by_client", (q) => q.eq("clientId", a.clientId))
      .first();
    if (!client || !redirectAllowed(client.redirectUris, a.redirectUri)) throw new ConvexError("This app could not be checked. Start again from the app.");
    const scopes = SCOPES.filter((s) => a.scopes.includes(s));
    if (!scopes.length) throw new ConvexError("Leave at least one permission ticked, or cancel.");
    const code = random(32);
    await ctx.db.insert("oauthCodes", {
      codeHash: await sha256Hex(code),
      clientId: a.clientId,
      userId: me._id,
      scopes,
      redirectUri: a.redirectUri,
      challenge: a.codeChallenge,
      resource: (a.resource ?? `${SITE}/api/mcp`).replace(/\/$/, ""),
      expiresAt: Date.now() + CODE_MS,
    });
    return code;
  },
});

/* ------------------------------------------------------------------ */
/* Tokens                                                               */

async function s256(verifier: string) {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier)));
  return btoa(String.fromCharCode(...digest)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

type Issued = { access: string; refresh: string; scopes: string[] };
type TokenResult = { ok: true; issued: Issued } | { ok: false; error: string; description: string };

async function issue(ctx: MutationCtx, row: Omit<Doc<"oauthTokens">, "_id" | "_creationTime" | "accessHash" | "refreshHash" | "accessExpiresAt" | "refreshExpiresAt">, existing?: Id<"oauthTokens">): Promise<Issued> {
  const access = `fk_at_${random()}`;
  const refresh = `fk_rt_${random()}`;
  const fields = {
    accessHash: await sha256Hex(access),
    accessExpiresAt: Date.now() + ACCESS_MS,
    refreshHash: await sha256Hex(refresh),
    refreshExpiresAt: Date.now() + REFRESH_MS,
  };
  if (existing) await ctx.db.patch(existing, fields);
  else await ctx.db.insert("oauthTokens", { ...row, ...fields });
  return { access, refresh, scopes: row.scopes };
}

export const exchange = internalMutation({
  args: {
    grant: v.string(),
    code: v.optional(v.string()),
    verifier: v.optional(v.string()),
    redirectUri: v.optional(v.string()),
    clientId: v.optional(v.string()),
    refresh: v.optional(v.string()),
    resource: v.optional(v.string()),
    ip: v.string(),
  },
  handler: async (ctx, a): Promise<TokenResult> => {
    if (!(await allow(ctx, `oauth-token:${a.ip}`, { max: 60, windowMs: 60_000 }))) {
      return { ok: false, error: "slow_down", description: "Too many requests. Wait a minute." };
    }
    if (a.grant === "authorization_code") {
      if (!a.code || !a.verifier) return { ok: false, error: "invalid_request", description: "code and code_verifier are required." };
      const codeHash = await sha256Hex(a.code);
      const row = await ctx.db
        .query("oauthCodes")
        .withIndex("by_code", (q) => q.eq("codeHash", codeHash))
        .first();
      const bad = { ok: false as const, error: "invalid_grant", description: "That code is not valid, has been used, or has expired." };
      if (!row || row.usedAt || row.expiresAt < Date.now()) return bad;
      // A code is spent the moment it is tried.
      await ctx.db.patch(row._id, { usedAt: Date.now() });
      if (row.clientId !== a.clientId || row.redirectUri !== a.redirectUri) return bad;
      if ((await s256(a.verifier)) !== row.challenge) return bad;
      if (a.resource && a.resource.replace(/\/$/, "") !== row.resource && !RESOURCES.includes(a.resource.replace(/\/$/, ""))) {
        return { ok: false, error: "invalid_target", description: "Unknown resource." };
      }
      const client = await ctx.db
        .query("oauthClients")
        .withIndex("by_client", (q) => q.eq("clientId", row.clientId))
        .first();
      const issued = await issue(ctx, {
        userId: row.userId,
        clientId: row.clientId,
        clientName: client?.name ?? "An app",
        scopes: row.scopes,
        resource: row.resource,
        createdAt: Date.now(),
      });
      return { ok: true, issued };
    }
    if (a.grant === "refresh_token") {
      if (!a.refresh) return { ok: false, error: "invalid_request", description: "refresh_token is required." };
      const presented = await sha256Hex(a.refresh);
      const row = await ctx.db
        .query("oauthTokens")
        .withIndex("by_refresh", (q) => q.eq("refreshHash", presented))
        .first();
      if (!row || row.revokedAt || row.refreshExpiresAt < Date.now() || (a.clientId && a.clientId !== row.clientId)) {
        return { ok: false, error: "invalid_grant", description: "That refresh token is not valid. Connect again." };
      }
      const { _id, _creationTime, accessHash, refreshHash, accessExpiresAt, refreshExpiresAt, ...keep } = row;
      void _creationTime;
      void accessHash;
      void refreshHash;
      void accessExpiresAt;
      void refreshExpiresAt;
      return { ok: true, issued: await issue(ctx, keep, _id) };
    }
    return { ok: false, error: "unsupported_grant_type", description: "Use authorization_code or refresh_token." };
  },
});

export const register = internalMutation({
  args: { name: v.string(), redirectUris: v.array(v.string()), clientUri: v.optional(v.string()), logoUri: v.optional(v.string()), ip: v.string() },
  handler: async (ctx, a): Promise<{ ok: true; clientId: string } | { ok: false; description: string }> => {
    if (!(await allow(ctx, `oauth-register:${a.ip}`, { max: 20, windowMs: 60 * 60_000 }))) {
      return { ok: false, description: "Too many apps registered from here. Try again later." };
    }
    const redirectUris = a.redirectUris.filter(redirectShapeOk).slice(0, 10);
    if (!redirectUris.length || redirectUris.length !== a.redirectUris.slice(0, 10).length) {
      return { ok: false, description: "Every redirect_uri must be https, a loopback address, or an app's own scheme." };
    }
    const clientId = `fkc_${random(16)}`;
    await ctx.db.insert("oauthClients", {
      clientId,
      kind: "registered",
      name: a.name.trim().slice(0, 80) || "An app",
      redirectUris,
      clientUri: a.clientUri?.startsWith("https://") ? a.clientUri.slice(0, 500) : undefined,
      logoUri: a.logoUri?.startsWith("https://") ? a.logoUri.slice(0, 500) : undefined,
      createdAt: Date.now(),
    });
    return { ok: true, clientId };
  },
});

export const revokeToken = internalMutation({
  args: { token: v.string() },
  returns: v.null(),
  handler: async (ctx, { token }) => {
    const hash = await sha256Hex(token);
    const row =
      (await ctx.db
        .query("oauthTokens")
        .withIndex("by_access", (q) => q.eq("accessHash", hash))
        .first()) ??
      (await ctx.db
        .query("oauthTokens")
        .withIndex("by_refresh", (q) => q.eq("refreshHash", hash))
        .first());
    if (row && !row.revokedAt) await ctx.db.patch(row._id, { revokedAt: Date.now() });
    return null;
  },
});

/** Daily: codes that were never swapped, and grants long dead. */
export const prune = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    for (const c of await ctx.db
      .query("oauthCodes")
      .withIndex("by_expiry", (q) => q.lt("expiresAt", Date.now() - 60 * 60_000))
      .take(500)) {
      await ctx.db.delete(c._id);
    }
    return null;
  },
});

/* ------------------------------------------------------------------ */
/* HTTP: /oauth/token, /oauth/register, /oauth/revoke                    */

const cors = { "Access-Control-Allow-Origin": "*", "Cache-Control": "no-store" };
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...cors } });

async function form(req: Request): Promise<Record<string, string>> {
  const type = req.headers.get("content-type") ?? "";
  const text = (await req.text()).slice(0, 20_000);
  if (type.includes("application/json")) {
    try {
      return Object.fromEntries(Object.entries(JSON.parse(text) as Record<string, unknown>).map(([k, v]) => [k, String(v)]));
    } catch {
      return {};
    }
  }
  return Object.fromEntries(new URLSearchParams(text));
}

const ipOf = (req: Request) => (req.headers.get("x-formkit-ip") ?? req.headers.get("x-forwarded-for") ?? "-").split(",")[0]!.trim().slice(0, 64);

export const token = httpAction(async (ctx, req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: { ...cors, "Access-Control-Allow-Headers": "Content-Type", "Access-Control-Allow-Methods": "POST" } });
  const f = await form(req);
  const out = await ctx.runMutation(internal.oauth.exchange, {
    grant: f.grant_type ?? "",
    code: f.code,
    verifier: f.code_verifier,
    redirectUri: f.redirect_uri,
    clientId: f.client_id,
    refresh: f.refresh_token,
    resource: f.resource,
    ip: ipOf(req),
  });
  if (!out.ok) return reply({ error: out.error, error_description: out.description }, out.error === "slow_down" ? 429 : 400);
  return reply({
    access_token: out.issued.access,
    token_type: "Bearer",
    expires_in: ACCESS_MS / 1000,
    refresh_token: out.issued.refresh,
    scope: out.issued.scopes.join(" "),
  });
});

export const registerClient = httpAction(async (ctx, req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: { ...cors, "Access-Control-Allow-Headers": "Content-Type", "Access-Control-Allow-Methods": "POST" } });
  let body: Record<string, unknown> = {};
  try {
    body = JSON.parse((await req.text()).slice(0, 20_000)) as Record<string, unknown>;
  } catch {
    return reply({ error: "invalid_client_metadata", error_description: "Send the app's details as JSON." }, 400);
  }
  if (body.token_endpoint_auth_method && body.token_endpoint_auth_method !== "none") {
    return reply({ error: "invalid_client_metadata", error_description: "Formkit takes public clients only (token_endpoint_auth_method: none, with PKCE)." }, 400);
  }
  const redirectUris = Array.isArray(body.redirect_uris) ? body.redirect_uris.map(String) : [];
  const out = await ctx.runMutation(internal.oauth.register, {
    name: String(body.client_name ?? ""),
    redirectUris,
    clientUri: typeof body.client_uri === "string" ? body.client_uri : undefined,
    logoUri: typeof body.logo_uri === "string" ? body.logo_uri : undefined,
    ip: ipOf(req),
  });
  if (!out.ok) return reply({ error: "invalid_redirect_uri", error_description: out.description }, 400);
  return reply(
    {
      client_id: out.clientId,
      client_id_issued_at: Math.floor(Date.now() / 1000),
      client_name: String(body.client_name ?? "").slice(0, 80) || "An app",
      redirect_uris: redirectUris,
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      token_endpoint_auth_method: "none",
    },
    201,
  );
});

export const revoke = httpAction(async (ctx, req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: { ...cors, "Access-Control-Allow-Headers": "Content-Type", "Access-Control-Allow-Methods": "POST" } });
  const f = await form(req);
  if (f.token) await ctx.runMutation(internal.oauth.revokeToken, { token: f.token.slice(0, 200) });
  // Always 200, whether or not the token was known (RFC 7009).
  return new Response(null, { status: 200, headers: cors });
});

/* ------------------------------------------------------------------ */
/* Settings → Developers: connected apps                                */

export const connectedApps = query({
  args: {},
  handler: async (ctx) => {
    const me = await requireUser(ctx);
    const rows = await ctx.db
      .query("oauthTokens")
      .withIndex("by_user", (q) => q.eq("userId", me._id))
      .collect();
    const live = rows.filter((r) => !r.revokedAt && r.refreshExpiresAt > Date.now());
    const apps = new Map<string, { clientId: string; name: string; scopes: Set<string>; since: number; lastUsedAt: number | null }>();
    for (const r of live) {
      const a = apps.get(r.clientId) ?? { clientId: r.clientId, name: r.clientName, scopes: new Set<string>(), since: r.createdAt, lastUsedAt: null };
      for (const s of r.scopes) a.scopes.add(s);
      a.since = Math.min(a.since, r.createdAt);
      a.lastUsedAt = Math.max(a.lastUsedAt ?? 0, r.lastUsedAt ?? 0) || null;
      apps.set(r.clientId, a);
    }
    return [...apps.values()]
      .sort((a, b) => b.since - a.since)
      .map((a) => ({ ...a, scopes: scopesOf([...a.scopes]).map((s) => SCOPE_TEXT[s].label) }));
  },
});

export const disconnect = mutation({
  args: { clientId: v.string() },
  returns: v.null(),
  handler: async (ctx, { clientId }) => {
    const me = await requireUser(ctx);
    for (const r of await ctx.db
      .query("oauthTokens")
      .withIndex("by_user", (q) => q.eq("userId", me._id))
      .collect()) {
      if (r.clientId === clientId && !r.revokedAt) await ctx.db.patch(r._id, { revokedAt: Date.now() });
    }
    return null;
  },
});
