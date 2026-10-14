import { afterEach, describe, expect, test, vi } from "vitest";
import { api } from "../_generated/api";
import { backend, form, person } from "./fixtures.helpers";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

function cloudflareSays(success: boolean) {
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ success }), { status: 200 })));
}

async function setup() {
  const t = backend();
  const owner = await person(t, "owner@example.com");
  const formId = await form(t, owner.userId, { status: "draft", security: { spam: true, rateLimit: false, multiple: true } });
  const q = await owner.as.mutation(api.blocks.add, { formId, kind: "field", type: "short-text", title: "Name" });
  await owner.as.mutation(api.forms.publish, { formId });
  const send = (extra: Record<string, unknown> = {}) =>
    t.mutation(api.publicForm.submit, { formId, partial: false, durationMs: 60_000, answers: [{ blockId: q, value: "Ada" }], ...extra });
  return { t, formId, send };
}

describe("Turnstile", () => {
  test("not set up: forms send as before", async () => {
    const { send } = await setup();
    await expect(send()).resolves.toBeTruthy();
  });

  test("set up: a passed check sends, once", async () => {
    vi.stubEnv("TURNSTILE_SECRET_KEY", "secret");
    cloudflareSays(true);
    const { t, formId, send } = await setup();
    const pass = await t.action(api.publicForm.verifyHuman, { formId, token: "tok" });
    expect(pass).toBeTruthy();
    await expect(send({ pass })).resolves.toBeTruthy();
    // The same pass cannot send a second response.
    await expect(send({ pass })).rejects.toThrow(/Tick the box/);
  });

  test("set up: a failed check gives no pass, and the tick box still works", async () => {
    vi.stubEnv("TURNSTILE_SECRET_KEY", "secret");
    cloudflareSays(false);
    const { t, formId, send } = await setup();
    expect(await t.action(api.publicForm.verifyHuman, { formId, token: "bad" })).toBeNull();
    await expect(send()).rejects.toThrow(/Tick the box/);
    await expect(send({ human: true })).resolves.toBeTruthy();
  });
});
