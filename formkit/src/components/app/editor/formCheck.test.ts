import { describe, expect, it } from "vitest";
import { formChecks, minutesToFill } from "./formCheck";

const q = (over: Record<string, unknown>) => ({ _id: Math.random().toString(), kind: "field", type: "short-text", title: "Q", ...over });

describe("the form check", () => {
  it("is quiet for a short, tidy form", () => {
    expect(formChecks([q({ title: "Name", type: "name" }), q({ title: "Email", type: "email" })])).toEqual([]);
  });

  it("says when a form is long, or leans on long written answers", () => {
    const long = Array.from({ length: 30 }, (_, i) => q({ title: `Q${i}` }));
    expect(formChecks(long)[0]!.text).toMatch(/30 questions/);
    const essays = Array.from({ length: 4 }, (_, i) => q({ title: `Tell us ${i}`, type: "long-text", required: true }));
    expect(formChecks(essays).some((f) => /long written answer/.test(f.text))).toBe(true);
    expect(minutesToFill(essays)).toBe(3);
  });

  it("catches repeated wording, repeated options and a lone option", () => {
    const found = formChecks([
      q({ title: "Your role" }),
      q({ title: "your role " }),
      q({ title: "Pick", type: "single-choice", options: ["A", "a"] }),
      q({ title: "Only", type: "dropdown", options: ["Yes"] }),
    ]).map((f) => f.text);
    expect(found.some((t) => /2 questions are worded/.test(t))).toBe(true);
    expect(found.some((t) => /same option twice/.test(t))).toBe(true);
    expect(found.some((t) => /only one option/.test(t))).toBe(true);
  });

  it("asks for a picture's description, and for empty picture and video blocks", () => {
    const found = formChecks([
      { _id: "i", kind: "content", type: "image", imageId: "s1" },
      { _id: "j", kind: "content", type: "image" },
      { _id: "v", kind: "content", type: "video" },
    ]).map((f) => f.text);
    expect(found).toHaveLength(3);
  });
});
