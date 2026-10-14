import { describe, expect, test, vi } from "vitest";
import { api } from "../_generated/api";
import { backend, form, person } from "./fixtures.helpers";

async function setup(extra: Record<string, unknown> = {}) {
  const t = backend();
  const owner = await person(t, "owner@example.com");
  const formId = await form(t, owner.userId, {
    status: "draft",
    security: { spam: false, rateLimit: false, multiple: true, editAfter: true },
    ...extra,
  });
  const q = await owner.as.mutation(api.blocks.add, { formId, kind: "field", type: "short-text", title: "Name" });
  await owner.as.mutation(api.forms.publish, { formId });
  return { t, owner, formId, q };
}

describe("a sent response stays sent", () => {
  test("leaving the page while changing it does not turn it back into a partial", async () => {
    const { t, formId, q } = await setup();
    const sent = await t.mutation(api.publicForm.submit, { formId, partial: false, answers: [{ blockId: q, value: "Ada" }] });
    await t.mutation(api.publicForm.submit, {
      formId,
      partial: true,
      resumeToken: sent.resumeToken,
      answers: [{ blockId: q, value: "Ad" }],
    });
    const r = await t.run((ctx) => ctx.db.get(sent.responseId));
    expect(r!.partial).toBe(false);
    expect(r!.answers[0]!.value).toBe("Ada");
    const f = await t.run((ctx) => ctx.db.get(formId));
    expect(f!.completedCount).toBe(1);
  });

  test("changing it tells integrations it was updated, and greets nobody again", async () => {
    vi.useFakeTimers();
    const { t, formId, q } = await setup();
    const sent = await t.mutation(api.publicForm.submit, { formId, partial: false, answers: [{ blockId: q, value: "Ada" }] });
    const before = (await t.run((ctx) => ctx.db.system.query("_scheduled_functions").collect())).length;
    await t.mutation(api.publicForm.submit, {
      formId,
      partial: false,
      resumeToken: sent.resumeToken,
      answers: [{ blockId: q, value: "Ada Lovelace" }],
    });
    const after = await t.run((ctx) => ctx.db.system.query("_scheduled_functions").collect());
    const added = after.slice(before);
    expect(added.map((s) => [s.name, (s.args[0] as { event?: string }).event])).toEqual([["connections:fanout", "response.updated"]]);
    vi.useRealTimers();
  });
});

test("a response limit counts finished responses, not half-answers", async () => {
  const { t, formId, q } = await setup({ closing: { closeAfter: 2 } });
  await t.mutation(api.publicForm.submit, { formId, partial: true, answers: [{ blockId: q, value: "a" }] });
  await t.mutation(api.publicForm.submit, { formId, partial: true, answers: [{ blockId: q, value: "b" }] });
  await t.mutation(api.publicForm.submit, { formId, partial: false, answers: [{ blockId: q, value: "c" }] });
  expect((await t.run((ctx) => ctx.db.get(formId)))!.status).toBe("published");
  await t.mutation(api.publicForm.submit, { formId, partial: false, answers: [{ blockId: q, value: "d" }] });
  expect((await t.run((ctx) => ctx.db.get(formId)))!.status).toBe("closed");
});
