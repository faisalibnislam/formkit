import { afterEach, expect, test, vi } from "vitest";
import { api } from "../_generated/api";
import { backend, form, person } from "./fixtures.helpers";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

/** A fake embedding: "refund"-ish text points one way, everything else another. */
function vectorFor(text: string) {
  const v = new Array(768).fill(0);
  if (/refund|money back|charge/i.test(text)) v[0] = 1;
  else v[1] = 1;
  return v;
}

test("responses are indexed without contact details, and found by meaning", async () => {
  vi.stubEnv("GEMINI_API_KEY", "k");
  const sent: string[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? "{}")) as { requests: { content: { parts: { text: string }[] } }[] };
      sent.push(JSON.stringify(body));
      return new Response(JSON.stringify({ embeddings: body.requests.map((r) => ({ values: vectorFor(r.content.parts[0]!.text) })) }), { status: 200 });
    }),
  );
  vi.useFakeTimers();
  const t = backend();
  const owner = await person(t, "owner@example.com");
  await t.run((ctx) => ctx.db.patch(owner.userId, { plan: "pro", planStatus: "active" } as never));
  const formId = await form(t, owner.userId, { status: "draft", security: { spam: false, rateLimit: false, multiple: true } });
  const email = await owner.as.mutation(api.blocks.add, { formId, kind: "field", type: "email", title: "Email" });
  const said = await owner.as.mutation(api.blocks.add, { formId, kind: "field", type: "long-text", title: "What happened?" });
  await owner.as.mutation(api.forms.publish, { formId });
  await expect(owner.as.action(api.semantic.search, { formId, query: "refunds" })).rejects.toThrow(/off for this form/);

  const one = await t.mutation(api.publicForm.submit, { formId, partial: false, answers: [{ blockId: email, value: "a@example.com" }, { blockId: said, value: "I want my money back" }] });
  await t.mutation(api.publicForm.submit, { formId, partial: false, answers: [{ blockId: email, value: "b@example.com" }, { blockId: said, value: "Lovely service" }] });
  await owner.as.mutation(api.semantic.setSemantic, { formId, on: true });
  await t.finishAllScheduledFunctions(vi.runAllTimers);

  expect(await t.run(async (ctx) => (await ctx.db.query("responseEmbeddings").collect()).length)).toBe(2);
  expect(sent.join("")).not.toContain("a@example.com");

  const found = await owner.as.action(api.semantic.search, { formId, query: "refunds" });
  expect(found.ids).toEqual([one.responseId]);

  await owner.as.mutation(api.semantic.setSemantic, { formId, on: false });
  expect(await t.run(async (ctx) => (await ctx.db.query("responseEmbeddings").collect()).length)).toBe(0);
});
