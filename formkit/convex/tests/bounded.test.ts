import { afterEach, expect, test, vi } from "vitest";
import { api } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { backend, form, person } from "./fixtures.helpers";

afterEach(() => {
  vi.useRealTimers();
});

async function placesForm() {
  const t = backend();
  const owner = await person(t, "owner@example.com");
  await t.run((ctx) => ctx.db.patch(owner.userId, { plan: "pro", planStatus: "active" } as never));
  const formId = await form(t, owner.userId, { status: "draft", security: { spam: false, rateLimit: false, multiple: true } });
  const blockId = await owner.as.mutation(api.blocks.add, { formId, kind: "field", type: "single-choice", title: "Which workshop?" });
  await owner.as.mutation(api.blocks.update, { blockId, patch: { options: ["Morning", "Evening"], limits: [2, 0] } });
  await owner.as.mutation(api.forms.publish, { formId });
  const send = (value: string) =>
    t.mutation(api.publicForm.submit, { formId, partial: false, answers: [{ blockId, value }], deviceId: crypto.randomUUID() } as never) as Promise<{
      responseId: Id<"responses">;
    }>;
  const counts = () => t.run(async (ctx) => (await ctx.db.query("placeCounts").collect()).map((r) => r.picks));
  return { t, owner, formId, blockId, send, counts };
}

test("limited places are counted as responses come, change and go", async () => {
  const { owner, send, counts } = await placesForm();
  const first = await send("Morning");
  expect(await counts()).toEqual([[{ option: "Morning", n: 1 }]]);
  await send("Morning");
  await expect(send("Morning")).rejects.toThrow(/filled up/);
  await send("Evening");
  expect((await counts())[0]).toEqual(
    expect.arrayContaining([
      { option: "Morning", n: 2 },
      { option: "Evening", n: 1 },
    ]),
  );
  // Deleting a response gives its place back.
  await owner.as.mutation(api.responses.remove, { ids: [first.responseId] });
  expect((await counts())[0]).toContainEqual({ option: "Morning", n: 1 });
  await send("Morning");
});

test("a form with more than one step of data is erased in steps, and disappears at once", async () => {
  vi.useFakeTimers();
  const t = backend();
  const owner = await person(t, "owner@example.com");
  const formId = await form(t, owner.userId);
  await t.run(async (ctx) => {
    for (let i = 0; i < 1300; i++) {
      await ctx.db.insert("responses", {
        formId,
        ownerId: owner.userId,
        submittedAt: i,
        partial: false,
        answeredCount: 0,
        totalCount: 0,
        answers: [],
        status: "new",
      } as never);
    }
    await ctx.db.patch(formId, { deletedAt: Date.now() } as never);
  });
  await owner.as.mutation(api.forms.purge, { formId } as never);
  expect(await t.run((ctx) => ctx.db.get(formId))).toBeNull();
  const left = await t.run(async (ctx) => (await ctx.db.query("responses").collect()).length);
  expect(left).toBe(300);
  await t.finishAllScheduledFunctions(vi.runAllTimers);
  expect(await t.run(async (ctx) => (await ctx.db.query("responses").collect()).length)).toBe(0);
});
