const test = require("node:test");
const assert = require("node:assert");
const { flatten } = require("./lib");

test("a webhook delivery and an API row flatten to the same fields", () => {
  const answers = [
    { key: "budget", question: "What is your budget?", value: "5000" },
    { key: null, question: "What do you need?", value: ["Brand", "Web"] },
    { key: "cv", question: "Your CV", value: "cv.pdf", fileUrl: "https://files.example/cv" },
  ];
  const hook = flatten({
    event: "response.created",
    form: { id: "f1", title: "Onboarding" },
    response: { id: "r1", submittedAt: "2026-10-14T09:30:00.000Z", respondent: { name: "Sam", email: "sam@example.com" }, answers },
  });
  const row = flatten({ id: "r1", formId: "f1", submittedAt: "2026-10-14T09:30:00.000Z", respondent: { name: "Sam", email: "sam@example.com" }, answers });
  assert.deepStrictEqual({ ...hook, form_title: undefined }, row);
  assert.strictEqual(row.budget, "5000");
  assert.strictEqual(row["What do you need?"], "Brand, Web");
  assert.strictEqual(row.cv, "https://files.example/cv");
});
