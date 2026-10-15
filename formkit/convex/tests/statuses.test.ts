import { afterEach, expect, test, vi } from "vitest";
import { api } from "../_generated/api";
import { backend, form, person, response, share } from "./fixtures.helpers";

afterEach(() => vi.useRealTimers());

test("a company's own statuses: renamed, added, taken away with their responses moved over", async () => {
  vi.useFakeTimers();
  const t = backend();
  const owner = await person(t, "owner@example.com");
  const editor = await person(t, "editor@example.com");
  const formId = await form(t, owner.userId);
  await share(t, formId, editor, "editor");
  const reviewed = await response(t, formId, owner.userId, { status: "reviewed" });
  const fresh = await response(t, formId, owner.userId);

  // The original three, until the company changes them.
  expect((await owner.as.query(api.statuses.list, { formId })).statuses.map((s) => s.key)).toEqual(["new", "read", "reviewed"]);

  // Only owners and admins change them.
  await expect(editor.as.mutation(api.statuses.save, { formId, statuses: [{ key: "new", label: "New", tone: "info" }, { key: "read", label: "Read", tone: "neutral" }] })).rejects.toThrow(/owner and admins/);
  // New and Read stay.
  await expect(owner.as.mutation(api.statuses.save, { formId, statuses: [{ key: "new", label: "Inbox", tone: "info" }] })).rejects.toThrow(/New and Read/);

  await owner.as.mutation(api.statuses.save, {
    formId,
    statuses: [
      { key: "new", label: "Inbox", tone: "info" },
      { key: "read", label: "Seen", tone: "neutral" },
      { label: "Waiting on them", tone: "warning" },
      { label: "Done", tone: "success" },
    ],
    moves: [{ from: "reviewed", to: "done" }],
  });
  await t.finishAllScheduledFunctions(vi.runAllTimers);
  const list = (await owner.as.query(api.statuses.list, { formId })).statuses;
  expect(list.map((s) => [s.key, s.label])).toEqual([
    ["new", "Inbox"],
    ["read", "Seen"],
    ["waiting-on-them", "Waiting on them"],
    ["done", "Done"],
  ]);
  expect((await t.run((ctx) => ctx.db.get(reviewed)))!.status).toBe("done");

  // Editors set any of them, and nothing outside the list.
  await editor.as.mutation(api.responses.setStatus, { ids: [fresh], status: "waiting-on-them" });
  await expect(editor.as.mutation(api.responses.setStatus, { ids: [fresh], status: "reviewed" })).rejects.toThrow(/not one of/);
  const rows = await owner.as.query(api.responses.rows, { formId, kind: "all", order: "desc", limit: 25, status: "waiting-on-them" });
  expect(rows.rows.map((r) => [r._id, r.statusInfo])).toEqual([[fresh, { label: "Waiting on them", tone: "warning" }]]);
});
