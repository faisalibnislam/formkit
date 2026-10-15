import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { api, internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { profileFor, workosSigned } from "../workos";
import { backend, person, type Backend } from "./fixtures.helpers";

const SECRET = "workos_webhook_secret_123";

beforeEach(() => {
  vi.stubEnv("WORKOS_API_KEY", "sk_test_workos");
  vi.stubEnv("WORKOS_CLIENT_ID", "client_123");
  vi.stubEnv("WORKOS_WEBHOOK_SECRET", SECRET);
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

/** A Business company that has proved it owns acme.com. */
async function company(t: Backend, workos?: { connected: boolean }) {
  const owner = await person(t, "owner@acme.com");
  await t.run((ctx) =>
    ctx.db.patch(owner.userId, {
      plan: "business",
      planStatus: "active",
      sso: {
        domain: "acme.com",
        token: "t",
        verified: true,
        enforce: false,
        providers: [],
        ...(workos ? { workos: { organizationId: "org_1", connected: workos.connected, directory: false, role: "viewer" as const } } : {}),
      },
    } as never),
  );
  return owner;
}

async function hook(t: Backend, event: string, data: unknown, secret = SECRET) {
  const body = JSON.stringify({ event, data });
  const ts = Date.now();
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${ts}.${body}`)));
  const sig = Array.from(mac, (b) => b.toString(16).padStart(2, "0")).join("");
  return t.fetch("/workos/webhook", { method: "POST", headers: { "WorkOS-Signature": `t=${ts}, v1=${sig}` }, body });
}

const members = (t: Backend, ownerId: Id<"users">) =>
  t.run((ctx) => ctx.db.query("teamMembers").withIndex("by_owner", (q) => q.eq("ownerId", ownerId)).collect());

test("setting up makes the WorkOS organization once, then hands out setup links", async () => {
  const t = backend();
  const owner = await company(t);
  const calls: { url: string; body: string }[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url, body: String(init?.body ?? "") });
      if (url.endsWith("/organizations")) return Response.json({ id: "org_9" });
      return Response.json({ link: "https://setup.workos.com/portal/x" });
    }),
  );
  expect(await owner.as.action(api.workos.portalLink, { intent: "sso" })).toBe("https://setup.workos.com/portal/x");
  expect(JSON.parse(calls[0]!.body)).toMatchObject({ domain_data: [{ domain: "acme.com", state: "verified" }] });
  await owner.as.action(api.workos.portalLink, { intent: "dsync" });
  expect(calls.filter((c) => c.url.endsWith("/organizations"))).toHaveLength(1);
  expect(JSON.parse(calls[2]!.body)).toEqual({ organization: "org_9", intent: "dsync" });
});

test("signing in with SAML: one-time state, a new member as the chosen role, and a session past two-factor", async () => {
  const t = backend();
  const owner = await company(t, { connected: true });
  await owner.as.mutation(api.workos.setRole, { role: "editor" });

  expect(await t.action(api.workos.begin, { email: "sam@other.com" })).toBeNull();
  const url = new URL((await t.action(api.workos.begin, { email: "Sam@acme.com" }))!);
  expect(url.origin + url.pathname).toBe("https://api.workos.com/sso/authorize");
  expect(url.searchParams.get("organization")).toBe("org_1");
  const state = url.searchParams.get("state")!;

  const started = await t.mutation(internal.workos.takeState, { state });
  expect(started).toMatchObject({ organizationId: "org_1", domain: "acme.com" });
  expect(await t.mutation(internal.workos.takeState, { state })).toBeNull();

  const first = await t.mutation(internal.workos.signInUser, { ownerId: owner.userId, email: "sam@acme.com", name: "Sam Lee" });
  const again = await t.mutation(internal.workos.signInUser, { ownerId: owner.userId, email: "sam@acme.com", name: "Sam Lee" });
  expect(again.userId).toBe(first.userId);
  expect(await members(t, owner.userId)).toMatchObject([{ email: "sam@acme.com", role: "editor", status: "active" }]);
  const info = await t.run((ctx) => ctx.db.query("sessionInfo").withIndex("by_session", (q) => q.eq("sessionId", first.sessionId)).first());
  expect(info?.twoFactorAt).toBeDefined();
});

test("WorkOS's code is traded for the person's profile", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: string, init?: RequestInit) => {
      expect(new URLSearchParams(String(init?.body)).get("client_secret")).toBe("sk_test_workos");
      return Response.json({ profile: { email: "Sam@Acme.com", first_name: "Sam", last_name: "Lee", organization_id: "org_1" } });
    }),
  );
  expect(await profileFor("code_1")).toEqual({ email: "sam@acme.com", name: "Sam Lee", organizationId: "org_1" });
});

test("the directory adds and removes members, and only signed events count", async () => {
  const t = backend();
  const owner = await company(t, { connected: true });
  const user = { organization_id: "org_1", emails: [{ primary: true, value: "pat@acme.com" }], first_name: "Pat", state: "active" };

  expect((await hook(t, "dsync.user.created", user, "wrong")).status).toBe(400);
  expect(await members(t, owner.userId)).toHaveLength(0);

  expect((await hook(t, "dsync.user.created", user)).status).toBe(200);
  expect(await members(t, owner.userId)).toMatchObject([{ email: "pat@acme.com", role: "viewer", directory: true }]);
  // Someone outside the company's domain is never added.
  await hook(t, "dsync.user.created", { ...user, emails: [{ primary: true, value: "pat@gmail.com" }] });
  expect(await members(t, owner.userId)).toHaveLength(1);

  await hook(t, "dsync.user.updated", { ...user, state: "inactive" });
  expect(await members(t, owner.userId)).toHaveLength(0);
});

test("a SAML connection switched off can no longer be required", async () => {
  const t = backend();
  const owner = await company(t, { connected: true });
  await t.run(async (ctx) => {
    const u = (await ctx.db.get(owner.userId))!;
    await ctx.db.patch(owner.userId, { samlAt: Date.now(), sso: { ...u.sso!, enforce: true, providers: ["saml"] } });
  });
  await hook(t, "connection.deactivated", { organization_id: "org_1" });
  const sso = (await t.run((ctx) => ctx.db.get(owner.userId)))!.sso!;
  expect(sso).toMatchObject({ enforce: false, providers: [], workos: { connected: false } });
});

test("a WorkOS signature must be fresh and match", async () => {
  const body = "{}";
  const ts = Date.now();
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = Array.from(new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${ts}.${body}`))), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
  expect(await workosSigned(`t=${ts}, v1=${sig}`, body, SECRET)).toBe(true);
  expect(await workosSigned(`t=${ts}, v1=${sig}`, body, SECRET, ts + 10 * 60_000)).toBe(false);
});
