import type { Doc } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";

/**
 * Limited places (Pro): an option can be picked by so many people and no more
 * - "Workshop A, 20 places". Counted from complete responses, so a place is
 * taken when the form is sent, not when it is ticked.
 */

export function hasLimits(b: Pick<Doc<"blocks">, "limits">) {
  return !!b.limits?.some((n) => n > 0);
}

/** How many complete responses picked each limited option, by question. */
export async function placesTaken(
  ctx: QueryCtx,
  formId: Doc<"forms">["_id"],
  blocks: Doc<"blocks">[],
  skip?: Doc<"responses">["_id"],
) {
  const limited = blocks.filter(hasLimits);
  const taken = new Map<string, number[]>();
  if (!limited.length) return taken;
  for (const b of limited) taken.set(b._id, (b.options ?? []).map(() => 0));
  const responses = await ctx.db
    .query("responses")
    .withIndex("by_form", (q) => q.eq("formId", formId))
    .collect();
  for (const r of responses) {
    if (r.partial || r.preview || r._id === skip) continue;
    for (const a of r.answers) {
      const counts = taken.get(a.blockId);
      if (!counts) continue;
      const opts = limited.find((b) => b._id === a.blockId)!.options ?? [];
      for (const picked of a.values ?? (a.value ? [a.value] : [])) {
        const i = opts.indexOf(picked);
        if (i >= 0) counts[i]!++;
      }
    }
  }
  return taken;
}

/** Places left for each option, or null where it has no limit. */
export function placesLeft(b: Doc<"blocks">, taken: Map<string, number[]>) {
  if (!hasLimits(b)) return null;
  const counts = taken.get(b._id) ?? [];
  return (b.options ?? []).map((_, i) => {
    const cap = b.limits?.[i] ?? 0;
    return cap > 0 ? Math.max(0, cap - (counts[i] ?? 0)) : null;
  });
}
