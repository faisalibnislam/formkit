import { afterEach, expect, test, vi } from "vitest";
import { api } from "../_generated/api";
import { backend, form, person } from "./fixtures.helpers";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

test("the wording check names unclear questions with a better way to put them, and uses one AI edit", async () => {
  vi.stubEnv("GEMINI_API_KEY", "k");
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      new Response(
        JSON.stringify({
          candidates: [
            { content: { parts: [{ text: JSON.stringify({ notes: [{ question: 2, problem: "it asks two things at once", suggestion: "How often do you visit?" }, { question: 9, problem: "x", suggestion: "y" }] }) }] } },
          ],
          usageMetadata: { promptTokenCount: 5, candidatesTokenCount: 5 },
        }),
        { status: 200 },
      ),
    ),
  );
  const t = backend();
  const owner = await person(t, "owner@example.com");
  const formId = await form(t, owner.userId);
  await owner.as.mutation(api.blocks.add, { formId, kind: "field", type: "name", title: "Your name" });
  const two = await owner.as.mutation(api.blocks.add, { formId, kind: "field", type: "short-text", title: "How often and why do you visit?" });
  const out = await owner.as.action(api.formCheck.wording, { formId });
  expect(out.notes).toEqual([
    { blockId: two, question: "How often and why do you visit?", problem: "It asks two things at once", suggestion: "How often do you visit?" },
  ]);
});
