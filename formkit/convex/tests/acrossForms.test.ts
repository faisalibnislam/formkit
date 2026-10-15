import { afterEach, expect, test, vi } from "vitest";
import { api } from "../_generated/api";
import { backend, form, person, response } from "./fixtures.helpers";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

test("one question across forms reads the AI's notes, not the answers, and only the company's forms", async () => {
  vi.stubEnv("GEMINI_API_KEY", "k");
  const sent: string[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: string, init?: RequestInit) => {
      sent.push(String(init?.body ?? ""));
      return new Response(
        JSON.stringify({
          candidates: [{ content: { parts: [{ text: JSON.stringify({ headline: "Parking comes up most", points: [{ title: "Parking", detail: "Half mention it." }], byForm: [{ form: "Spring fair", note: "Mostly happy." }, { form: "Not a form", note: "x" }] }) }] } }],
          usageMetadata: { promptTokenCount: 5, candidatesTokenCount: 5 },
        }),
        { status: 200 },
      );
    }),
  );
  const t = backend();
  const owner = await person(t, "owner@example.com");
  const other = await person(t, "other@example.com");
  await t.run((ctx) => ctx.db.patch(owner.userId, { plan: "pro", planStatus: "active" } as never));
  const a = await form(t, owner.userId, { title: "Spring fair" });
  const b = await form(t, owner.userId, { title: "Summer fair" });
  const theirs = await form(t, other.userId, { title: "Theirs" });
  for (const [f, summary] of [
    [a, "Could not find parking"],
    [a, "Loved the music"],
    [b, "Parking was a nightmare"],
  ] as const) {
    await response(t, f, owner.userId, { insight: { sentiment: "negative", topics: ["parking"], summary }, answers: [] });
  }
  const out = await owner.as.action(api.insights.across, { formIds: [a, b], question: "What do people complain about?" });
  expect(out).toMatchObject({ headline: "Parking comes up most", read: 3, byForm: [{ form: "Spring fair", note: "Mostly happy." }] });
  expect(sent[0]).toContain("Parking was a nightmare");

  await expect(owner.as.action(api.insights.across, { formIds: [theirs], question: "Anything?" })).rejects.toThrow();
});
