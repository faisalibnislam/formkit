import { describe, expect, test } from "vitest";
import { api } from "../_generated/api";
import type { Doc } from "../_generated/dataModel";
import type { Rule } from "../model/logicEval";
import { validateAnswers } from "../model/validate";
import { backend, form, person } from "./fixtures.helpers";

let n = 0;
const block = (type: string, extra: Partial<Doc<"blocks">> = {}) =>
  ({ _id: `b${++n}`, _creationTime: 0, formId: "f", order: n, kind: "field", type, title: type, ...extra }) as unknown as Doc<"blocks">;
const codes = (p: { code: string }[]) => p.map((x) => x.code);

describe("validateAnswers", () => {
  test("formats, options and ranges", () => {
    const email = block("email");
    const choice = block("single-choice", { options: ["Red", "Blue"] });
    const multi = block("multi-choice", { options: ["A", "B"] });
    const rating = block("rating", { scaleMax: 5 });
    const scale = block("scale", { scaleMin: 0, scaleMax: 10 });
    const file = block("file", { accept: [".pdf"] });
    const p = validateAnswers({}, [email, choice, multi, rating, scale, file], [], [
      { blockId: email._id, value: "not-an-email" },
      { blockId: choice._id, value: "Green" },
      { blockId: multi._id, values: ["A", "Z"] },
      { blockId: rating._id, value: "6" },
      { blockId: scale._id, value: "11" },
      { blockId: file._id, fileId: "s1", fileName: "virus.exe" },
    ], { partial: false });
    expect(codes(p).sort()).toEqual(["email", "file-type", "option", "option", "range", "range"]);
  });

  test("good answers pass", () => {
    const email = block("email", { required: true });
    const choice = block("yes-no");
    const p = validateAnswers({}, [email, choice], [], [
      { blockId: email._id, value: "ada@example.com" },
      { blockId: choice._id, value: "Yes" },
    ], { partial: false });
    expect(p).toEqual([]);
  });

  test("required, and an answer to a question the form does not have", () => {
    const q = block("short-text", { required: true });
    const p = validateAnswers({}, [q], [], [{ blockId: "nope", value: "x" }], { partial: false });
    expect(codes(p).sort()).toEqual(["required", "unknown-question"]);
  });

  test("a partial is never short of required answers", () => {
    const q = block("short-text", { required: true });
    expect(validateAnswers({}, [q], [], [], { partial: true })).toEqual([]);
  });

  test("logic: hidden questions are not required, forced ones are", () => {
    const kind = block("single-choice", { options: ["Personal", "Business"] });
    const company = block("company", { required: true });
    const vat = block("short-text");
    const rules = [
      { _id: "r1", join: "and", action: "show", targetId: company._id, enabled: true, conditions: [{ blockId: kind._id, operator: "is", value: "Business" }] },
      { _id: "r2", join: "and", action: "require", targetId: vat._id, enabled: true, conditions: [{ blockId: kind._id, operator: "is", value: "Business" }] },
    ] as unknown as Rule[];
    expect(validateAnswers({}, [kind, company, vat], rules, [{ blockId: kind._id, value: "Personal" }], { partial: false })).toEqual([]);
    const p = validateAnswers({}, [kind, company, vat], rules, [{ blockId: kind._id, value: "Business" }], { partial: false });
    expect(codes(p)).toEqual(["required", "required"]);
  });

  test("questions an AI rule or a jump may have skipped get the benefit of the doubt", () => {
    const start = block("yes-no");
    const middle = block("short-text", { required: true });
    const end = block("short-text");
    const jump = [
      { _id: "j", join: "and", action: "jump", targetId: end._id, enabled: true, conditions: [{ blockId: start._id, operator: "is", value: "Yes" }] },
    ] as unknown as Rule[];
    expect(validateAnswers({}, [start, middle, end], jump, [{ blockId: start._id, value: "Yes" }], { partial: false })).toEqual([]);
    const ai = [
      { _id: "a", join: "and", action: "show", targetId: middle._id, enabled: true, conditions: [{ id: "c", source: "ai", blockId: start._id, value: "?" }] },
    ] as unknown as Rule[];
    expect(validateAnswers({}, [start, middle, end], ai, [{ blockId: start._id, value: "No" }], { partial: false })).toEqual([]);
  });

  test("an ending must be one of the form's", () => {
    expect(codes(validateAnswers({ endings: [] }, [], [], [], { partial: false, ending: "made-up" }))).toEqual(["ending"]);
  });
});

