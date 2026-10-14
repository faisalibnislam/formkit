import { afterEach, expect, test, vi } from "vitest";
import { api, internal } from "../_generated/api";
import { backend, form, person } from "./fixtures.helpers";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

test("a Pro form can read every response without writing replies", async () => {
  vi.useFakeTimers();
  vi.stubEnv("GEMINI_API_KEY", "k");
  const sent: string[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: string, init?: RequestInit) => {
      sent.push(String(init?.body ?? ""));
      return new Response(
        JSON.stringify({
          candidates: [{ content: { parts: [{ text: JSON.stringify({ sentiment: "negative", topics: ["Refund"], score: 80, urgency: "high", summary: "Wants money back", intent: "refund" }) }] } }],
          usageMetadata: { promptTokenCount: 5, candidatesTokenCount: 5 },
        }),
        { status: 200 },
      );
    }),
  );
  const t = backend();
  const owner = await person(t, "owner@example.com");
  await t.run((ctx) => ctx.db.patch(owner.userId, { plan: "pro", planStatus: "active" } as never));
  const formId = await form(t, owner.userId, { status: "draft", security: { spam: false, rateLimit: false, multiple: true } });
  const q = await owner.as.mutation(api.blocks.add, { formId, kind: "field", type: "long-text", title: "Tell us" });
  const mail = await owner.as.mutation(api.blocks.add, { formId, kind: "field", type: "email", title: "Email" });
  await owner.as.mutation(api.forms.publish, { formId });
  await owner.as.mutation(api.insights.setClassify, { formId, on: true });

  const { responseId } = await t.mutation(api.publicForm.submit, {
    formId,
    partial: false,
    answers: [{ blockId: q, value: "I want a refund" }, { blockId: mail, value: "secret@example.com" }],
  });
  const scheduled = await t.run((ctx) => ctx.db.system.query("_scheduled_functions").collect());
  expect(scheduled.map((s) => s.name)).toContain("insights:classify");

  await t.action(internal.insights.classify, { responseId });
  const r = await t.run((ctx) => ctx.db.get(responseId));
  expect(r!.insight).toMatchObject({ sentiment: "negative", urgency: "high", topics: ["refund"] });
  expect(r!.aiCharge).toBeTruthy();
  expect(sent.join("\n")).toContain("I want a refund");
  expect(sent.join("\n")).not.toContain("secret@example.com");
});
