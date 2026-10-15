import { expect, test } from "vitest";
import { api, internal } from "../_generated/api";
import { backend, form, person } from "./fixtures.helpers";

const off = (key: string) => ({ key, label: "x", description: "x", enabled: false, rollout: 100 });

test("turning a kill switch off stops that feature, and only that one", async () => {
  const t = backend();
  const owner = await person(t, "owner@example.com");
  await t.run((ctx) => ctx.db.patch(owner.userId, { plan: "pro", planStatus: "active" } as never));
  const formId = await form(t, owner.userId, { status: "draft", security: { spam: false, rateLimit: false, multiple: true } });
  const q = await owner.as.mutation(api.blocks.add, { formId, kind: "field", type: "long-text", title: "Tell us" });
  await owner.as.mutation(api.blocks.update, { blockId: q, patch: { followUp: { on: true } } });
  await owner.as.mutation(api.forms.publish, { formId });
  await owner.as.mutation(api.insights.setClassify, { formId, on: true });

  expect(await t.query(internal.aiLogic.followUpContext, { formId, blockId: q })).not.toBeNull();
  await t.run((ctx) => ctx.db.insert("featureFlags", off("ai.followUp")));
  expect(await t.query(internal.aiLogic.followUpContext, { formId, blockId: q })).toBeNull();

  await t.run((ctx) => ctx.db.insert("featureFlags", off("ai.classify")));
  await t.mutation(api.publicForm.submit, { formId, partial: false, answers: [{ blockId: q, value: "Something long enough to read" }] });
  const queued = await t.run((ctx) => ctx.db.system.query("_scheduled_functions").collect());
  expect(queued.map((s) => s.name)).not.toContain("insights:classify");
});
