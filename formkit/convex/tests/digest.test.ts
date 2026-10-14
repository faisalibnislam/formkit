import { afterEach, expect, test, vi } from "vitest";
import { api, internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { backend, form, person } from "./fixtures.helpers";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

const DAY = 86_400_000;

async function setup(plan: "free" | "pro") {
  const t = backend();
  const owner = await person(t, "owner@example.com");
  await t.run((ctx) => ctx.db.patch(owner.userId, { plan, planStatus: "active" } as never));
  const formId = await form(t, owner.userId, { status: "published", title: "Customer feedback" } as never);
  const blockId = await owner.as.mutation(api.blocks.add, { formId, kind: "field", type: "long-text", title: "Tell us" });
  const now = Date.now();
  await t.run(async (ctx) => {
    for (const summary of ["Shipping was slow", "Loves the new app", "Shipping took two weeks"]) {
      await ctx.db.insert("responses", {
        formId: formId as Id<"forms">,
        ownerId: owner.userId,
        answeredCount: 1,
        totalCount: 1,
        answers: [{ blockId, question: "Tell us", value: "Private words a person wrote" }],
        partial: false,
        submittedAt: now - DAY,
        status: "new",
        insight: { sentiment: "neutral", topics: [], summary },
      } as never);
    }
  });
  return { t, owner, now };
}

function stubServices() {
  const gemini: string[] = [];
  const mail: string[] = [];
  vi.stubEnv("GEMINI_API_KEY", "k");
  vi.stubEnv("AUTH_RESEND_KEY", "re_test");
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input instanceof Request ? input.url : input);
      if (url.includes("resend")) {
        mail.push(String(init?.body ?? ""));
        return new Response(JSON.stringify({ id: "mail" }), { status: 200, headers: { "content-type": "application/json" } });
      }
      gemini.push(String(init?.body ?? ""));
      return new Response(
        JSON.stringify({
          candidates: [
            { content: { parts: [{ text: JSON.stringify({ forms: [{ form: "Customer feedback", text: "Most people mentioned slow shipping." }] }) }] } },
          ],
          usageMetadata: { promptTokenCount: 5, candidatesTokenCount: 5 },
        }),
        { status: 200 },
      );
    }),
  );
  return { gemini, mail };
}

test("a Pro weekly report says what people said, from the AI's summaries only", async () => {
  const { gemini, mail } = stubServices();
  const { t, owner, now } = await setup("pro");
  await t.action(internal.digests.sendOne, { userId: owner.userId, kind: "weekly", date: "2026-10-12", now });
  expect(gemini).toHaveLength(1);
  expect(gemini[0]).toContain("Shipping was slow");
  expect(gemini[0]).not.toContain("Private words");
  expect(mail.join("")).toContain("What people said");
  expect(mail.join("")).toContain("Most people mentioned slow shipping.");
});

test("a Free weekly report goes without the AI note", async () => {
  const { gemini, mail } = stubServices();
  const { t, owner, now } = await setup("free");
  await t.action(internal.digests.sendOne, { userId: owner.userId, kind: "weekly", date: "2026-10-12", now });
  expect(gemini).toHaveLength(0);
  expect(mail).toHaveLength(1);
  expect(mail[0]).not.toContain("What people said");
});
