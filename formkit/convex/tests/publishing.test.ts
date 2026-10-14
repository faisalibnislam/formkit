import { describe, expect, test } from "vitest";
import { api, internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { backend, form, person } from "./fixtures.helpers";

/**
 * Respondents get the published version; the builder edits a draft. Edits
 * reach respondents only when the form is published again.
 */
type Served = { blocks: { _id: string; title?: string }[]; title: string } | null;
const titles = (p: unknown) => ((p as Served)?.blocks ?? []).map((b) => b.title);

async function setup() {
  const t = backend();
  const owner = await person(t, "owner@example.com");
  const formId = await form(t, owner.userId, { status: "draft", title: "Sign-up", slug: "sign-up" });
  const q1 = await owner.as.mutation(api.blocks.add, { formId, kind: "field", type: "short-text", title: "Your name" });
  await owner.as.mutation(api.forms.publish, { formId });
  return { t, owner, formId, q1 };
}
const live = (t: ReturnType<typeof backend>) => t.query(api.publicForm.bySlug, { slug: "sign-up" });

describe("publishing freezes what respondents see", () => {
  test("an edit after publishing waits for Publish", async () => {
    const { t, owner, formId, q1 } = await setup();
    expect(titles(await live(t))).toEqual(["Your name"]);

    await owner.as.mutation(api.blocks.update, { blockId: q1, patch: { title: "Full name" } });
    await owner.as.mutation(api.blocks.add, { formId, kind: "field", type: "email", title: "Email" });
    await owner.as.mutation(api.forms.update, { formId, patch: { title: "Sign-up 2" } } as never).catch(() => undefined);

    // The public form is unchanged; the preview shows the draft.
    expect(titles(await live(t))).toEqual(["Your name"]);
    expect(titles(await owner.as.query(api.publicForm.preview, { formId }))).toEqual(["Full name", "Email"]);
    expect(await owner.as.query(api.forms.unpublishedChanges, { formId })).toBeGreaterThanOrEqual(2);

    await owner.as.mutation(api.forms.publish, { formId });
    expect(titles(await live(t))).toEqual(["Full name", "Email"]);
    expect(await owner.as.query(api.forms.unpublishedChanges, { formId })).toBe(0);
  });

  test("a submission is checked and stored against the published questions", async () => {
    const { t, owner, formId, q1 } = await setup();
    await owner.as.mutation(api.blocks.update, { blockId: q1, patch: { title: "Changed in the draft" } });
    await t.mutation(api.publicForm.submit, { formId, partial: false, answers: [{ blockId: q1, value: "Ada" }] });
    const [r] = await t.run((ctx) => ctx.db.query("responses").collect());
    expect(r!.answers[0]!.question).toBe("Your name");
  });

  test("restoring an old version keeps question ids and does not publish", async () => {
    const { t, owner, formId, q1 } = await setup();
    await owner.as.mutation(api.blocks.update, { blockId: q1, patch: { title: "Second title" } });
    await owner.as.mutation(api.forms.publish, { formId });
    const versions = await owner.as.query(api.forms.versions, { formId });
    const first = versions.find((v) => v.number === 1)!;
    await owner.as.mutation(api.forms.restoreVersion, { versionId: first._id as Id<"versions"> });

    const draft = await t.run((ctx) => ctx.db.query("blocks").collect());
    expect(draft.map((b) => [b._id, b.title])).toEqual([[q1, "Your name"]]);
    // Still serving version 2 until published.
    expect(titles(await live(t))).toEqual(["Second title"]);
  });

  test("restoring brings back a deleted question with its rules", async () => {
    const { t, owner, formId, q1 } = await setup();
    const q2 = await owner.as.mutation(api.blocks.add, { formId, kind: "field", type: "short-text", title: "Company" });
    await t.run((ctx) =>
      ctx.db.insert("logicRules", {
        formId,
        name: "Show company",
        order: 0,
        enabled: true,
        join: "and",
        action: "show",
        targetId: q2,
        conditions: [{ blockId: q1, operator: "is-not-empty" }],
      } as never),
    );
    await owner.as.mutation(api.forms.publish, { formId });
    const v2 = (await owner.as.query(api.forms.versions, { formId })).find((v) => v.number === 2)!;
    await owner.as.mutation(api.blocks.remove, { blockId: q2 });
    await owner.as.mutation(api.forms.restoreVersion, { versionId: v2._id as Id<"versions"> });

    const blocks = await t.run((ctx) => ctx.db.query("blocks").collect());
    const company = blocks.find((b) => b.title === "Company")!;
    const rules = await t.run((ctx) => ctx.db.query("logicRules").collect());
    expect(rules).toHaveLength(1);
    expect(rules[0]!.targetId).toBe(company._id);
  });

  test("forms published before snapshots keep showing what they show, then freeze", async () => {
    const t = backend();
    const owner = await person(t, "owner@example.com");
    // An old-style form: live, with a blocks-only version.
    const formId = await form(t, owner.userId, { status: "published", slug: "old", liveVersion: 1 });
    const q = await t.run(async (ctx) => {
      const q = await ctx.db.insert("blocks", { formId, order: 0, kind: "field", type: "short-text", title: "Old live" } as never);
      await ctx.db.insert("versions", { formId, number: 1, label: "First published", blocks: [], publishedAt: 0 });
      return q;
    });
    expect(titles(await t.query(api.publicForm.bySlug, { slug: "old" }))).toEqual(["Old live"]);
    await t.mutation(internal.forms.snapshotLiveForms, {});
    expect(titles(await t.query(api.publicForm.bySlug, { slug: "old" }))).toEqual(["Old live"]);
    await owner.as.mutation(api.blocks.update, { blockId: q, patch: { title: "Edited later" } });
    expect(titles(await t.query(api.publicForm.bySlug, { slug: "old" }))).toEqual(["Old live"]);
  });
});
