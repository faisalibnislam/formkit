import { describe, expect, test, vi } from "vitest";
import { api } from "../_generated/api";
import { backend, form, person } from "./fixtures.helpers";

describe("save and finish later", () => {
  async function setup() {
    const t = backend();
    const owner = await person(t, "owner@example.com");
    const formId = await form(t, owner.userId, { status: "draft", security: { spam: false, rateLimit: false, multiple: true } });
    const q = await owner.as.mutation(api.blocks.add, { formId, kind: "field", type: "short-text", title: "Name" });
    await owner.as.mutation(api.forms.publish, { formId });
    return { t, formId, q };
  }

  test("a partial, then its link by email, then the finished response is the same record", async () => {
    vi.useFakeTimers();
    const { t, formId, q } = await setup();
    const part = await t.mutation(api.publicForm.submit, { formId, partial: true, answers: [{ blockId: q, value: "Ad" }] });
    await t.mutation(api.publicForm.emailResumeLink, { formId, resumeToken: part.resumeToken, email: "Ada@Example.com" });
    const scheduled = await t.run((ctx) => ctx.db.system.query("_scheduled_functions").collect());
    expect(scheduled.map((s) => s.name)).toContain("publicForm:mailResumeLink");
    // Asking again straight away is refused.
    await expect(
      t.mutation(api.publicForm.emailResumeLink, { formId, resumeToken: part.resumeToken, email: "ada@example.com" }),
    ).rejects.toThrow(/just sent/);
    const done = await t.mutation(api.publicForm.submit, {
      formId,
      partial: false,
      resumeToken: part.resumeToken,
      answers: [{ blockId: q, value: "Ada" }],
    });
    expect(done.responseId).toBe(part.responseId);
    const all = await t.run((ctx) => ctx.db.query("responses").collect());
    expect(all).toHaveLength(1);
    expect(all[0]).toMatchObject({ partial: false, respondentEmail: "ada@example.com" });
    vi.useRealTimers();
  });

  test("only for a partial the person holds the token for", async () => {
    const { t, formId } = await setup();
    await expect(
      t.mutation(api.publicForm.emailResumeLink, { formId, resumeToken: "made-up", email: "a@b.co" }),
    ).rejects.toThrow(/not saved/);
  });
});
