import { expect, test } from "vitest";
import { validateAnswers } from "../model/validate";
import { summarize } from "../model/summary";

const matrix = {
  _id: "m",
  kind: "field",
  type: "matrix",
  title: "Rate us",
  required: true,
  order: 0,
  rows: ["Speed", "Price: value"],
  options: ["Poor", "Good"],
} as never;
const ranking = { _id: "r", kind: "field", type: "ranking", title: "Order these", order: 1, options: ["A", "B", "C"] } as never;
const form = { endings: [] } as never;
const check = (answers: { blockId: string; values?: string[] }[], partial = false) =>
  validateAnswers(form, [matrix, ranking], [], answers as never, { partial }).map((p) => p.code);

test("a matrix takes one column per row from its own rows and columns, every row when required", () => {
  expect(check([{ blockId: "m", values: ["Speed: Good", "Price: value: Poor"] }])).toEqual([]);
  expect(check([{ blockId: "m", values: ["Speed: Great"] }])).toContain("option");
  expect(check([{ blockId: "m", values: ["Speed: Good", "Speed: Poor", "Price: value: Good"] }])).toContain("option");
  expect(check([{ blockId: "m", values: ["Speed: Good"] }])).toContain("rows");
  // A partial save is not held to every row.
  expect(check([{ blockId: "m", values: ["Speed: Good"] }], true)).toEqual([]);
});

test("a ranking puts every option once", () => {
  expect(check([{ blockId: "m", values: ["Speed: Good", "Price: value: Good"] }, { blockId: "r", values: ["C", "A", "B"] }])).toEqual([]);
  expect(check([{ blockId: "m", values: ["Speed: Good", "Price: value: Good"] }, { blockId: "r", values: ["C", "A"] }])).toContain("option");
  expect(check([{ blockId: "m", values: ["Speed: Good", "Price: value: Good"] }, { blockId: "r", values: ["C", "C", "A"] }])).toContain("option");
});

test("summaries count a matrix row by row and rank by average place", () => {
  const rows = [
    { answers: [{ blockId: "m", values: ["Speed: Good", "Price: value: Poor"] }, { blockId: "r", values: ["B", "A", "C"] }] },
    { answers: [{ blockId: "m", values: ["Speed: Good", "Price: value: Good"] }, { blockId: "r", values: ["B", "C", "A"] }] },
  ];
  const [m, r] = summarize([matrix, ranking], rows as never);
  expect(m).toMatchObject({ kind: "matrix", rows: [{ label: "Speed", counts: [0, 2] }, { label: "Price: value", counts: [1, 1] }] });
  expect(r).toMatchObject({ kind: "ranking", options: [{ label: "B", average: 1 }, { label: "A", average: 2.5 }, { label: "C", average: 2.5 }] });
});