describe("submit", () => {
  async function setup() {
    const t = backend();
    const owner = await person(t, "owner@example.com");
    const formId = await form(t, owner.userId, { security: { spam: false, rateLimit: false, multiple: true } });
    const blockId = await t.run((ctx) =>
      ctx.db.insert("blocks", { formId, order: 0, kind: "field", type: "email", title: "Email", required: true } as never),
    );
    return { t, owner, formId, blockId };
  }

  test("log-only: a bad submission is stored and recorded for review", async () => {
    const { t, formId, blockId } = await setup();
    await t.mutation(api.publicForm.submit, { formId, partial: false, answers: [{ blockId, value: "nope" }] });
    const log = await t.run((ctx) => ctx.db.query("validationLog").collect());
    expect(log).toHaveLength(1);
    expect(log[0]!.problems[0]!.code).toBe("email");
    expect(await t.run((ctx) => ctx.db.query("responses").collect())).toHaveLength(1);
  });

  test("with forms.strictAnswers on, it is refused", async () => {
    const { t, formId, blockId } = await setup();
    await t.run((ctx) => ctx.db.insert("featureFlags", { key: "forms.strictAnswers", label: "x", description: "x", enabled: true, rollout: 100 }));
    await expect(
      t.mutation(api.publicForm.submit, { formId, partial: false, answers: [{ blockId, value: "nope" }] }),
    ).rejects.toThrow();
    expect(await t.run((ctx) => ctx.db.query("responses").collect())).toHaveLength(0);
    await t.mutation(api.publicForm.submit, { formId, partial: false, answers: [{ blockId, value: "ada@example.com" }] });
    expect(await t.run((ctx) => ctx.db.query("responses").collect())).toHaveLength(1);
  });
});

describe("answer rules and Other", () => {
  test("ranges, lengths, patterns, dates and picks", () => {
    const n = block("number", { validation: { min: 18, max: 99 } });
    const t = block("short-text", { validation: { minLength: 3, pattern: "[A-Z]{2}\\d{4}", patternMessage: "Use your order number." } });
    const d = block("date", { validation: { minDate: "2026-01-01" } });
    const m = block("multi-choice", { options: ["A", "B", "C"], validation: { maxPicks: 2 } });
    const p = validateAnswers({}, [n, t, d, m], [], [
      { blockId: n._id, value: "12" },
      { blockId: t._id, value: "AB12" },
      { blockId: d._id, value: "2025-12-31" },
      { blockId: m._id, values: ["A", "B", "C"] },
    ], { partial: false });
    expect(p.map((x) => x.message)).toEqual([
      "“number”: Use a number of at least 18.",
      "“short-text”: Use your order number.",
      "“date”: Pick a date on or before 2026-01-01.".replace("on or before", "on or after"),
      "“multi-choice”: Pick no more than 2.",
    ]);
  });

  test("an Other answer is allowed only where Other is on", () => {
    const off = block("single-choice", { options: ["Red"] });
    const on = block("single-choice", { options: ["Red"], allowOther: true });
    const multi = block("multi-choice", { options: ["A"], allowOther: true });
    expect(codes(validateAnswers({}, [off], [], [{ blockId: off._id, value: "Teal" }], { partial: false }))).toEqual(["option"]);
    expect(validateAnswers({}, [on, multi], [], [
      { blockId: on._id, value: "Teal" },
      { blockId: multi._id, values: ["A", "Something else"] },
    ], { partial: false })).toEqual([]);
  });
});
