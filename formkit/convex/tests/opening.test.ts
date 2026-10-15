import { afterEach, expect, test, vi } from "vitest";
import { api, internal } from "../_generated/api";
import { backend, form, person } from "./fixtures.helpers";

afterEach(() => vi.useRealTimers());

test("a draft opens itself at its time, and its link says when until then", async () => {
  vi.useFakeTimers();
  const t = backend();
  const owner = await person(t, "owner@example.com");
  const formId = await form(t, owner.userId, { status: "draft" });
  await owner.as.mutation(api.blocks.add, { formId, kind: "field", type: "short-text", title: "Name" });
  const at = Date.now() + 60 * 60_000;
  await owner.as.mutation(api.forms.setOpening, { formId, opensAt: at });
  const slug = (await t.run((ctx) => ctx.db.get(formId)))!.slug;
  expect(await t.query(api.publicForm.bySlug, { slug })).toMatchObject({ state: "soon", opensAt: at });

  await t.mutation(internal.forms.sweepAllClosing, {});
  expect((await t.run((ctx) => ctx.db.get(formId)))!.status).toBe("draft");

  vi.setSystemTime(at + 1000);
  await t.mutation(internal.forms.sweepAllClosing, {});
  const after = (await t.run((ctx) => ctx.db.get(formId)))!;
  expect(after).toMatchObject({ status: "published", liveVersion: 1 });
  expect(after.opensAt).toBeUndefined();
});

test("a closing time closes a form through the index, and nothing else is touched", async () => {
  vi.useFakeTimers();
  const t = backend();
  const owner = await person(t, "owner@example.com");
  const closing = await form(t, owner.userId, { status: "published", closing: { closeAt: Date.now() + 1000 } } as never);
  const open = await form(t, owner.userId, { status: "published" });
  vi.setSystemTime(Date.now() + 5000);
  expect(await t.mutation(internal.forms.sweepAllClosing, {})).toBe(1);
  expect((await t.run((ctx) => ctx.db.get(closing)))!.status).toBe("closed");
  expect((await t.run((ctx) => ctx.db.get(open)))!.status).toBe("published");
});

test("an opening time must be ahead, and only for drafts and closed forms", async () => {
  const t = backend();
  const owner = await person(t, "owner@example.com");
  const live = await form(t, owner.userId, { status: "published" });
  await expect(owner.as.mutation(api.forms.setOpening, { formId: live, opensAt: Date.now() + 3_600_000 })).rejects.toThrow(/draft or a closed/);
  const draft = await form(t, owner.userId, { status: "draft" });
  await expect(owner.as.mutation(api.forms.setOpening, { formId: draft, opensAt: Date.now() })).rejects.toThrow(/minute from now/);
});
