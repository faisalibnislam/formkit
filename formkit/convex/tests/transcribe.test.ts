import { afterEach, expect, test, vi } from "vitest";
import { api, internal } from "../_generated/api";
import { backend, form, person } from "./fixtures.helpers";

// convex-test keeps no content type for stored files; a real upload has one.
vi.mock("../model/voice", async (original) => ({
  ...(await original<typeof import("../model/voice")>()),
  isAudio: () => true,
}));

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

function stubGemini(text: string) {
  const sent: string[] = [];
  vi.stubEnv("GEMINI_API_KEY", "k");
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: string, init?: RequestInit) => {
      sent.push(String(init?.body ?? ""));
      return new Response(
        JSON.stringify({
          candidates: [{ content: { parts: [{ text }] } }],
          usageMetadata: { promptTokenCount: 5, candidatesTokenCount: 5 },
        }),
        { status: 200 },
      );
    }),
  );
  return sent;
}

async function voiceForm(plan: "free" | "pro", transcribe: boolean) {
  const t = backend();
  const owner = await person(t, "owner@example.com");
  await t.run((ctx) => ctx.db.patch(owner.userId, { plan: "pro", planStatus: "active" } as never));
  const formId = await form(t, owner.userId, { status: "draft", security: { spam: false, rateLimit: false, multiple: true } });
  const blockId = await owner.as.mutation(api.blocks.add, { formId, kind: "field", type: "voice", title: "Tell us in your own words" });
  if (transcribe) await owner.as.mutation(api.blocks.update, { blockId, patch: { transcribe: true } });
  await owner.as.mutation(api.forms.publish, { formId });
  if (plan === "free") await t.run((ctx) => ctx.db.patch(owner.userId, { plan: "free" } as never));
  const fileId = await t.run((ctx) => ctx.storage.store(new Blob([new Uint8Array([1, 2, 3, 4])], { type: "audio/webm" })));
  const { responseId } = await t.mutation(api.publicForm.submit, {
    formId,
    partial: false,
    answers: [{ blockId, fileId, fileName: "voice-recording.webm" }],
  });
  return { t, owner, formId, blockId, responseId };
}

test("a Pro voice answer is written out, searchable and exported", async () => {
  const sent = stubGemini("The delivery came two weeks late.");
  const { t, owner, responseId } = await voiceForm("pro", true);
  const scheduled = await t.run((ctx) => ctx.db.system.query("_scheduled_functions").collect());
  expect(scheduled.map((s) => s.name)).toContain("transcribe:run");

  await t.action(internal.transcribe.run, { responseId, reply: false, classify: false });
  const r = await t.run((ctx) => ctx.db.get(responseId));
  expect(r!.answers[0].transcript).toBe("The delivery came two weeks late.");
  expect(r!.searchText).toContain("two weeks late");
  expect(r!.aiCharge).toBeTruthy();
  expect(sent[0]).toContain("inlineData");
  expect(sent[0]).toContain("audio/webm");

  const one = await owner.as.query(api.responses.get, { responseId });
  expect(one!.answers[0].transcript).toBe("The delivery came two weeks late.");
});

test("a voice question that does not ask, or a Free form, is never written out", async () => {
  stubGemini("never");
  for (const [plan, on] of [
    ["pro", false],
    ["free", true],
  ] as const) {
    const { t } = await voiceForm(plan, on);
    const scheduled = await t.run((ctx) => ctx.db.system.query("_scheduled_functions").collect());
    expect(scheduled.map((s) => s.name)).not.toContain("transcribe:run");
  }
});

test("only a voice question can ask to be written out", async () => {
  const t = backend();
  const owner = await person(t, "owner@example.com");
  await t.run((ctx) => ctx.db.patch(owner.userId, { plan: "pro", planStatus: "active" } as never));
  const formId = await form(t, owner.userId);
  const blockId = await owner.as.mutation(api.blocks.add, { formId, kind: "field", type: "long-text", title: "Tell us" });
  await expect(owner.as.mutation(api.blocks.update, { blockId, patch: { transcribe: true } })).rejects.toThrow(/voice/);
});
