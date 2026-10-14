import { afterEach, expect, test, vi } from "vitest";
import { api } from "../_generated/api";
import { backend, form, person } from "./fixtures.helpers";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

test("the AI asks one follow-up to a vague answer, once per answer, on Pro forms that turn it on", async () => {
  vi.stubEnv("GEMINI_API_KEY", "k");
  const calls = vi.fn(async () =>
    new Response(
      JSON.stringify({
        candidates: [{ content: { parts: [{ text: JSON.stringify({ ask: true, question: "What made it slow?" }) }] } }],
        usageMetadata: { promptTokenCount: 5, candidatesTokenCount: 5 },
      }),
      { status: 200 },
    ),
  );
  vi.stubGlobal("fetch", calls);
  const t = backend();
  const owner = await person(t, "owner@example.com");
  const formId = await form(t, owner.userId, { status: "draft" });
  const q = await owner.as.mutation(api.blocks.add, { formId, kind: "field", type: "long-text", title: "How was it?" });

  // Free: switching it on is refused.
  await expect(owner.as.mutation(api.blocks.update, { blockId: q, patch: { followUp: { on: true } } })).rejects.toThrow();

  await t.run((ctx) => ctx.db.patch(owner.userId, { plan: "pro", planStatus: "active" } as never));
  await owner.as.mutation(api.blocks.update, { blockId: q, patch: { followUp: { on: true, instruction: "speed" } } });
  await owner.as.mutation(api.forms.publish, { formId });

  expect(await t.action(api.aiLogic.followUp, { formId, blockId: q, answer: "it was slow" })).toBe("What made it slow?");
  expect(await t.action(api.aiLogic.followUp, { formId, blockId: q, answer: "it was slow" })).toBe("What made it slow?");
  expect(calls).toHaveBeenCalledTimes(1);

  // The follow-up and its answer are kept with the answer.
  const sent = await t.mutation(api.publicForm.submit, {
    formId,
    partial: false,
    answers: [{ blockId: q, value: "it was slow", followUp: { question: "What made it slow?", answer: "The checkout" } }],
  });
  const r = await t.run((ctx) => ctx.db.get(sent.responseId));
  expect(r!.answers[0]!.followUp).toEqual({ question: "What made it slow?", answer: "The checkout" });
});
