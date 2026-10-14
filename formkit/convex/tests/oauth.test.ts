import { expect, test } from "vitest";
import { api } from "../_generated/api";
import { backend, person } from "./fixtures.helpers";

async function challenge(verifier: string) {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier)));
  return btoa(String.fromCharCode(...digest)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

const form = (fields: Record<string, string>) => ({
  method: "POST",
  headers: { "Content-Type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams(fields).toString(),
});

test("an assistant registers, is allowed, swaps its code, uses and refreshes its token", async () => {
  const t = backend();
  const owner = await person(t, "owner@example.com");
  const redirect = "https://assistant.example/callback";

  const reg = await t.fetch("/oauth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ client_name: "Assistant", redirect_uris: [redirect], token_endpoint_auth_method: "none" }),
  });
  expect(reg.status).toBe(201);
  const { client_id } = (await reg.json()) as { client_id: string };

  const verifier = "v".repeat(20) + crypto.randomUUID().replace(/-/g, "");
  const shown = await owner.as.action(api.oauth.prepare, {
    clientId: client_id,
    redirectUri: redirect,
    responseType: "code",
    codeChallenge: await challenge(verifier),
    codeChallengeMethod: "S256",
    scope: "forms:read responses:read",
  });
  expect(shown.ok && shown.scopes.map((s) => s.scope)).toEqual(["forms:read", "responses:read"]);

  // Somewhere it never registered: refused, and never sent there.
  const elsewhere = await owner.as.action(api.oauth.prepare, {
    clientId: client_id,
    redirectUri: "https://evil.example/callback",
    responseType: "code",
    codeChallenge: await challenge(verifier),
    codeChallengeMethod: "S256",
  });
  expect(elsewhere).toMatchObject({ ok: false });
  expect("redirect" in elsewhere && elsewhere.redirect).toBeFalsy();

  // The person unticks reading responses.
  const code = await owner.as.mutation(api.oauth.approve, {
    clientId: client_id,
    redirectUri: redirect,
    codeChallenge: await challenge(verifier),
    scopes: ["forms:read"],
  });

  const wrong = await t.fetch("/oauth/token", form({ grant_type: "authorization_code", code, code_verifier: "x".repeat(50), client_id, redirect_uri: redirect }));
  expect(wrong.status).toBe(400);
  // The code was spent by that try.
  const again = await t.fetch("/oauth/token", form({ grant_type: "authorization_code", code, code_verifier: verifier, client_id, redirect_uri: redirect }));
  expect(again.status).toBe(400);

  const code2 = await owner.as.mutation(api.oauth.approve, {
    clientId: client_id,
    redirectUri: redirect,
    codeChallenge: await challenge(verifier),
    scopes: ["forms:read"],
  });
  const tok = await t.fetch("/oauth/token", form({ grant_type: "authorization_code", code: code2, code_verifier: verifier, client_id, redirect_uri: redirect }));
  expect(tok.status).toBe(200);
  const tokens = (await tok.json()) as { access_token: string; refresh_token: string; scope: string };
  expect(tokens.scope).toBe("forms:read");

  const forms = await t.fetch("/api/v2/forms", { headers: { Authorization: `Bearer ${tokens.access_token}` } });
  expect(forms.status).toBe(200);
  const responses = await t.fetch("/api/v2/forms/x/responses", { headers: { Authorization: `Bearer ${tokens.access_token}` } });
  expect(responses.status).toBe(403);

  const refreshed = await t.fetch("/oauth/token", form({ grant_type: "refresh_token", refresh_token: tokens.refresh_token, client_id }));
  expect(refreshed.status).toBe(200);
  const next = (await refreshed.json()) as { access_token: string; refresh_token: string };
  // The old pair stops working once replaced.
  expect((await t.fetch("/api/v2/forms", { headers: { Authorization: `Bearer ${tokens.access_token}` } })).status).toBe(401);
  expect((await t.fetch("/oauth/token", form({ grant_type: "refresh_token", refresh_token: tokens.refresh_token, client_id }))).status).toBe(400);

  const apps = await owner.as.query(api.oauth.connectedApps, {});
  expect(apps.map((a) => a.name)).toEqual(["Assistant"]);
  await owner.as.mutation(api.oauth.disconnect, { clientId: client_id });
  expect((await t.fetch("/api/v2/forms", { headers: { Authorization: `Bearer ${next.access_token}` } })).status).toBe(401);
});

test("registration takes public clients with safe redirects only", async () => {
  const t = backend();
  const post = (body: unknown) =>
    t.fetch("/oauth/register", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  expect((await post({ client_name: "X", redirect_uris: ["javascript:alert(1)"] })).status).toBe(400);
  expect((await post({ client_name: "X", redirect_uris: ["http://example.com/cb"] })).status).toBe(400);
  expect((await post({ client_name: "X", redirect_uris: ["https://ok.example/cb"], token_endpoint_auth_method: "client_secret_basic" })).status).toBe(400);
  expect((await post({ client_name: "Desktop", redirect_uris: ["http://127.0.0.1:3334/cb"] })).status).toBe(201);
});
