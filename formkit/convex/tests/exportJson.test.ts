import { expect, test } from "vitest";
import { api } from "../_generated/api";
import { backend, form, person, response } from "./fixtures.helpers";

test("the JSON export reads like the API: question ids and keys, payment in minor units", async () => {
  const t = backend();
  const owner = await person(t, "owner@example.com");
  const formId = await form(t, owner.userId, { slug: "intake" });
  const q = await owner.as.mutation(api.blocks.add, { formId, kind: "field", type: "short-text", title: "اسمك" });
  await owner.as.mutation(api.blocks.update, { blockId: q, patch: { key: "name" } });
  await response(t, formId, owner.userId, {
    answers: [{ blockId: q, question: "اسمك", value: "سارة" }],
    respondentName: "سارة",
    payment: { status: "paid", amount: 2500, currency: "usd", quantity: 2, at: Date.UTC(2026, 9, 1) },
  });

  const page = await owner.as.query(api.responses.jsonPage, { formId, cursor: null });
  expect(page).toMatchObject({ filename: "intake-responses", done: true });
  expect(page.rows[0]).toMatchObject({
    respondent: { name: "سارة" },
    answers: [{ questionId: q, key: "name", question: "اسمك", value: "سارة" }],
    payment: { status: "paid", amount: 2500, currency: "usd", quantity: 2, paidAt: "2026-10-01T00:00:00.000Z" },
  });

  const stranger = await person(t, "else@example.com");
  await expect(stranger.as.query(api.responses.jsonPage, { formId, cursor: null })).rejects.toThrow();
});
