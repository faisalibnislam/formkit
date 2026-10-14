// @vitest-environment node
import { expect, test } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { FormRunner, type OpenForm } from "./FormRunner";

const base = {
  formId: "f1",
  title: "Plan",
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
    { _id: "p", kind: "field", type: "single-choice", title: "Your plan?", options: ["Free", "Pro"] },
    { _id: "y", kind: "field", type: "yes-no", title: "Coming?" },
  ],
};
const render = (data: object) =>
  renderToStaticMarkup(<FormRunner data={data as unknown as OpenForm} mode="preview" onSubmit={async () => ({ resumeToken: "x" })} upload={async () => "s" as never} />);

test("a form written in Spanish speaks Spanish around its questions", () => {
  const html = render({ ...base, language: "es" });
  expect(html).toContain('lang="es"');
  expect(html).toContain("Sí");
  expect(html).toMatch(/Enviar|Siguiente|Aceptar/);
});

test("Arabic reads right to left", () => {
  expect(render({ ...base, language: "ar" })).toContain('dir="rtl"');
});
