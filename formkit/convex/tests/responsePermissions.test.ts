import { describe, expect, test } from "vitest";
import { api } from "../_generated/api";
import { backend, form, member, person, response, share, type Backend } from "./fixtures.helpers";

/**
 * Changing a response (status, tags, note, delete) is an edit: owners,
 * Editors and company admins/editors may; Commenters, Viewers and company
 * viewers only read. Marking a new response as read is the one exception,
 * since opening it does that for anyone who can see it.
 */
async function setup(t: Backend) {
  const owner = await person(t, "owner@example.com");
  const formId = await form(t, owner.userId);
  const responseId = await response(t, formId, owner.userId);
  const people = {
    owner,
    editor: await person(t, "editor@example.com"),
    commenter: await person(t, "commenter@example.com"),
    viewer: await person(t, "viewer@example.com"),
    teamViewer: await person(t, "team-viewer@example.com"),
    teamEditor: await person(t, "team-editor@example.com"),
    stranger: await person(t, "stranger@example.com"),
  };
  await share(t, formId, people.editor, "editor");
  await share(t, formId, people.commenter, "commenter");
  await share(t, formId, people.viewer, "viewer");
  await member(t, owner.userId, people.teamViewer, "viewer");
  await member(t, owner.userId, people.teamEditor, "editor");
  return { formId, responseId, people };
}

const CAN = ["owner", "editor", "teamEditor"] as const;
const CANNOT = ["commenter", "viewer", "teamViewer", "stranger"] as const;

describe("response changes need edit rights", () => {
  for (const who of CAN) {
    test(`${who} may tag, note, review and delete`, async () => {
      const t = backend();
      const { responseId, people } = await setup(t);
      const as = people[who].as;
      await as.mutation(api.responses.setTags, { responseId, tags: ["lead"] });
      await as.mutation(api.responses.addNote, { responseId, note: "Call back" });
      await as.mutation(api.responses.setStatus, { ids: [responseId], status: "reviewed" });
      await as.mutation(api.responses.remove, { ids: [responseId] });
      expect(await t.run((ctx) => ctx.db.get(responseId))).toBeNull();
    });
  }

  for (const who of CANNOT) {
    test(`${who} may not change or delete`, async () => {
      const t = backend();
      const { responseId, people } = await setup(t);
      const as = people[who].as;
      await expect(as.mutation(api.responses.setTags, { responseId, tags: ["x"] })).rejects.toThrow();
      await expect(as.mutation(api.responses.addNote, { responseId, note: "x" })).rejects.toThrow();
      await expect(as.mutation(api.responses.setStatus, { ids: [responseId], status: "reviewed" })).rejects.toThrow();
      await expect(as.mutation(api.responses.remove, { ids: [responseId] })).rejects.toThrow();
      const r = await t.run((ctx) => ctx.db.get(responseId));
      expect(r).not.toBeNull();
      expect(r!.tags).toBeUndefined();
      expect(r!.note).toBeUndefined();
      expect(r!.status).toBe("new");
    });
  }

  test("a viewer opening a new response marks it read, but cannot mark it unread again", async () => {
    const t = backend();
    const { responseId, people } = await setup(t);
    await people.viewer.as.mutation(api.responses.setStatus, { ids: [responseId], status: "read" });
    expect((await t.run((ctx) => ctx.db.get(responseId)))!.status).toBe("read");
    await expect(
      people.viewer.as.mutation(api.responses.setStatus, { ids: [responseId], status: "new" }),
    ).rejects.toThrow();
  });

  test("canManage matches what the mutations allow", async () => {
    const t = backend();
    const { formId, people } = await setup(t);
    for (const who of CAN) expect(await people[who].as.query(api.responses.canManage, { formId })).toBe(true);
    for (const who of ["commenter", "viewer", "teamViewer"] as const) {
      expect(await people[who].as.query(api.responses.canManage, { formId })).toBe(false);
    }
  });
});
