import { afterEach, expect, test, vi } from "vitest";
import { api } from "../_generated/api";
import { backend, form, person } from "./fixtures.helpers";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

test("a form's language is free; more languages are Pro, translated by AI, and reach the live form", async () => {
  vi.stubEnv("GEMINI_API_KEY", "k");
  let reply: unknown = null;
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(reply) }] } }], usageMetadata: { promptTokenCount: 5, candidatesTokenCount: 5 } }), {
        status: 200,
      }),
    ),
  );
  const t = backend();
  const owner = await person(t, "owner@example.com");
  const formId = await form(t, owner.userId, { status: "draft", welcome: { title: "Hello", message: "Two questions.", button: "Start" } } as never);
  const pick = await owner.as.mutation(api.blocks.add, { formId, kind: "field", type: "single-choice", title: "Your plan?" });
  await owner.as.mutation(api.blocks.update, { blockId: pick, patch: { options: ["Free", "Pro"] } });

  await owner.as.mutation(api.translations.setLanguage, { formId, language: "fr" });
  await expect(owner.as.mutation(api.translations.setLanguages, { formId, languages: ["es"] })).rejects.toThrow(/Pro/);

  await t.run((ctx) => ctx.db.patch(owner.userId, { plan: "pro", planStatus: "active" } as never));
  await owner.as.mutation(api.translations.setLanguages, { formId, languages: ["es", "fr", "xx"] });
  expect((await owner.as.query(api.translations.forForm, { formId })).languages).toEqual(["es"]);

  // Options that come back a different length are not used: they could not be matched to answers.
  reply = { blocks: [{ blockId: pick, title: "¿Tu plan?", options: ["Gratis"] }], screens: { welcomeTitle: "Hola", welcomeButton: "Empezar" } };
  await owner.as.action(api.translations.translate, { formId, lang: "es" });
  let es = (await owner.as.query(api.translations.forForm, { formId })).translations[0]!;
  expect(es.blocks[0]!.title).toBe("¿Tu plan?");
  expect(es.blocks[0]!.options).toBeUndefined();

  reply = { blocks: [{ blockId: pick, title: "¿Tu plan?", options: ["Gratis", "Pro"] }], screens: { welcomeTitle: "Hola" } };
  await owner.as.action(api.translations.translate, { formId, lang: "es" });
  await owner.as.mutation(api.translations.setText, { formId, lang: "es", blockId: pick, field: "title", value: "¿Qué plan tienes?" });
  es = (await owner.as.query(api.translations.forForm, { formId })).translations[0]!;
  expect(es.blocks[0]).toMatchObject({ title: "¿Qué plan tienes?", options: ["Gratis", "Pro"] });

  await owner.as.mutation(api.forms.publish, { formId });
  const slug = (await t.run((ctx) => ctx.db.get(formId)))!.slug;
  const live = (await t.query(api.publicForm.bySlug, { slug })) as { language: string; translations: { lang: string }[] };
  expect(live.language).toBe("fr");
  expect(live.translations.map((x) => x.lang)).toEqual(["es"]);
});
