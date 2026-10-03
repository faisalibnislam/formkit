import type { Doc } from "../_generated/dataModel";

/** Long enough for every answer most forms get; search reads the start first. */
const MAX = 16_000;

type Searchable = Pick<
  Doc<"responses">,
  "respondentName" | "respondentEmail" | "respondentCompany" | "respondentPhone" | "tags" | "answers"
>;

/**
 * The text the inbox searches: who answered, the owner's labels and every
 * written answer, as one string. Rebuilt whenever any of those change.
 */
export function searchTextOf(r: Searchable) {
  const parts = [
    r.respondentName,
    r.respondentEmail,
    r.respondentCompany,
    r.respondentPhone,
    ...(r.tags ?? []),
    ...r.answers.flatMap((a) => [a.value, ...(a.values ?? []), a.fileName]),
  ];
  return parts
    .filter((p): p is string => typeof p === "string" && p.trim() !== "")
    .join(" ")
    .slice(0, MAX);
}
