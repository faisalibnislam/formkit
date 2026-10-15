import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { action, httpAction, internalMutation, internalQuery, mutation, query, type MutationCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import { requireUser } from "./model/identity";
import { hasFeature, requireFeature } from "./model/plans";
import { audit } from "./model/team";
import { notify } from "./model/inbox";
import { seatsChanged } from "./team";

/**
 * Business: SAML single sign-on and SCIM provisioning, through WorkOS.
 *
 * Builds on the domain a company already proved it owns (sso.ts). The owner
 * sets up a WorkOS organization for it here, then hands their IT admin a
 * link to WorkOS's own setup pages: one connects the company's identity
 * provider (Okta, Entra ID, Google Workspace, any SAML), the other its
 * directory.
 *
 * Signing in: someone at the domain asks for single sign-on, WorkOS sends
 * them through their identity provider and back to /sso/callback, and the
 * "saml" provider in auth.ts trades the code for their profile and opens a
 * session. Their first sign-in makes them a member, as the role the owner
 * picked.
 *
 * The directory: WorkOS tells Formkit (webhook, below) when someone joins,
 * changes or leaves, and their membership follows - leaving ends their
 * access at once.
 *
 * Needs WORKOS_API_KEY and WORKOS_CLIENT_ID on the deployment, and
 * WORKOS_WEBHOOK_SECRET for the directory. Without them none of it shows.
 */

const API = "https://api.workos.com";
const SITE = (process.env.SITE_URL ?? "https://formkit.app").replace(/\/$/, "");
const STATE_MS = 10 * 60_000;

export const workosOn = () => !!(process.env.WORKOS_API_KEY && process.env.WORKOS_CLIENT_ID);

async function workos(path: string, init?: { method?: string; json?: unknown; form?: Record<string, string> }) {
  const res = await fetch(`${API}${path}`, {
    method: init?.method ?? "GET",
    headers: {
      Authorization: `Bearer ${process.env.WORKOS_API_KEY}`,
      ...(init?.json ? { "Content-Type": "application/json" } : {}),
      ...(init?.form ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
    },
    body: init?.json ? JSON.stringify(init.json) : init?.form ? new URLSearchParams(init.form).toString() : undefined,
    signal: AbortSignal.timeout(15_000),
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return { ok: res.ok, status: res.status, data };
}

/** For the sign-in card: whether "Sign in with single sign-on" is offered at all. */
export const available = query({
  args: {},
  handler: async () => workosOn(),
});

/* ------------------------------------------------------------------ */
/* Setting it up                                                       */
/* ------------------------------------------------------------------ */

export const mine = internalQuery({
  args: {},
  handler: async (ctx) => {
    const me = await requireUser(ctx);
    await requireFeature(ctx, me._id, "sso");
    return { userId: me._id, name: me.name ?? null, email: me.email ?? null, sso: me.sso ?? null };
  },
});

export const saveOrg = internalMutation({
  args: { organizationId: v.string() },
  returns: v.null(),
  handler: async (ctx, { organizationId }) => {
    const me = await requireUser(ctx);
    if (!me.sso) return null;
    await ctx.db.patch(me._id, {
      sso: { ...me.sso, workos: me.sso.workos ?? { organizationId, connected: false, directory: false, role: "viewer" } },
    });
    await audit(ctx, me._id, me, "Set up SAML single sign-on", me.sso.domain);
    return null;
  },
});

/**
 * The link the company's IT admin follows to connect their identity provider
 * ("sso") or directory ("dsync"). Makes the WorkOS organization the first time.
 */
export const portalLink = action({
  args: { intent: v.union(v.literal("sso"), v.literal("dsync")) },
  returns: v.string(),
  handler: async (ctx, { intent }): Promise<string> => {
    if (!workosOn()) throw new ConvexError("SAML isn't switched on for Formkit yet.");
    const me: { name: string | null; sso: Doc<"users">["sso"] | null } = await ctx.runQuery(internal.workos.mine, {});
    if (!me.sso?.verified) throw new ConvexError("Verify your domain first.");
    let org = me.sso.workos?.organizationId;
    if (!org) {
      const made = await workos("/organizations", {
        method: "POST",
        json: { name: me.name ? `${me.name} (${me.sso.domain})` : me.sso.domain, domain_data: [{ domain: me.sso.domain, state: "verified" }] },
      });
      if (!made.ok || typeof made.data.id !== "string") {
        throw new ConvexError(String((made.data as { message?: string }).message ?? "WorkOS didn't set up the organization. Try again."));
      }
      org = made.data.id;
      await ctx.runMutation(internal.workos.saveOrg, { organizationId: org });
    }
    const link = await workos("/portal/generate_link", { method: "POST", json: { organization: org, intent } });
    if (!link.ok || typeof link.data.link !== "string") throw new ConvexError("WorkOS didn't give a setup link. Try again.");
    return link.data.link;
  },
});

/** Asks WorkOS whether the connection and directory are live, and keeps the answer. */
export const refresh = action({
  args: {},
  returns: v.union(v.null(), v.object({ connected: v.boolean(), directory: v.boolean() })),
  handler: async (ctx): Promise<{ connected: boolean; directory: boolean } | null> => {
    if (!workosOn()) return null;
    const me: { sso: Doc<"users">["sso"] | null } = await ctx.runQuery(internal.workos.mine, {});
    const org = me.sso?.workos?.organizationId;
    if (!org) return null;
    const [conns, dirs] = await Promise.all([
      workos(`/connections?organization_id=${encodeURIComponent(org)}`),
      workos(`/directories?organization_id=${encodeURIComponent(org)}`),
    ]);
    const list = (r: { data: Record<string, unknown> }) => ((r.data.data as { state?: string }[] | undefined) ?? []);
    const state = {
      connected: list(conns).some((c) => c.state === "active"),
      directory: list(dirs).some((d) => d.state === "linked" || d.state === "active"),
    };
    await ctx.runMutation(internal.workos.setState, { organizationId: org, ...state });
    return state;
  },
});

async function applyState(ctx: MutationCtx, organizationId: string, change: { connected?: boolean; directory?: boolean }) {
  const owner = await ownerOf(ctx, organizationId);
  if (!owner?.sso?.workos) return;
  const next = { ...owner.sso.workos, ...change };
  // With the SAML connection gone, nobody can be required to use it.
  const providers = next.connected ? owner.sso.providers : owner.sso.providers.filter((p) => p !== "saml");
  await ctx.db.patch(owner._id, { sso: { ...owner.sso, workos: next, providers, enforce: owner.sso.enforce && providers.length > 0 } });
}

export const setState = internalMutation({
  args: { organizationId: v.string(), connected: v.optional(v.boolean()), directory: v.optional(v.boolean()) },
  returns: v.null(),
  handler: async (ctx, { organizationId, ...change }) => {
    await applyState(ctx, organizationId, change);
    return null;
  },
});

/** The role people get when they first sign in with SAML, or the directory adds them. */
export const setRole = mutation({
  args: { role: v.union(v.literal("editor"), v.literal("viewer")) },
  returns: v.null(),
  handler: async (ctx, { role }) => {
    const me = await requireUser(ctx);
    if (!me.sso?.workos) throw new ConvexError("Set up SAML first.");
    await ctx.db.patch(me._id, { sso: { ...me.sso, workos: { ...me.sso.workos, role } } });
    return null;
  },
});

async function ownerOf(ctx: { db: MutationCtx["db"] }, organizationId: string) {
  return await ctx.db
    .query("users")
    .withIndex("by_workos_org", (q) => q.eq("sso.workos.organizationId", organizationId))
    .first();
}

/* ------------------------------------------------------------------ */
/* Signing in                                                          */
/* ------------------------------------------------------------------ */

/**
 * "Sign in with single sign-on": where to send this address, or a refusal
 * when its domain has no live SAML connection.
 */
export const start = internalMutation({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    const domain = email.trim().toLowerCase().split("@")[1];
    if (!domain || !workosOn()) return null;
    const owners = await ctx.db
      .query("users")
      .withIndex("by_sso_domain", (q) => q.eq("sso.domain", domain))
      .take(10);
    const owner = owners.find((o) => o.sso?.verified && o.sso.workos?.connected);
    if (!owner?.sso?.workos || !(await hasFeature(ctx, owner, "sso"))) return null;
    for (const old of await ctx.db
      .query("samlStates")
      .withIndex("by_expires", (q) => q.lt("expiresAt", Date.now()))
      .take(20)) {
      await ctx.db.delete(old._id);
    }
    const bytes = crypto.getRandomValues(new Uint8Array(24));
    const state = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
    await ctx.db.insert("samlStates", { state, ownerId: owner._id, organizationId: owner.sso.workos.organizationId, expiresAt: Date.now() + STATE_MS });
    const q = new URLSearchParams({
      client_id: process.env.WORKOS_CLIENT_ID!,
      redirect_uri: `${SITE}/sso/callback`,
      response_type: "code",
      state,
      organization: owner.sso.workos.organizationId,
      login_hint: email.trim().toLowerCase(),
    });
    return `${API}/sso/authorize?${q}`;
  },
});

export const begin = action({
  args: { email: v.string() },
  returns: v.union(v.string(), v.null()),
  handler: async (ctx, { email }): Promise<string | null> => await ctx.runMutation(internal.workos.start, { email }),
});

/** The callback, step one: the state is used up, and says which company it was for. */
export const takeState = internalMutation({
  args: { state: v.string() },
  handler: async (ctx, { state }) => {
    const row = await ctx.db
      .query("samlStates")
      .withIndex("by_state", (q) => q.eq("state", state))
      .unique();
    if (!row) return null;
    await ctx.db.delete(row._id);
    if (row.expiresAt < Date.now()) return null;
    const owner = await ctx.db.get(row.ownerId);
    if (!owner?.sso?.workos || owner.sso.workos.organizationId !== row.organizationId) return null;
    return { ownerId: owner._id, organizationId: row.organizationId, domain: owner.sso.domain };
  },
});

/** Trades WorkOS's code for the person's profile (auth.ts, "saml" provider). */
export async function profileFor(code: string) {
  const res = await workos("/sso/token", {
    method: "POST",
    form: { client_id: process.env.WORKOS_CLIENT_ID!, client_secret: process.env.WORKOS_API_KEY!, grant_type: "authorization_code", code },
  });
  const p = (res.data.profile ?? null) as { email?: string; first_name?: string; last_name?: string; organization_id?: string } | null;
  if (!res.ok || !p?.email) return null;
  return {
    email: p.email.trim().toLowerCase(),
    name: [p.first_name, p.last_name].filter(Boolean).join(" ").trim() || null,
    organizationId: p.organization_id ?? null,
  };
}

/** The account to sign in, made the first time, and a member of the company. */
async function memberFor(
  ctx: MutationCtx,
  owner: Doc<"users">,
  email: string,
  name: string | null,
  how: { directory?: boolean },
): Promise<Id<"users">> {
  let user = await ctx.db
    .query("users")
    .withIndex("email", (q) => q.eq("email", email))
    .first();
  if (!user) {
    // The identity provider vouched for the address: no code to confirm it.
    const id = await ctx.db.insert("users", { email, name: name ?? undefined, emailVerificationTime: Date.now() } as never);
    user = (await ctx.db.get(id))!;
  }
  if (user._id === owner._id) return user._id;
  const rows = await ctx.db
    .query("teamMembers")
    .withIndex("by_email", (q) => q.eq("email", email))
    .collect();
  const here = rows.find((r) => r.ownerId === owner._id && !r.companyId);
  if (!here) {
    await ctx.db.insert("teamMembers", {
      ownerId: owner._id,
      email,
      userId: user._id,
      role: owner.sso?.workos?.role ?? "viewer",
      status: "active",
      invitedAt: Date.now(),
      ...(how.directory ? { directory: true } : {}),
    });
    await audit(ctx, owner._id, null, `${email} joined through ${how.directory ? "the company directory" : "single sign-on"}`);
    await notify(ctx, owner._id, {
      kind: "team",
      title: `${name ?? email} joined through ${how.directory ? "your directory" : "single sign-on"}`,
      body: `As ${owner.sso?.workos?.role === "editor" ? "an Editor" : "a Viewer"}. Change it under Settings → Members.`,
      href: "/app/settings?tab=team",
      icon: "user-check",
    });
    await seatsChanged(ctx, { ownerId: owner._id, brand: "me" });
  } else if (here.status !== "active" || !here.userId) {
    await ctx.db.patch(here._id, { status: "active", userId: user._id });
  }
  return user._id;
}

/** The callback, step two: a session for the person WorkOS vouched for. */
export const signInUser = internalMutation({
  args: { ownerId: v.id("users"), email: v.string(), name: v.union(v.string(), v.null()) },
  returns: v.object({ userId: v.id("users"), sessionId: v.id("authSessions") }),
  handler: async (ctx, { ownerId, email, name }) => {
    const owner = await ctx.db.get(ownerId);
    if (!owner?.sso?.workos?.connected) throw new ConvexError({ code: "saml", message: "Single sign-on isn't set up for that company any more." });
    const userId = await memberFor(ctx, owner, email, name, {});
    const user = await ctx.db.get(userId);
    if (user?.deactivatedAt) throw new ConvexError({ code: "saml", message: "This account is deactivated. Ask the company's owner." });
    const now = Date.now();
    await ctx.db.patch(userId, { samlAt: now });
    const sessionId = await ctx.db.insert("authSessions", { userId, expirationTime: now + 30 * 24 * 3600_000 });
    // The identity provider checked the person, with its own second factor.
    await ctx.db.insert("sessionInfo", { sessionId, userId, device: "A browser", firstSeen: now, lastSeen: now, twoFactorAt: now });
    return { userId, sessionId };
  },
});

/* ------------------------------------------------------------------ */
/* The directory (SCIM), by webhook                                    */
/* ------------------------------------------------------------------ */

/** WorkOS's signature: HMAC-SHA256 of "timestamp.body" (milliseconds), within five minutes. */
export async function workosSigned(header: string, body: string, secret: string, now = Date.now()) {
  const pairs = header.split(",").map((p) => p.trim().split("=") as [string, string | undefined]);
  const t = Number(pairs.find(([k]) => k === "t")?.[1]);
  const sig = pairs.find(([k]) => k === "v1")?.[1] ?? "";
  if (!t || !sig || Math.abs(now - t) > 5 * 60_000) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${t}.${body}`)));
  const hex = Array.from(mac, (b) => b.toString(16).padStart(2, "0")).join("");
  return sig.length === hex.length && [...sig].reduce((d, c, i) => d | (c.charCodeAt(0) ^ hex.charCodeAt(i)), 0) === 0;
}

type DirUser = {
  organization_id?: string;
  emails?: { primary?: boolean; value?: string }[];
  email?: string;
  first_name?: string;
  last_name?: string;
  state?: string;
};

export const directoryEvent = internalMutation({
  args: { event: v.string(), data: v.any() },
  returns: v.null(),
  handler: async (ctx, { event, data }) => {
    const d = data as DirUser & { organization_id?: string; state?: string };
    const org = d.organization_id;
    if (!org) return null;
    const owner = await ownerOf(ctx, org);
    if (!owner?.sso?.workos || !(await hasFeature(ctx, owner, "sso"))) return null;

    if (event === "connection.activated" || event === "connection.deactivated" || event === "connection.deleted") {
      await applyState(ctx, org, { connected: event === "connection.activated" });
      return null;
    }
    if (event === "dsync.activated" || event === "dsync.deleted") {
      await applyState(ctx, org, { directory: event === "dsync.activated" });
      return null;
    }
    if (!event.startsWith("dsync.user.")) return null;

    const email = (d.emails?.find((e) => e.primary)?.value ?? d.emails?.[0]?.value ?? d.email ?? "").trim().toLowerCase();
    if (!email || !email.endsWith(`@${owner.sso.domain}`)) return null;
    const leaving = event === "dsync.user.deleted" || d.state === "inactive" || d.state === "suspended";
    if (!leaving) {
      const name = [d.first_name, d.last_name].filter(Boolean).join(" ").trim() || null;
      await memberFor(ctx, owner, email, name, { directory: true });
      return null;
    }
    // Leaving the directory ends their access to the company at once.
    const rows = await ctx.db
      .query("teamMembers")
      .withIndex("by_email", (q) => q.eq("email", email))
      .collect();
    for (const r of rows.filter((r) => r.ownerId === owner._id)) {
      await ctx.db.delete(r._id);
      await audit(ctx, owner._id, null, `${email} left through the company directory`);
      await seatsChanged(ctx, { ownerId: owner._id, brand: r.companyId ?? "me" });
    }
    return null;
  },
});

/** POST /workos/webhook: WorkOS telling Formkit about connections and directory changes. */
export const webhook = httpAction(async (ctx, request) => {
  const secret = process.env.WORKOS_WEBHOOK_SECRET;
  if (!secret) return new Response("Not set up", { status: 404 });
  const body = await request.text();
  if (!(await workosSigned(request.headers.get("workos-signature") ?? "", body, secret))) {
    return new Response("Bad signature", { status: 400 });
  }
  const e = JSON.parse(body) as { event?: string; data?: unknown };
  if (e.event) await ctx.runMutation(internal.workos.directoryEvent, { event: e.event, data: e.data ?? {} });
  return new Response(null, { status: 200 });
});
