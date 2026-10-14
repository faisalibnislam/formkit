import { afterEach, expect, test, vi } from "vitest";
import { api, internal } from "../_generated/api";
import { backend, form, person } from "./fixtures.helpers";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

async function setup() {
  const sent: { url: string; body: string; headers: Record<string, string> }[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      sent.push({ url: String(url), body: String(init?.body ?? ""), headers: (init?.headers ?? {}) as Record<string, string> });
      return new Response("ok", { status: 200 });
    }),
  );
  const t = backend();
  const owner = await person(t, "owner@example.com");
  await t.run((ctx) => ctx.db.patch(owner.userId, { plan: "pro", planStatus: "active" } as never));
  const formId = await form(t, owner.userId, { status: "draft", security: { spam: false, rateLimit: false, multiple: true } });
  const blockId = await owner.as.mutation(api.blocks.add, { formId, kind: "field", type: "short-text", title: "Your idea" });
  await owner.as.mutation(api.forms.publish, { formId });
  return { t, owner, formId, blockId, sent };
}

test("Discord and Teams get messages in their own shape, and only from their own hosts", async () => {
  const { t, owner, formId, blockId, sent } = await setup();
  await expect(owner.as.mutation(api.connections.add, { formId, kind: "discord", url: "https://example.com/hook" })).rejects.toThrow(/Discord/);
  const discord = await owner.as.mutation(api.connections.add, { formId, kind: "discord", url: "https://discord.com/api/webhooks/1/abc" });
  const teams = await owner.as.mutation(api.connections.add, { formId, kind: "teams", url: "https://prod-1.westus.logic.azure.com:443/workflows/x" });
  const { responseId } = await t.mutation(api.publicForm.submit, { formId, partial: false, answers: [{ blockId, value: "A *bold* plan" }] });
  for (const c of [discord.id, teams.id]) await t.action(internal.connections.deliver, { connectionId: c, responseId, attempt: 1 });
  const d = JSON.parse(sent.find((s) => s.url.includes("discord"))!.body);
  expect(d.content).toContain("**Your idea**");
  expect(d.allowed_mentions).toEqual({ parse: [] });
  const m = JSON.parse(sent.find((s) => s.url.includes("logic.azure"))!.body);
  expect(m.attachments[0].content.type).toBe("AdaptiveCard");
});

test("a webhook hears only the events it picked, deletions included", async () => {
  const { t, owner, formId, blockId } = await setup();
  const hook = await owner.as.mutation(api.connections.add, { formId, kind: "webhook", url: "https://example.com/hook" });
  await owner.as.mutation(api.connections.setEvents, { connectionId: hook.id, events: ["response.deleted"] });
  const { responseId } = await t.mutation(api.publicForm.submit, { formId, partial: false, answers: [{ blockId, value: "x" }] });
  const created = await t.query(internal.connections.payloadFor, { responseId });
  expect(created!.connections).toEqual([]);

  await owner.as.mutation(api.responses.remove, { ids: [responseId] });
  const queued = await t.run((ctx) => ctx.db.system.query("_scheduled_functions").collect());
  expect(queued.map((s) => s.name)).toContain("connections:deliverDeleted");
  await expect(owner.as.mutation(api.connections.setEvents, { connectionId: hook.id, events: [] })).rejects.toThrow(/at least one/);
});

test("a new secret signs from then on, and a delivery can be sent again", async () => {
  const { t, owner, formId, blockId, sent } = await setup();
  const hook = await owner.as.mutation(api.connections.add, { formId, kind: "webhook", url: "https://example.com/hook" });
  const { responseId } = await t.mutation(api.publicForm.submit, { formId, partial: false, answers: [{ blockId, value: "x" }] });
  await t.action(internal.connections.deliver, { connectionId: hook.id, responseId, attempt: 1 });
  const fresh = await owner.as.mutation(api.connections.rotateSecret, { connectionId: hook.id });
  expect(fresh).not.toBe(hook.secret);

  const rows = await owner.as.query(api.connections.forForm, { formId });
  const delivery = rows[0]!.recent[0]!;
  expect(delivery).toMatchObject({ event: "response.created", canReplay: true });
  vi.useFakeTimers();
  await owner.as.mutation(api.connections.replay, { deliveryId: delivery.id });
  await t.finishAllScheduledFunctions(vi.runAllTimers);
  expect(sent.filter((s) => s.url === "https://example.com/hook").length).toBeGreaterThanOrEqual(2);
});
