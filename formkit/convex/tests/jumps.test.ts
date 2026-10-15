import { expect, test } from "vitest";
import { api } from "../_generated/api";
import { applyLogic, type Rule } from "../model/logicEval";
import { MAX_ROUNDS, homePage, nextPage } from "../model/jumps";
import { validateAnswers } from "../model/validate";
import { backend, form, person } from "./fixtures.helpers";

// Four pages: a page break opens each one after the first.
const pages = [
  { anchors: ["name", "plan"] },
  { anchors: ["break2", "seats"] },
  { anchors: ["break3", "check"] },
  { anchors: ["break4", "notes"] },
];
const rule = (id: string, blockId: string, value: string, targetId: string): Rule => ({
  _id: id,
  join: "and",
  conditions: [{ blockId, operator: "is", value }],
  action: "jump",
  targetId,
});
const matching = (rules: Rule[], answers: Record<string, string>) =>
  applyLogic(rules, { answers: Object.fromEntries(Object.entries(answers).map(([k, value]) => [k, { value }])) }).jumps;

test("a jump goes ahead to a question's page or to a page break", () => {
  const toNotes = rule("r1", "plan", "Starter", "notes");
  expect(nextPage(pages, 0, matching([toNotes], { plan: "Starter" }))).toEqual({ to: 3 });
  const toBreak = rule("r2", "plan", "Team", "break3");
  expect(nextPage(pages, 0, matching([toBreak], { plan: "Team" }))).toEqual({ to: 2 });
  expect(nextPage(pages, 0, matching([toBreak], { plan: "Starter" }))).toEqual({ to: 1 });
});

test("a jump back is taken from the page of the last question it reads", () => {
  const recheck = rule("r1", "check", "No", "break2");
  expect(homePage(pages, recheck)).toBe(2);
  const jumps = matching([recheck], { check: "No" });
  expect(nextPage(pages, 2, jumps)).toEqual({ to: 1, back: "r1" });
  // Back on page 2 with the same answer, it does not fire again: Next moves on.
  expect(nextPage(pages, 1, jumps)).toEqual({ to: 2 });
  // A forward jump already passed is never a reason to go back.
  const ahead = rule("r2", "plan", "Starter", "seats");
  expect(nextPage(pages, 2, matching([ahead], { plan: "Starter" }))).toEqual({ to: 3 });
});

test("a loop stops after a few rounds and the form moves on", () => {
  const jumps = matching([rule("r1", "check", "No", "break2")], { check: "No" });
  const rounds: Record<string, number> = {};
  let at = 2;
  let backs = 0;
  for (let i = 0; i < 50 && at < pages.length; i++) {
    const move = nextPage(pages, at, jumps, rounds);
    if (move.back) {
      rounds[move.back] = (rounds[move.back] ?? 0) + 1;
      backs++;
    }
    at = move.to;
  }
  expect(backs).toBe(MAX_ROUNDS);
  expect(at).toBe(pages.length);
});

test("a rule that reads only results never jumps back", () => {
  const calcOnly: Rule = { _id: "r1", join: "and", conditions: [{ source: "calc", ref: "score", operator: "less", value: "5" }], action: "jump", targetId: "name" };
  expect(nextPage(pages, 2, [calcOnly])).toEqual({ to: 3 });
});

test("only a jump may land on a page break", async () => {
  const t = backend();
  const owner = await person(t, "owner@example.com");
  const formId = await form(t, owner.userId, { status: "draft" });
  const q = await owner.as.mutation(api.blocks.add, { formId, kind: "field", type: "short-text", title: "Name" });
  const brk = await owner.as.mutation(api.blocks.add, { formId, kind: "pagebreak" });
  const cond = [{ blockId: q, operator: "is", value: "x" }];
  const id = await owner.as.mutation(api.logic.add, { formId, action: "jump", targetId: brk, conditions: cond });
  await expect(owner.as.mutation(api.logic.add, { formId, action: "show", targetId: brk, conditions: cond })).rejects.toThrow(/Only a jump/);
  await expect(owner.as.mutation(api.logic.update, { ruleId: id, patch: { action: "hide" } })).rejects.toThrow(/Only a jump/);

  const other = await form(t, owner.userId, { status: "draft" });
  const elsewhere = await owner.as.mutation(api.blocks.add, { formId: other, kind: "field", type: "short-text", title: "Elsewhere" });
  await expect(owner.as.mutation(api.logic.add, { formId, action: "jump", targetId: elsewhere, conditions: cond })).rejects.toThrow(/isn't on this form/);
});

test("a jump to an ending finishes from the page of its question, and later questions are not required", async () => {
  const done: Rule = { _id: "r9", join: "and", conditions: [{ blockId: "plan", operator: "is", value: "Just looking" }], action: "jump", endingId: "default" };
  const jumps = matching([done], { plan: "Just looking" });
  expect(nextPage(pages, 0, jumps)).toEqual({ to: pages.length, finish: "default" });

  const t = backend();
  const owner = await person(t, "owner@example.com");
  const formId = await form(t, owner.userId, { status: "draft" });
  const plan = await owner.as.mutation(api.blocks.add, { formId, kind: "field", type: "short-text", title: "Plan", required: true });
  await owner.as.mutation(api.blocks.add, { formId, kind: "pagebreak" });
  const seats = await owner.as.mutation(api.blocks.add, { formId, kind: "field", type: "number", title: "Seats", required: true });
  const ruleId = await owner.as.mutation(api.logic.add, { formId, action: "jump", endingId: "default", conditions: [{ blockId: plan, operator: "is", value: "Just looking" }] });
  // A jump to the usual thank-you screen is on every plan; switching a page target back clears the ending.
  await owner.as.mutation(api.logic.update, { ruleId, patch: { targetId: seats, endingId: null } });
  await owner.as.mutation(api.logic.update, { ruleId, patch: { targetId: null, endingId: "default" } });

  const problems = await t.run(async (ctx) => {
    const blocks = await ctx.db.query("blocks").withIndex("by_form_order", (q) => q.eq("formId", formId)).collect();
    const rules = await ctx.db.query("logicRules").withIndex("by_form", (q) => q.eq("formId", formId)).collect();
    expect(rules[0]).toMatchObject({ endingId: "default" });
    expect(rules[0]!.targetId).toBeUndefined();
    return validateAnswers({ endings: [] }, blocks, rules, [{ blockId: plan, value: "Just looking" }], { partial: false });
  });
  expect(problems).toEqual([]);
});
