import { expect, test } from "vitest";
import { api } from "../_generated/api";
import { backend, form, person, share } from "./fixtures.helpers";

test("a copied form keeps its logic, pointing at its own questions", async () => {
  const t = backend();
  const owner = await person(t, "owner@example.com");
  const formId = await form(t, owner.userId, { status: "draft", endings: [{ id: "e1", name: "VIP", title: "Hi", message: "m" }], calc: [{ name: "total", formula: "1" }] });
  const a = await owner.as.mutation(api.blocks.add, { formId, kind: "field", type: "yes-no", title: "Business?" });
  const b = await owner.as.mutation(api.blocks.add, { formId, kind: "field", type: "company", title: "Company" });
  await t.run((ctx) =>
    ctx.db.insert("logicRules", { formId, name: "r", order: 0, enabled: true, join: "and", action: "show", targetId: b, conditions: [{ blockId: a, operator: "is", value: "Yes" }] } as never),
  );
  const copy = await owner.as.mutation(api.forms.duplicate, { formId });
  const { blocks, rules, f } = await t.run(async (ctx) => ({
    blocks: await ctx.db.query("blocks").withIndex("by_form_order", (q) => q.eq("formId", copy)).collect(),
    rules: await ctx.db.query("logicRules").withIndex("by_form", (q) => q.eq("formId", copy)).collect(),
    f: await ctx.db.get(copy),
  }));
  const ids = new Set(blocks.map((x) => x._id as string));
  expect(rules).toHaveLength(1);
  expect(ids.has(rules[0]!.targetId!)).toBe(true);
  expect(ids.has(rules[0]!.conditions[0]!.blockId!)).toBe(true);
  expect(f).toMatchObject({ status: "draft", endings: [{ id: "e1" }], calc: [{ name: "total" }] });
});

test("a guest's copy is theirs; duplicating a question gives it a new key", async () => {
  const t = backend();
  const owner = await person(t, "owner@example.com");
  const guest = await person(t, "guest@example.com");
  const formId = await form(t, owner.userId, { status: "draft" });
  await share(t, formId, guest, "editor");
  const copy = await guest.as.mutation(api.forms.duplicate, { formId });
  expect(await t.run((ctx) => ctx.db.get(copy))).toMatchObject({ ownerId: guest.userId, brand: "me" });

  const q = await owner.as.mutation(api.blocks.add, { formId, kind: "field", type: "number", title: "Budget" });
  await owner.as.mutation(api.blocks.update, { blockId: q, patch: { key: "budget" } });
  const dup = await owner.as.mutation(api.blocks.duplicate, { blockId: q });
  expect((await t.run((ctx) => ctx.db.get(dup)))!.key).toBe("budget_2");
});
