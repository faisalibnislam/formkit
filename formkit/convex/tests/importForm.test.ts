import { afterEach, expect, test, vi } from "vitest";
import { api } from "../_generated/api";
import { backend, person } from "./fixtures.helpers";
import { googleForm, pageText, sourceOf, typeformDefinition } from "../model/importParse";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

const GOOGLE = `<html><script>var FB_PUBLIC_LOAD_DATA_ = [null,["Tell us about you",[
  [111,"Your name",null,0,[[1,null,1]]],
  [112,"Favourite colour","Pick one",2,[[2,[["Red"],["Blue"]],0]]],
  [113,"About your team",null,8],
  [114,"How happy are you?",null,5,[[3,[["1"],["2"],["3"],["4"],["5"]],0]]],
  [115,"Rate each office",null,7,[[4,[["London"]],0]]],
  [116,"Anything else? \\"Quotes\\" welcome",null,1,[[5,null,0]]]
],null,null,null,null,null,null,"Team survey"],"/forms","Team survey"];</script></html>`;

test("a Google Form is read from its own page data", () => {
  const parsed = googleForm(GOOGLE)!;
  expect(parsed.spec.title).toBe("Team survey");
  expect(parsed.spec.items!.map((i) => [i.kind, i.type, i.title])).toEqual([
    ["field", "short-text", "Your name"],
    ["field", "single-choice", "Favourite colour"],
    ["page", undefined, "About your team"],
    ["field", "scale", "How happy are you?"],
    ["field", "long-text", 'Anything else? "Quotes" welcome'],
  ]);
  expect(parsed.spec.items![0]!.required).toBe(true);
  expect(parsed.spec.items![1]!.options).toEqual(["Red", "Blue"]);
  expect(parsed.skipped).toEqual(["Rate each office (a grid question)"]);
});

test("a Typeform definition maps its fields and names what it could not", () => {
  const parsed = typeformDefinition({
    title: "Customer check-in",
    welcome_screens: [{ title: "Hi there", properties: { description: "Three questions." } }],
    fields: [
      { title: "What's your email?", type: "email", validations: { required: true } },
      { title: "Which plans?", type: "multiple_choice", properties: { allow_multiple_selection: true, choices: [{ label: "Pro" }, { label: "Team" }] } },
      { title: "Thanks {{field:abc}}!", type: "statement" },
      { title: "Score us", type: "nps" },
      { title: "Draw it", type: "matrix" },
    ],
  })!;
  expect(parsed.spec.items!.map((i) => i.type)).toEqual(["email", "multi-choice", "scale"]);
  expect(parsed.spec.welcomeMessage).toBe("Three questions.");
  expect(parsed.skipped).toHaveLength(2);
});

test("only the four services' links are read", () => {
  expect(sourceOf("https://docs.google.com/forms/d/e/x/viewform")).toBe("Google Forms");
  expect(sourceOf("https://acme.typeform.com/to/abc")).toBe("Typeform");
  expect(sourceOf("https://tally.so/r/abc")).toBe("Tally");
  expect(sourceOf("https://form.jotform.com/123")).toBe("Jotform");
  expect(sourceOf("http://docs.google.com/forms/x")).toBeNull();
  expect(sourceOf("https://docs.google.com.evil.example/forms")).toBeNull();
  expect(sourceOf("https://169.254.169.254/latest")).toBeNull();
});

test("a page's text keeps labels and choices, and drops its scripts", () => {
  const text = pageText(`<head><title>x</title></head><script>steal()</script><label>Your city</label><select><option>Paris</option></select>`);
  expect(text).toContain("Your city");
  expect(text).toContain("[option: Paris]");
  expect(text).not.toContain("steal");
});

test("importing a Google Form link makes a draft without AI", async () => {
  const fetched: string[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      fetched.push(String(url));
      return new Response(GOOGLE, { status: 200 });
    }),
  );
  const t = backend();
  const owner = await person(t, "owner@example.com");
  const out = await owner.as.action(api.importForm.fromLink, { url: "https://docs.google.com/forms/d/e/abc/viewform" });
  expect(out).toMatchObject({ from: "Google Forms", questions: 4, usedAi: false });
  const form = await t.run((ctx) => ctx.db.get(out.formId));
  expect(form).toMatchObject({ title: "Team survey", status: "draft", ownerId: owner.userId });
  expect(fetched).toEqual(["https://docs.google.com/forms/d/e/abc/viewform"]);
});

test("a redirect off the four services is not followed", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(null, { status: 302, headers: { location: "http://169.254.169.254/latest/meta-data" } })),
  );
  const t = backend();
  const owner = await person(t, "owner@example.com");
  await expect(owner.as.action(api.importForm.fromLink, { url: "https://forms.gle/abc" })).rejects.toThrow(/does not import from/);
});

test("a Tally form is read by the AI and counts as one AI-built form", async () => {
  vi.stubEnv("GEMINI_API_KEY", "k");
  const sent: string[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      if (String(url).includes("tally.so")) return new Response(`<label>Your colour preference</label><input type="radio" value="Red">`, { status: 200 });
      sent.push(String(init?.body ?? ""));
      return new Response(
        JSON.stringify({
          candidates: [
            {
              content: {
                parts: [{ text: JSON.stringify({ title: "Colour poll", items: [{ kind: "field", type: "single-choice", title: "Your colour preference", options: ["Red", "Blue"] }], rules: [], note: "" }) }],
              },
            },
          ],
          usageMetadata: { promptTokenCount: 5, candidatesTokenCount: 5 },
        }),
        { status: 200 },
      );
    }),
  );
  const t = backend();
  const owner = await person(t, "owner@example.com");
  const out = await owner.as.action(api.importForm.fromLink, { url: "https://tally.so/r/abc" });
  expect(out).toMatchObject({ from: "Tally", questions: 1, usedAi: true });
  // Kept in the form's own words: "colour" stays as written.
  const blocks = await t.run((ctx) => ctx.db.query("blocks").collect());
  expect(blocks[0]!.title).toBe("Your colour preference");
  expect(sent[0]).toContain("Your colour preference");
});
