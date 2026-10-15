import { afterEach, expect, test, vi } from "vitest";
import { api, internal } from "../_generated/api";
import { backend, form, person } from "./fixtures.helpers";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

test("Google Sheets: connect, make the sheet, add each response as a row and update it when it changes", async () => {
  vi.stubEnv("GOOGLE_INTEGRATION_CLIENT_ID", "cid");
  vi.stubEnv("GOOGLE_INTEGRATION_CLIENT_SECRET", "csecret");
  const calls: { url: string; method: string; body: string }[] = [];
  const idToken = `x.${btoa(JSON.stringify({ email: "owner@gmail.com" }))}.y`;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      const u = String(url);
      calls.push({ url: u, method: init?.method ?? "GET", body: String(init?.body ?? "") });
      const reply = (o: unknown) => new Response(JSON.stringify(o), { status: 200 });
      if (u.includes("oauth2.googleapis.com/token")) return reply({ access_token: "at1", refresh_token: "rt1", expires_in: 3600, id_token: idToken });
      if (u.endsWith("/v4/spreadsheets")) return reply({ spreadsheetId: "S1", spreadsheetUrl: "https://docs.google.com/spreadsheets/d/S1" });
      if (u.includes(":append")) return reply({ updates: { updatedRange: "Responses!A2:E2" } });
      return reply({});
    }),
  );
  const t = backend();
  const owner = await person(t, "owner@example.com");
  await t.run((ctx) => ctx.db.patch(owner.userId, { plan: "pro", planStatus: "active" } as never));
  const formId = await form(t, owner.userId, { status: "draft", security: { spam: false, rateLimit: false, multiple: true, editAfter: true } } as never);
  const email = await owner.as.mutation(api.blocks.add, { formId, kind: "field", type: "email", title: "Email" });
  const idea = await owner.as.mutation(api.blocks.add, { formId, kind: "field", type: "long-text", title: "Your idea" });
  await owner.as.mutation(api.forms.publish, { formId });

  expect((await owner.as.query(api.integrations.available, {})).providers.map((p) => p.id)).toEqual(["google"]);
  const go = new URL(await owner.as.mutation(api.integrations.begin, { provider: "google", returnTo: `/app/forms/${formId}` }));
  expect(go.searchParams.get("scope")).toContain("drive.file");
  expect(go.searchParams.get("code_challenge_method")).toBe("S256");

  const back = await t.fetch(`/integrations/callback?provider=google&code=c1&state=${go.searchParams.get("state")}`, { redirect: "manual" });
  expect(back.status).toBe(302);
  expect(back.headers.get("location")).toContain(`/app/forms/${formId}?connected=google`);
  // A state is used once.
  expect((await t.fetch(`/integrations/callback?provider=google&code=c1&state=${go.searchParams.get("state")}`, { redirect: "manual" })).headers.get("location")).toContain("expired");

  const [account] = (await owner.as.query(api.integrations.available, {})).accounts;
  expect(account).toMatchObject({ provider: "google", label: "owner@gmail.com" });
  const made = await owner.as.action(api.integrations.setup, { formId, accountId: account!.id });
  expect(made.url).toContain("S1");

  const sent = await t.mutation(api.publicForm.submit, { formId, partial: false, answers: [{ blockId: email, value: "sam@example.com" }, { blockId: idea, value: "A garden" }] });
  const conn = (await t.run((ctx) => ctx.db.query("connections").collect())).find((c) => c.kind === "gsheets")!;
  await t.action(internal.connections.deliver, { connectionId: conn._id, responseId: sent.responseId, attempt: 1 });
  const append = calls.find((c) => c.url.includes(":append"))!;
  expect(JSON.parse(append.body).values[0]).toEqual([expect.any(String), "", "sam@example.com", "sam@example.com", "A garden"]);
  expect(await t.query(internal.integrations.ref, { connectionId: conn._id, responseId: sent.responseId })).toBe("2");

  await t.action(internal.connections.deliver, { connectionId: conn._id, responseId: sent.responseId, event: "response.updated", attempt: 1 });
  expect(calls.some((c) => c.method === "PUT" && c.url.includes("Responses!A2?"))).toBe(true);
  const stored = await t.run((ctx) => ctx.db.query("integrationAccounts").collect());
  expect(stored).toHaveLength(1);
});

