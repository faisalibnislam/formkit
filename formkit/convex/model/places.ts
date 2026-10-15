import type { Doc } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

/**
 * Limited places (Pro): an option can be picked by so many people and no more
 * - "Workshop A, 20 places". Counted from complete responses, so a place is
 * taken when the form is sent, not when it is ticked.
 */

export function hasLimits(b: Pick<Doc<"blocks">, "limits">) {
  return !!b.limits?.some((n) => n > 0);
}

type Picks = { option: string; n: number }[];
type Answered = Pick<Doc<"responses">, "partial" | "preview" | "answers">;

/** What one complete response picked, by question. Partial responses and previews take no place. */
function picksOf(r: Answered | null) {
  const out = new Map<string, string[]>();
  if (!r || r.partial || r.preview) return out;
  for (const a of r.answers) {
    const picked = a.values ?? (a.value ? [a.value] : []);
    if (picked.length) out.set(a.blockId, picked);
  }
  return out;
}

function toCounts(b: Doc<"blocks">, picks: Picks | undefined) {
  return (b.options ?? []).map((o) => picks?.find((p) => p.option === o)?.n ?? 0);
}

/** The slow way, reading every complete response: for a question with no running count yet. */
async function countAll(ctx: QueryCtx, formId: Doc<"forms">["_id"], limited: Doc<"blocks">[]) {
  const picks = new Map<string, Map<string, number>>(limited.map((b) => [b._id, new Map()]));
  for await (const r of ctx.db.query("responses").withIndex("by_form", (q) => q.eq("formId", formId))) {
    for (const [blockId, chosen] of picksOf(r)) {
      const m = picks.get(blockId);
      if (m) for (const o of chosen) m.set(o, (m.get(o) ?? 0) + 1);
    }
  }
  return new Map([...picks].map(([id, m]) => [id, [...m].map(([option, n]) => ({ option, n }))]));
}

/**
 * How many complete responses picked each limited option, by question. Read
 * from running counts (placeCounts), kept up to date as responses arrive,
 * change and go, so this costs one read per limited question.
 */
export async function placesTaken(
  ctx: QueryCtx,
  formId: Doc<"forms">["_id"],
  blocks: Doc<"blocks">[],
  skip?: Answered | null,
) {
  const limited = blocks.filter(hasLimits);
  const taken = new Map<string, number[]>();
  if (!limited.length) return taken;
  const rows = new Map<string, Picks>();
  for (const b of limited) {
    const row = await ctx.db
      .query("placeCounts")
      .withIndex("by_form_block", (q) => q.eq("formId", formId).eq("blockId", b._id))
      .unique();
    if (row) rows.set(b._id, row.picks);
  }
  const missing = limited.filter((b) => !rows.has(b._id));
  if (missing.length) for (const [id, p] of await countAll(ctx, formId, missing)) rows.set(id, p);
  // A response being changed gives back the places it held.
  const giveBack = picksOf(skip ?? null);
  for (const b of limited) {
    const counts = toCounts(b, rows.get(b._id));
    for (const o of giveBack.get(b._id) ?? []) {
      const i = (b.options ?? []).indexOf(o);
      if (i >= 0) counts[i] = Math.max(0, counts[i]! - 1);
    }
    taken.set(b._id, counts);
  }
  return taken;
}

/**
 * Starts running counts for limited questions that have none yet, from the
 * responses so far. Called before a response is stored, so the count it then
 * moves is already right.
 */
export async function startPlaceCounts(ctx: MutationCtx, formId: Doc<"forms">["_id"], blocks: Doc<"blocks">[]) {
  const missing: Doc<"blocks">[] = [];
  for (const b of blocks.filter(hasLimits)) {
    const row = await ctx.db
      .query("placeCounts")
      .withIndex("by_form_block", (q) => q.eq("formId", formId).eq("blockId", b._id))
      .unique();
    if (!row) missing.push(b);
  }
  if (!missing.length) return;
  for (const [blockId, picks] of await countAll(ctx, formId, missing)) {
    await ctx.db.insert("placeCounts", { formId, blockId: blockId as Doc<"blocks">["_id"], picks });
  }
}

/** Moves the running counts by one response going from `before` to `after`. */
export async function movePlaces(ctx: MutationCtx, formId: Doc<"forms">["_id"], before: Answered | null, after: Answered | null) {
  const was = picksOf(before);
  const now = picksOf(after);
  for (const blockId of new Set([...was.keys(), ...now.keys()])) {
    const row = await ctx.db
      .query("placeCounts")
      .withIndex("by_form_block", (q) => q.eq("formId", formId).eq("blockId", blockId as Doc<"blocks">["_id"]))
      .unique();
    // Only questions with limits keep a count.
    if (!row) continue;
    const m = new Map(row.picks.map((p) => [p.option, p.n]));
    for (const o of was.get(blockId) ?? []) m.set(o, Math.max(0, (m.get(o) ?? 0) - 1));
    for (const o of now.get(blockId) ?? []) m.set(o, (m.get(o) ?? 0) + 1);
    await ctx.db.patch(row._id, { picks: [...m].filter(([, n]) => n > 0).map(([option, n]) => ({ option, n })) });
  }
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
