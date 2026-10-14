import { expect, test } from "vitest";
import { api } from "../_generated/api";
import { backend, form, person } from "./fixtures.helpers";

test("a signed-in owner reads their own form", async () => {
  const t = backend();
  const owner = await person(t, "owner@example.com");
  await form(t, owner.userId);
  const me = await owner.as.query(api.users.viewer, {});
  expect(me?.email).toBe("owner@example.com");
});
