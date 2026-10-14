import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { backend, form, person, response, type Backend } from "./fixtures.helpers";

/**
 * The AI that runs by itself on responses (AI replies, AI logic) obeys the
 * same switches as Ask Formkit: a platform pause or an account turned off
 * means no model call. And a reply the AI flags for a person is held back.
 */

const geminiCalls = () =>
  (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls.filter(([url]) => String(url).includes("generativelanguage"));

function modelSays(json: unknown) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      if (String(url).includes("generativelanguage")) {
        return new Response(
          JSON.stringify({
            candidates: [{ content: { parts: [{ text: JSON.stringify(json) }] } }],
            usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 10 },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }
      return new Response("{}", { status: 200 });
    }),
  );
}

beforeEach(() => {
  vi.stubEnv("GEMINI_API_KEY", "test-key");
  vi.stubEnv("AUTH_RESEND_KEY", "");
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

async function withReply(t: Backend, delivery: "form" | "email") {
  const owner = await person(t, "owner@example.com");
  const formId = await form(t, owner.userId, {
    aiReply: { enabled: true, prompt: "Thank them warmly.", delivery, style: "plain" },
  });
  const responseId = await response(t, formId, owner.userId, {
    respondentEmail: "ada@example.com",
    respondentName: "Ada",
    answers: [],
    aiReply: { status: "pending", at: Date.now() },
  });
  return { owner, formId, responseId };
}

const reply = (t: Backend, id: Id<"responses">) => t.run(async (ctx) => (await ctx.db.get(id))!.aiReply);

describe("AI kill switches cover automatic AI", () => {
  test("a platform pause stops an AI reply before any model call", async () => {
    const t = backend();
    modelSays({ subject: "Hi", reply: "Thanks", needs_human: false, insight: {} });
    const { responseId } = await withReply(t, "form");
    await t.run((ctx) => ctx.db.insert("platform", { key: "aiPaused", value: true }));
    await t.action(internal.aiReply.generate, { responseId });
    expect((await reply(t, responseId))?.status).toBe("failed");
    expect(geminiCalls()).toHaveLength(0);
  });

  test("an account with AI turned off gets no AI reply", async () => {
    const t = backend();
    modelSays({ subject: "Hi", reply: "Thanks", needs_human: false, insight: {} });
    const { owner, responseId } = await withReply(t, "form");
    await t.run((ctx) => ctx.db.insert("aiAccess", { userId: owner.userId, enabled: false, changedAt: Date.now() }));
    await t.action(internal.aiReply.generate, { responseId });
    expect((await reply(t, responseId))?.status).toBe("failed");
    expect(geminiCalls()).toHaveLength(0);
  });

  test("AI logic has nothing to check while AI is paused", async () => {
    const t = backend();
    const owner = await person(t, "owner@example.com");
    const formId = await form(t, owner.userId);
    await t.run((ctx) => ctx.db.insert("platform", { key: "aiPaused", value: true }));
    expect(await t.query(internal.aiLogic.thinkContext, { formId })).toBeNull();
  });
});

describe("replies the AI flags for a person are held", () => {
  test("not emailed, not shown, and the owner is told", async () => {
    const t = backend();
    modelSays({
      subject: "About your refund",
      reply: "We will refund you in full.",
      needs_human: true,
      insight: { sentiment: "negative", topics: ["refund"], score: 20, urgency: "high", summary: "Wants a refund" },
    });
    const { owner, responseId } = await withReply(t, "email");
    await t.action(internal.aiReply.generate, { responseId });
    const r = await reply(t, responseId);
    expect(r).toMatchObject({ status: "ready", held: true, needsHuman: true, emailState: "held" });
    expect(r?.emailedAt).toBeUndefined();
    const notices = await t.run((ctx) =>
      ctx.db.query("inbox").filter((q) => q.eq(q.field("userId"), owner.userId)).collect(),
    );
    expect(notices.some((n) => String((n as { title?: string }).title).includes("AI reply is waiting"))).toBe(true);
  });

  test("an ordinary reply is not held", async () => {
    const t = backend();
    modelSays({ subject: "Thanks", reply: "Thanks for writing in.", needs_human: false, insight: { sentiment: "positive", topics: [], score: 50, urgency: "low", summary: "Happy" } });
    const { responseId } = await withReply(t, "form");
    await t.action(internal.aiReply.generate, { responseId });
    const r = await reply(t, responseId);
    expect(r?.status).toBe("ready");
    expect(r?.held).toBeUndefined();
  });
});

test("an AI reply never sends the respondent's email, phone or address to the model", async () => {
  const t = backend();
  modelSays({ subject: "Thanks", reply: "Thanks!", needs_human: false, insight: { sentiment: "positive", topics: [], score: 50, urgency: "low", summary: "ok" } });
  const owner = await person(t, "owner@example.com");
  const formId = await form(t, owner.userId, {
    aiReply: { enabled: true, prompt: "Thank them.", delivery: "form", style: "plain" },
  });
  const ids = await t.run(async (ctx) => ({
    email: await ctx.db.insert("blocks", { formId, order: 0, kind: "field", type: "email", title: "Email" } as never),
    phone: await ctx.db.insert("blocks", { formId, order: 1, kind: "field", type: "phone", title: "Phone" } as never),
    idea: await ctx.db.insert("blocks", { formId, order: 2, kind: "field", type: "long-text", title: "Your idea" } as never),
  }));
  const responseId = await response(t, formId, owner.userId, {
    respondentEmail: "secret@example.com",
    answers: [
      { blockId: ids.email, question: "Email", value: "secret@example.com" },
      { blockId: ids.phone, question: "Phone", value: "+44 7700 900123" },
      { blockId: ids.idea, question: "Your idea", value: "A rooftop garden" },
    ],
    aiReply: { status: "pending", at: Date.now() },
  });
  await t.action(internal.aiReply.generate, { responseId });
  const sent = geminiCalls().map(([, init]) => String((init as RequestInit).body)).join("\n");
  expect(sent).toContain("A rooftop garden");
  expect(sent).not.toContain("secret@example.com");
  expect(sent).not.toContain("7700 900123");
});
