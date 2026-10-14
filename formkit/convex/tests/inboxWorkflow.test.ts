import { expect, test } from "vitest";
import { api } from "../_generated/api";
import { backend, form, person, response, share } from "./fixtures.helpers";

test("a response is given to someone who can see the form; they are told, and can filter for theirs", async () => {
  const t = backend();
  const owner = await person(t, "owner@example.com");
  const editor = await person(t, "editor@example.com");
  const stranger = await person(t, "stranger@example.com");
  const formId = await form(t, owner.userId);
  await share(t, formId, editor, "editor");
  const one = await response(t, formId, owner.userId);
  await response(t, formId, owner.userId);

  await expect(owner.as.mutation(api.responses.assign, { responseId: one, userId: stranger.userId })).rejects.toThrow(/cannot see/);
  await owner.as.mutation(api.responses.assign, { responseId: one, userId: editor.userId });
  const told = await t.run((ctx) => ctx.db.query("inbox").collect());
  expect(told.find((n) => n.userId === editor.userId)).toMatchObject({ kind: "assigned", href: `/app/responses?open=${one}` });

  const theirs = await editor.as.query(api.responses.rows, { formId, kind: "all", order: "desc", limit: 25, assigned: "me" });
  expect(theirs.rows.map((r) => r._id)).toEqual([one]);
  expect(theirs.rows[0]!.assignee?.id).toBe(editor.userId);
  const nobodys = await owner.as.query(api.responses.rows, { formId, kind: "all", order: "desc", limit: 25, assigned: "nobody" });
  expect(nobodys.rows).toHaveLength(1);

  const people = await owner.as.query(api.responses.assignees, { formId });
  expect(people.map((p) => p.name)).toContain("Me");
  expect(people.some((p) => p.id === stranger.userId)).toBe(false);
});

test("saved views are a person's own, and saving a name again updates it", async () => {
  const t = backend();
  const a = await person(t, "a@example.com");
  const b = await person(t, "b@example.com");
  const id = await a.as.mutation(api.responses.saveView, { name: "Unread leads", filters: { status: "new", tag: "lead" } });
  expect(await a.as.mutation(api.responses.saveView, { name: "unread leads", filters: { status: "new" } })).toBe(id);
  expect(await a.as.query(api.responses.views, {})).toEqual([{ id, name: "Unread leads", filters: { status: "new" } }]);
  expect(await b.as.query(api.responses.views, {})).toEqual([]);
  await b.as.mutation(api.responses.removeView, { viewId: id });
  expect(await a.as.query(api.responses.views, {})).toHaveLength(1);
  await a.as.mutation(api.responses.removeView, { viewId: id });
  expect(await a.as.query(api.responses.views, {})).toHaveLength(0);
});
