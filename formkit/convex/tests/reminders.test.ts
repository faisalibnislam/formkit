import { afterEach, expect, test, vi } from "vitest";
import { api, internal } from "../_generated/api";
import { backend, form, person } from "./fixtures.helpers";

afterEach(() => vi.useRealTimers());

test("someone who stopped partway gets one reminder, after the hours set, on Pro", async () => {
  vi.useFakeTimers();
  const t = backend();
  const owner = await person(t, "owner@example.com");
  await t.run((ctx) => ctx.db.patch(owner.userId, { plan: "pro", planStatus: "active" } as never));
  const formId = await form(t, owner.userId, { status: "draft", security: { spam: false, rateLimit: false, multiple: true } });
  const email = await owner.as.mutation(api.blocks.add, { formId, kind: "field", type: "email", title: "Email" });
  await owner.as.mutation(api.blocks.add, { formId, kind: "field", type: "long-text", title: "Tell us more", required: true } as never);
  await owner.as.mutation(api.forms.publish, { formId });
  await owner.as.mutation(api.forms.setReminder, { formId, hours: 6 });

  await t.mutation(api.publicForm.submit, { formId, partial: true, answers: [{ blockId: email, value: "sam@example.com" }] });
  expect(await t.mutation(internal.publicForm.remindPartials, {})).toBe(0);

  vi.setSystemTime(Date.now() + 7 * 3_600_000);
  expect(await t.mutation(internal.publicForm.remindPartials, {})).toBe(1);
  const queued = await t.run((ctx) => ctx.db.system.query("_scheduled_functions").collect());
  expect(queued.find((s) => s.name === "publicForm:mailResumeLink")?.args[0]).toMatchObject({ to: "sam@example.com", reminder: true });
  // Never a second one.
  expect(await t.mutation(internal.publicForm.remindPartials, {})).toBe(0);
});

test("reminders are Pro, and only the waits offered", async () => {
  const t = backend();
  const owner = await person(t, "owner@example.com");
  const formId = await form(t, owner.userId);
  await expect(owner.as.mutation(api.forms.setReminder, { formId, hours: 6 })).rejects.toThrow(/Pro/);
  await t.run((ctx) => ctx.db.patch(owner.userId, { plan: "pro", planStatus: "active" } as never));
  await expect(owner.as.mutation(api.forms.setReminder, { formId, hours: 5 })).rejects.toThrow(/waits offered/);
});
