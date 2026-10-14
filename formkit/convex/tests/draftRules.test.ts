import { expect, test } from "vitest";
import { checkRule, toDraft } from "../model/aiForms";

const fields = [
  { type: "single-choice", title: "Which plan?", options: ["Starter", "Team", "Enterprise"] },
  { type: "number", title: "How many seats?" },
  { type: "email", title: "Work email" },
  { type: "date", title: "Start date" },
  { type: "long-text", title: "Anything else?" },
];

test("a drafted rule can use any operator its question offers", () => {
  expect(checkRule({ when: 1, operator: "any-of", value: "team|ENTERPRISE|nope", action: "show", target: 5 }, fields)).toMatchObject({
    operator: "any-of",
    value: "Team|Enterprise",
  });
  expect(checkRule({ when: 2, operator: "between", value: "10", value2: "50", action: "require", target: 5 }, fields)).toMatchObject({
    value: "10",
    value2: "50",
  });
  expect(checkRule({ when: 3, operator: "email-domain", value: "acme.com", action: "hide", target: 5 }, fields)).toMatchObject({ value: "acme.com" });
  expect(checkRule({ when: 4, operator: "before", value: "2027-01-01", action: "show", target: 5 }, fields)).toMatchObject({ operator: "before" });
});

test("a drafted rule the question cannot take is dropped", () => {
  expect(checkRule({ when: 1, operator: "greater", value: "2", action: "show", target: 5 }, fields)).toBeNull();
  expect(checkRule({ when: 2, operator: "between", value: "10", action: "show", target: 5 }, fields)).toBeNull();
  expect(checkRule({ when: 4, operator: "before", value: "next week", action: "show", target: 5 }, fields)).toBeNull();
  expect(checkRule({ when: 3, operator: "matches", value: "([", action: "show", target: 5 }, fields)).toBeNull();
  expect(checkRule({ when: 5, operator: "is", value: "x", action: "show", target: 1 }, fields)).toBeNull();
});

test("a whole draft keeps its between rules", () => {
  const out = toDraft({
    title: "Quote",
    items: fields.map((f) => ({ kind: "field", ...f })),
    rules: [{ when: "How many seats?", operator: "between", value: "5", value2: "20", action: "show", target: "Anything else?" }],
  })!;
  expect(out.draft.rules[0]).toMatchObject({ when: 2, target: 5, value2: "20" });
});
