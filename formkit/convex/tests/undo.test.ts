import { expect, test, vi } from "vitest";
import { api } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { HISTORY_LIMIT, MERGE_MS } from "../model/history";
import { backend, form, person, share, type Backend } from "./fixtures.helpers";

async function draft(t: Backend, formId: Id<"forms">) {
  return await t.run(async (ctx) => {
    const blocks = (await ctx.db.query("blocks").withIndex("by_form_order", (q) => q.eq("formId", formId)).collect()).sort((a, b) => a.order - b.order);
    const rules = await ctx.db.query("logicRules").withIndex("by_form", (q) => q.eq("formId", formId)).collect();
    return { titles: blocks.map((b) => b.title ?? b.pageName), ids: blocks.map((b) => b._id), rules: rules.length };
  });
}

test("undo and redo step through questions, options and rules", async () => {
  const t = backend();
  const owner = await person(t, "owner@example.com");
  const formId = await form(t, owner.userId, { status: "draft" });
  const q1 = await owner.as.mutation(api.blocks.add, { formId, kind: "field", type: "single-choice", title: "Plan", options: ["A", "B"] });
  const q2 = await owner.as.mutation(api.blocks.add, { formId, kind: "field", type: "short-text", title: "Notes" });
  await owner.as.mutation(api.logic.add, { formId, action: "show", targetId: q2, conditions: [{ blockId: q1, operator: "is", value: "A" }] });
  await owner.as.mutation(api.blocks.update, { blockId: q1, patch: { options: ["A", "B", "C"] } });

  expect((await owner.as.query(api.history.state, { formId })).undo).toMatchObject({ label: "Edit “Plan”", mine: true });
  await owner.as.mutation(api.history.undo, { formId });
  expect(await t.run(async (ctx) => (await ctx.db.get(q1))?.options)).toEqual(["A", "B"]);

  expect(await owner.as.mutation(api.history.undo, { formId })).toBe("Add a rule");
  expect((await draft(t, formId)).rules).toBe(0);

  // Redo brings the rule back, then the third option.
  await owner.as.mutation(api.history.redo, { formId });
  expect((await draft(t, formId)).rules).toBe(1);
  await owner.as.mutation(api.history.redo, { formId });
  expect(await t.run(async (ctx) => (await ctx.db.get(q1))?.options)).toEqual(["A", "B", "C"]);
  await expect(owner.as.mutation(api.history.redo, { formId })).rejects.toThrow(/nothing to redo/);
});

test("a deleted question comes back with its rules, and later steps still find it", async () => {
  const t = backend();
  const owner = await person(t, "owner@example.com");
  const formId = await form(t, owner.userId, { status: "draft" });
  const q1 = await owner.as.mutation(api.blocks.add, { formId, kind: "field", type: "short-text", title: "Name" });
  const q2 = await owner.as.mutation(api.blocks.add, { formId, kind: "field", type: "short-text", title: "Company" });
  await owner.as.mutation(api.logic.add, { formId, action: "require", targetId: q2, conditions: [{ blockId: q1, operator: "is-not-empty" }] });
  await owner.as.mutation(api.blocks.update, { blockId: q2, patch: { title: "Company name" } });
  await owner.as.mutation(api.blocks.remove, { blockId: q2 });
  expect(await draft(t, formId)).toMatchObject({ titles: ["Name"], rules: 0 });

  await owner.as.mutation(api.history.undo, { formId });
  const back = await draft(t, formId);
  expect(back).toMatchObject({ titles: ["Name", "Company name"], rules: 1 });
  const rule = await t.run(async (ctx) => ctx.db.query("logicRules").withIndex("by_form", (q) => q.eq("formId", formId)).first());
  expect(rule?.targetId).toBe(back.ids[1]);

  // One more step back undoes the rename on the question that came back.
  await owner.as.mutation(api.history.undo, { formId });
  expect(await draft(t, formId)).toMatchObject({ titles: ["Name", "Company"], ids: back.ids });
});

test("typing a title is one step, and a new change ends redo", async () => {
  vi.useFakeTimers();
  try {
    const t = backend();
    const owner = await person(t, "owner@example.com");
    const formId = await form(t, owner.userId, { status: "draft" });
    const q = await owner.as.mutation(api.blocks.add, { formId, kind: "field", type: "short-text", title: "N" });
    for (const title of ["Na", "Nam", "Name"]) {
      vi.advanceTimersByTime(500);
      await owner.as.mutation(api.blocks.update, { blockId: q, patch: { title } });
    }
    vi.advanceTimersByTime(MERGE_MS + 1);
    await owner.as.mutation(api.blocks.update, { blockId: q, patch: { title: "Name?" } });

    await owner.as.mutation(api.history.undo, { formId });
    expect((await draft(t, formId)).titles).toEqual(["Name"]);
    await owner.as.mutation(api.history.undo, { formId });
    expect((await draft(t, formId)).titles).toEqual(["N"]);

    await owner.as.mutation(api.blocks.update, { blockId: q, patch: { required: true } });
    expect((await owner.as.query(api.history.state, { formId })).redo).toBeNull();
  } finally {
    vi.useRealTimers();
  }
});

test("undo never throws away a collaborator's newer edit", async () => {
  const t = backend();
  const owner = await person(t, "owner@example.com");
  const editor = await person(t, "editor@example.com");
  const formId = await form(t, owner.userId, { status: "draft" });
  await share(t, formId, editor, "editor");
  await owner.as.mutation(api.blocks.add, { formId, kind: "field", type: "short-text", title: "Mine" });
  await editor.as.mutation(api.blocks.add, { formId, kind: "field", type: "short-text", title: "Theirs" });

  expect((await owner.as.query(api.history.state, { formId })).undo).toMatchObject({ mine: false });
  await expect(owner.as.mutation(api.history.undo, { formId })).rejects.toThrow(/Someone else changed/);
  expect((await draft(t, formId)).titles).toEqual(["Mine", "Theirs"]);
});

test("only the last steps are kept", async () => {
  const t = backend();
  const owner = await person(t, "owner@example.com");
  const formId = await form(t, owner.userId, { status: "draft" });
  for (let i = 0; i < HISTORY_LIMIT + 3; i++) {
    await owner.as.mutation(api.blocks.add, { formId, kind: "field", type: "short-text", title: `Q${i}` });
  }
  const rows = await t.run(async (ctx) => ctx.db.query("draftHistory").withIndex("by_form_kind_at", (q) => q.eq("formId", formId)).collect());
  expect(rows.length).toBe(HISTORY_LIMIT);
});
