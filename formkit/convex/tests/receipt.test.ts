import { expect, test } from "vitest";
import { api, internal } from "../_generated/api";
import { backend, form, person } from "./fixtures.helpers";

test("a sent response has a receipt the respondent can open, without hidden fields, linked from their confirmation", async () => {
  const t = backend();
  const owner = await person(t, "owner@example.com");
  await t.run((ctx) => ctx.db.patch(owner.userId, { plan: "pro", planStatus: "active" } as never));
  const formId = await form(t, owner.userId, {
    status: "draft",
    security: { spam: false, rateLimit: false, multiple: true, editAfter: true },
    notify: { confirm: true },
  } as never);
  const email = await owner.as.mutation(api.blocks.add, { formId, kind: "field", type: "email", title: "Email" });
  const idea = await owner.as.mutation(api.blocks.add, { formId, kind: "field", type: "long-text", title: "Your idea" });
  const source = await owner.as.mutation(api.blocks.add, { formId, kind: "field", type: "hidden", title: "Source", key: "src" } as never);
  await owner.as.mutation(api.forms.publish, { formId });

  const partial = await t.mutation(api.publicForm.submit, { formId, partial: true, answers: [{ blockId: idea, value: "half" }] });
  expect((await t.run((ctx) => ctx.db.get(partial.responseId)))!.receiptToken).toBeUndefined();

  const { responseId } = await t.mutation(api.publicForm.submit, {
    formId,
    partial: false,
    answers: [
      { blockId: email, value: "sam@example.com" },
      { blockId: idea, value: "A garden" },
      { blockId: source, value: "newsletter" },
    ],
  });
  const token = (await t.run((ctx) => ctx.db.get(responseId)))!.receiptToken!;
  const r = await t.query(api.publicForm.receipt, { token });
  expect(r!.answers).toEqual([
    { question: "Email", answer: "sam@example.com" },
    { question: "Your idea", answer: "A garden" },
  ]);
  expect(r!.reference).toHaveLength(8);
  expect(await t.query(api.publicForm.receipt, { token: "00000000-0000-0000-0000-000000000000" })).toBeNull();

  const job = await t.query(internal.notifications.forResponse, { responseId });
  expect(job!.confirmation!.receipt).toContain(`/receipt/${token}`);
  expect(job!.confirmation!.edit).toContain("/r/");
});
