import { expect, test } from "vitest";
import { api } from "../_generated/api";
import { backend, form, person, response, share } from "./fixtures.helpers";

test("the team comments on a response; mentions are told; comments go with the response", async () => {
  const t = backend();
  const owner = await person(t, "owner@example.com");
  const editor = await person(t, "editor@example.com");
  const formId = await form(t, owner.userId);
  await share(t, formId, editor, "editor");
  const responseId = await response(t, formId, owner.userId);

  await owner.as.mutation(api.comments.add, { formId, responseId, body: "@Editor can you call them?", mentions: [editor.userId] });
  const seen = await editor.as.query(api.comments.forResponse, { responseId });
  expect(seen!.comments).toHaveLength(1);
  expect(seen!.canComment).toBe(true);
  // Not mixed into the form's own comments.
  expect((await owner.as.query(api.comments.list, { formId })).threads).toHaveLength(0);

  const told = await t.run((ctx) => ctx.db.query("inbox").collect());
  expect(told.find((n) => n.userId === editor.userId)).toMatchObject({ kind: "mention", href: `/app/responses?open=${responseId}` });

  await owner.as.mutation(api.responses.remove, { ids: [responseId] });
  expect(await t.run((ctx) => ctx.db.query("comments").collect())).toHaveLength(0);
});

test("a comment cannot point at another form's response", async () => {
  const t = backend();
  const owner = await person(t, "owner@example.com");
  const a = await form(t, owner.userId);
  const b = await form(t, owner.userId);
  const other = await response(t, b, owner.userId);
  await expect(owner.as.mutation(api.comments.add, { formId: a, responseId: other, body: "hi" })).rejects.toThrow(/response is gone/);
});
