import { expect, test } from "vitest";
import { api } from "../_generated/api";
import { backend, form, person } from "./fixtures.helpers";

test("Zapier subscribes a URL to a Pro form's new responses, and unsubscribes it", async () => {
  const t = backend();
  const owner = await person(t, "owner@example.com");
  const key = await owner.as.mutation(api.controls.createApiKey, { name: "Zapier", scopes: ["forms:read", "responses:read"] });
  const formId = await form(t, owner.userId);
  const call = async (method: string, path: string, body?: unknown) => {
    const res = await t.fetch(`/api/v2/${path}`, {
      method,
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: res.status, body: (await res.json()) as Record<string, unknown> };
  };

  expect((await call("GET", "me")).body).toMatchObject({ email: "owner@example.com" });
  const free = await call("POST", "hooks", { formId, url: "https://hooks.zapier.com/x" });
  expect(free.status).toBe(403);

  await t.run((ctx) => ctx.db.patch(owner.userId, { plan: "pro", planStatus: "active" } as never));
  expect((await call("POST", "hooks", { formId, url: "http://localhost/x" })).status).toBe(422);
  const made = await call("POST", "hooks", { formId, url: "https://hooks.zapier.com/x" });
  expect(made.status).toBe(201);
  const hook = await t.run((ctx) => ctx.db.get(made.body.id as never));
  expect(hook).toMatchObject({ kind: "webhook", viaApi: true, events: ["response.created"], label: "Zapier" });

  // A connection made in Formkit itself cannot be removed through the API.
  const own = await owner.as.mutation(api.connections.add, { formId, kind: "webhook", url: "https://example.com/hook" });
  expect((await call("DELETE", `hooks/${own.id}`)).status).toBe(404);
  expect((await call("DELETE", `hooks/${made.body.id}`)).status).toBe(200);
  expect(await t.run((ctx) => ctx.db.get(made.body.id as never))).toBeNull();
});
