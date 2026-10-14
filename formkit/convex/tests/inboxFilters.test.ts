import { expect, test } from "vitest";
import { api } from "../_generated/api";
import { backend, form, person, response } from "./fixtures.helpers";

test("the inbox narrows by status, tag and time", async () => {
  const t = backend();
  const owner = await person(t, "owner@example.com");
  const formId = await form(t, owner.userId);
  const day = 86_400_000;
  const now = Date.now();
  await response(t, formId, owner.userId, { status: "new", tags: ["Lead"], submittedAt: now - 1000 });
  await response(t, formId, owner.userId, { status: "reviewed", tags: ["lead", "vip"], submittedAt: now - 2 * day });
  await response(t, formId, owner.userId, { status: "read", submittedAt: now - 40 * day });
  const rows = async (extra: Record<string, unknown>) =>
    (await owner.as.query(api.responses.rows, { formId, kind: "all", order: "desc", limit: 50, ...extra })).rows.length;
  expect(await rows({})).toBe(3);
  expect(await rows({ status: "new" })).toBe(1);
  expect(await rows({ tag: "LEAD" })).toBe(2);
  expect(await rows({ since: now - 7 * day })).toBe(2);
  expect(await rows({ tag: "lead", status: "reviewed", since: now - 7 * day })).toBe(1);
});
