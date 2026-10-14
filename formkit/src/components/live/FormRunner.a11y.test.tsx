// @vitest-environment node
import { describe, expect, test } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { FormRunner, type OpenForm } from "./FormRunner";

/** Every kind of question a respondent can be asked, on one page. */
const form = {
  formId: "f1",
  title: "Everything",
  brand: { name: "Studio", logoUrl: null, color: null, badge: true },
  logos: [],
  welcome: null,
  thanks: null,
  theme: null,
  closedMessage: "",
  uploadCapMb: 10,
  rules: { spam: false, requireEmail: false, editAfter: false, multiple: true },
  logic: [],
  blocks: [
    { _id: "t", kind: "field", type: "short-text", title: "Name", required: true, help: "First name is fine" },
    { _id: "c", kind: "field", type: "single-choice", title: "Colour", options: ["Red", "Blue"] },
    { _id: "m", kind: "field", type: "multi-choice", title: "Toppings", options: ["Cheese", "Olives"] },
    { _id: "y", kind: "field", type: "yes-no", title: "Coming?" },
    { _id: "r", kind: "field", type: "rating", title: "Stars", scaleMax: 5 },
    { _id: "s", kind: "field", type: "scale", title: "Likely", scaleMin: 0, scaleMax: 10 },
    { _id: "d", kind: "field", type: "dropdown", title: "Country", options: ["UK", "US"] },
    { _id: "f", kind: "field", type: "file", title: "CV", accept: [".pdf"] },
    { _id: "g", kind: "field", type: "signature", title: "Sign the agreement", required: true },
  ],
} as unknown as OpenForm;

const html = renderToStaticMarkup(<FormRunner data={form} mode="preview" onSubmit={async () => ({ resumeToken: "x" })} upload={async () => "s" as never} />);
const tag = (re: RegExp) => html.match(re)?.[0] ?? "";
/** The element carrying `id`, from its opening tag to its first closing div. */
const groupOf = (id: string) => {
  const at = html.indexOf(`id="${id}"`);
  const start = html.lastIndexOf("<div", at);
  return html.slice(start, html.indexOf("</div>", at));
};

describe("the live form, for assistive technology", () => {
  test("text inputs take their name from the question and say they are required", () => {
    const input = tag(/<input[^>]*id="q-t-input"[^>]*>/);
    expect(input).toContain('aria-labelledby="q-t-title"');
    expect(input).toContain('aria-required="true"');
    expect(input).toContain('aria-describedby="q-t-help"');
  });

  test("single choices, yes/no, ratings and scales are radio groups with one tab stop", () => {
    for (const id of ["c", "y", "r", "s"]) {
      const group = groupOf(`q-${id}-input`);
      expect(group).toContain('role="radiogroup"');
      expect((group.match(/role="radio"/g) ?? []).length).toBeGreaterThan(1);
      expect((group.match(/tabindex="0"/g) ?? []).length).toBe(1);
    }
  });

  test("multiple choice is a group of checkboxes", () => {
    const group = groupOf("q-m-input");
    expect(group).toContain('role="group"');
    expect(group.match(/role="checkbox"/g)?.length).toBe(2);
  });

  test("the file input can be reached from the keyboard", () => {
    const file = tag(/<input[^>]*type="file"[^>]*>/);
    expect(file).not.toContain("display:none");
    expect(file).toContain('class="sr-only"');
    expect(file).toContain('aria-labelledby="q-f-title"');
  });

  test("progress is announced, not hidden", () => {
    expect(html).not.toMatch(/fk-live-progress"[^>]*aria-hidden/);
  });

  test("a signature is a drawing pad with a name, and the typed name carries the question's label", () => {
    expect(html).toContain('aria-label="Sign here with a finger, mouse or pen, for Sign the agreement"');
    const name = tag(/<input[^>]*id="q-g-input"[^>]*>/);
    expect(name).toContain('aria-labelledby="q-g-title"');
    expect(name.toLowerCase()).toContain('autocomplete="name"');
  });
});