test("HubSpot: a response without an email is not sent, and says why", async () => {
  vi.stubEnv("HUBSPOT_CLIENT_ID", "cid");
  vi.stubEnv("HUBSPOT_CLIENT_SECRET", "csecret");
  vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 200 })));
  const t = backend();
  const owner = await person(t, "owner@example.com");
  await t.run((ctx) => ctx.db.patch(owner.userId, { plan: "pro", planStatus: "active" } as never));
  const formId = await form(t, owner.userId, { status: "draft", security: { spam: false, rateLimit: false, multiple: true } });
  const idea = await owner.as.mutation(api.blocks.add, { formId, kind: "field", type: "long-text", title: "Your idea" });
  await owner.as.mutation(api.forms.publish, { formId });
  const accountId = await t.mutation(internal.integrations.saveAccount, { ownerId: owner.userId, provider: "hubspot", label: "acme.hubspot.com", access: "tok" });
  await owner.as.action(api.integrations.setup, { formId, accountId });
  const sent = await t.mutation(api.publicForm.submit, { formId, partial: false, answers: [{ blockId: idea, value: "Hi" }] });
  const conn = (await t.run((ctx) => ctx.db.query("connections").collect()))[0]!;
  await t.action(internal.connections.deliver, { connectionId: conn._id, responseId: sent.responseId, attempt: 3 });
  const log = await t.run((ctx) => ctx.db.query("deliveries").collect());
  expect(log[0]).toMatchObject({ ok: false, detail: "No email address to match a contact to" });
});

test("HubSpot: the contact gets the answers as a note, and a changed response updates that note", async () => {
  vi.stubEnv("HUBSPOT_CLIENT_ID", "cid");
  vi.stubEnv("HUBSPOT_CLIENT_SECRET", "csecret");
  const calls: { url: string; method: string; body: string }[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      const u = String(url);
      calls.push({ url: u, method: init?.method ?? "GET", body: String(init?.body ?? "") });
      if (u.includes("batch/upsert")) return new Response(JSON.stringify({ results: [{ id: "C1" }] }), { status: 200 });
      if (u.endsWith("/crm/v3/objects/notes")) return new Response(JSON.stringify({ id: "N1" }), { status: 200 });
      return new Response("{}", { status: 200 });
    }),
  );
  const t = backend();
  const owner = await person(t, "owner@example.com");
  await t.run((ctx) => ctx.db.patch(owner.userId, { plan: "pro", planStatus: "active" } as never));
  const formId = await form(t, owner.userId, { status: "draft", security: { spam: false, rateLimit: false, multiple: true } });
  const email = await owner.as.mutation(api.blocks.add, { formId, kind: "field", type: "email", title: "Email" });
  const idea = await owner.as.mutation(api.blocks.add, { formId, kind: "field", type: "long-text", title: "Your <idea>" });
  await owner.as.mutation(api.forms.publish, { formId });
  const accountId = await t.mutation(internal.integrations.saveAccount, { ownerId: owner.userId, provider: "hubspot", label: "acme", access: "tok" });
  await owner.as.action(api.integrations.setup, { formId, accountId });
  const sent = await t.mutation(api.publicForm.submit, { formId, partial: false, answers: [{ blockId: email, value: "sam@example.com" }, { blockId: idea, value: "A & B" }] });
  const conn = (await t.run((ctx) => ctx.db.query("connections").collect()))[0]!;
  await t.action(internal.connections.deliver, { connectionId: conn._id, responseId: sent.responseId, attempt: 1 });
  const note = calls.find((c) => c.url.endsWith("/crm/v3/objects/notes"))!;
  expect(note.body).toContain("Your &lt;idea&gt;");
  expect(note.body).toContain("A &amp; B");
  expect(JSON.parse(note.body).associations[0].to.id).toBe("C1");
  expect(await t.query(internal.integrations.ref, { connectionId: conn._id, responseId: sent.responseId })).toBe("C1|N1");

  await t.action(internal.connections.deliver, { connectionId: conn._id, responseId: sent.responseId, event: "response.updated", attempt: 1 });
  expect(calls.some((c) => c.method === "PATCH" && c.url.endsWith("/notes/N1"))).toBe(true);
});

