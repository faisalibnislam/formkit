import type { Doc } from "../_generated/dataModel";

/**
 * Each question's answers, summed up for the Summary on Analytics: how the
 * choices split, the spread of ratings and scales (with an NPS for a 0-10
 * "how likely" question), number ranges, date ranges, and the latest few
 * written answers. Contact details are counted, never listed.
 */

export type QuestionSummary =
  | { blockId: string; title: string; type: string; answered: number; kind: "choice"; multi: boolean; options: { label: string; count: number }[] }
  | {
      blockId: string;
      title: string;
      type: string;
      answered: number;
      kind: "scale";
      from: number;
      to: number;
      counts: number[];
      average: number | null;
      nps: { score: number; promoters: number; passives: number; detractors: number } | null;
    }
  | { blockId: string; title: string; type: string; answered: number; kind: "number"; min: number | null; max: number | null; average: number | null; median: number | null }
  | { blockId: string; title: string; type: string; answered: number; kind: "date"; earliest: string | null; latest: string | null }
  | { blockId: string; title: string; type: string; answered: number; kind: "text"; latest: string[] }
  | { blockId: string; title: string; type: string; answered: number; kind: "count" };

/** Answers that are someone's contact details: counted, never shown in a summary. */
const PRIVATE = new Set(["email", "phone", "address", "name", "signature", "url"]);
const round1 = (n: number) => Math.round(n * 10) / 10;

export function summarize(
  blocks: Pick<Doc<"blocks">, "_id" | "kind" | "type" | "title" | "options" | "scaleMin" | "scaleMax" | "nps">[],
  responses: Pick<Doc<"responses">, "answers">[],
): QuestionSummary[] {
  const byBlock = new Map<string, Doc<"responses">["answers"]>();
  for (const r of responses) {
    for (const a of r.answers) {
      if (!(a.value?.trim() || a.values?.length || a.fileId)) continue;
      const list = byBlock.get(a.blockId) ?? [];
      list.push(a);
      byBlock.set(a.blockId, list);
    }
  }

  const out: QuestionSummary[] = [];
  for (const b of blocks) {
    if (b.kind !== "field" || !b.type || b.type === "hidden") continue;
    const answers = byBlock.get(b._id) ?? [];
    const base = { blockId: b._id as string, title: b.title?.trim() || "Untitled question", type: b.type, answered: answers.length };
    switch (b.type) {
      case "single-choice":
      case "dropdown":
      case "yes-no":
      case "multi-choice": {
        const labels = b.type === "yes-no" ? ["Yes", "No"] : [...(b.options ?? [])];
        const counts = new Map(labels.map((l) => [l, 0]));
        for (const a of answers) {
          for (const v of a.values ?? (a.value ? [a.value] : [])) {
            // An "Other" answer, or an option since removed, is counted under its own words.
            counts.set(v, (counts.get(v) ?? 0) + 1);
          }
        }
        out.push({
          ...base,
          kind: "choice",
          multi: b.type === "multi-choice",
          options: [...counts.entries()].map(([label, count]) => ({ label, count })),
        });
        break;
      }
      case "rating":
      case "scale": {
        const from = b.type === "rating" ? 1 : (b.scaleMin ?? 1);
        const to = b.type === "rating" ? Math.max(2, Math.min(10, b.scaleMax ?? 5)) : (b.scaleMax ?? 5);
        const counts = Array.from({ length: Math.max(0, to - from + 1) }, () => 0);
        let sum = 0;
        let n = 0;
        for (const a of answers) {
          const v = Number(a.value);
          if (!Number.isInteger(v) || v < from || v > to) continue;
          counts[v - from]! += 1;
          sum += v;
          n += 1;
        }
        let nps = null;
        if (b.nps && from === 0 && to === 10 && n) {
          const promoters = counts.slice(9).reduce((x, y) => x + y, 0);
          const detractors = counts.slice(0, 7).reduce((x, y) => x + y, 0);
          nps = {
            promoters,
            passives: n - promoters - detractors,
            detractors,
            score: Math.round(((promoters - detractors) / n) * 100),
          };
        }
        out.push({ ...base, answered: n, kind: "scale", from, to, counts, average: n ? round1(sum / n) : null, nps });
        break;
      }
      case "number": {
        const nums = answers.map((a) => Number((a.value ?? "").replace(/,/g, ""))).filter(Number.isFinite).sort((x, y) => x - y);
        const mid = Math.floor(nums.length / 2);
        out.push({
          ...base,
          answered: nums.length,
          kind: "number",
          min: nums.length ? nums[0]! : null,
          max: nums.length ? nums[nums.length - 1]! : null,
          average: nums.length ? round1(nums.reduce((x, y) => x + y, 0) / nums.length) : null,
          median: nums.length ? (nums.length % 2 ? nums[mid]! : round1((nums[mid - 1]! + nums[mid]!) / 2)) : null,
        });
        break;
      }
      case "date": {
        const dates = answers.map((a) => a.value ?? "").filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort();
        out.push({ ...base, answered: dates.length, kind: "date", earliest: dates[0] ?? null, latest: dates[dates.length - 1] ?? null });
        break;
      }
      case "short-text":
      case "long-text":
      case "company":
        out.push({ ...base, kind: "text", latest: answers.slice(0, 5).map((a) => (a.value ?? "").slice(0, 280)) });
        break;
      default:
        // Files, recordings, and contact details: how many, never what.
        void PRIVATE;
        out.push({ ...base, kind: "count" });
    }
  }
  return out;
}
