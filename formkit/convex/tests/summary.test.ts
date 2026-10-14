import { expect, test } from "vitest";
import { summarize } from "../model/summary";

const b = (id: string, type: string, extra: Record<string, unknown> = {}) => ({ _id: id, kind: "field", type, title: id, ...extra }) as never;
const r = (answers: [string, string | string[]][]) =>
  ({ answers: answers.map(([blockId, v]) => (Array.isArray(v) ? { blockId, question: "", values: v } : { blockId, question: "", value: v })) }) as never;

test("choices, NPS, numbers, dates and text add up", () => {
  const out = summarize(
    [
      b("colour", "single-choice", { options: ["Red", "Blue"] }),
      b("tops", "multi-choice", { options: ["Cheese", "Olives"] }),
      b("nps", "scale", { scaleMin: 0, scaleMax: 10, nps: true }),
      b("age", "number"),
      b("when", "date"),
      b("note", "long-text"),
      b("mail", "email"),
    ],
    [
      r([["colour", "Red"], ["tops", ["Cheese", "Olives"]], ["nps", "10"], ["age", "30"], ["when", "2026-01-02"], ["note", "Lovely"], ["mail", "a@b.co"]]),
      r([["colour", "Red"], ["tops", ["Cheese"]], ["nps", "9"], ["age", "40"], ["when", "2026-03-04"]]),
      r([["colour", "Purple"], ["nps", "3"], ["age", "50"]]),
    ],
  );
  const by = Object.fromEntries(out.map((q) => [q.blockId, q]));
  expect(by.colour).toMatchObject({ kind: "choice", options: [{ label: "Red", count: 2 }, { label: "Blue", count: 0 }, { label: "Purple", count: 1 }] });
  expect(by.tops).toMatchObject({ kind: "choice", multi: true, answered: 2, options: [{ label: "Cheese", count: 2 }, { label: "Olives", count: 1 }] });
  expect(by.nps).toMatchObject({ kind: "scale", answered: 3, nps: { promoters: 2, detractors: 1, passives: 0, score: 33 } });
  expect(by.age).toMatchObject({ kind: "number", min: 30, max: 50, average: 40, median: 40 });
  expect(by.when).toMatchObject({ kind: "date", earliest: "2026-01-02", latest: "2026-03-04" });
  expect(by.note).toMatchObject({ kind: "text", latest: ["Lovely"] });
  // Contact details are counted, never listed.
  expect(by.mail).toEqual({ blockId: "mail", title: "mail", type: "email", answered: 1, kind: "count" });
});
