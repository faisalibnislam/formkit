import { ConvexError, v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { requireUser } from "./model/identity";
import { formFor } from "./model/forms";
import { canManage, currentSpace, roleIn, spaceOfForm } from "./model/spaces";
import type { SpaceRef } from "./model/plans";
import { BUILT_IN, DEFAULT_STATUSES, MAX_STATUSES, TONES, keyFor, statusRow, statusesOf, type Status, type Tone } from "./model/statuses";

/** The space a status list belongs to: a form's company, or the one being worked in. */
async function spaceFor(ctx: Parameters<typeof requireUser>[0], formId?: Id<"forms">): Promise<SpaceRef> {
  if (formId) return spaceOfForm(await formFor(ctx, formId, "read"));
  return currentSpace(ctx, await requireUser(ctx));
}

export const list = query({
  args: { formId: v.optional(v.id("forms")) },
  handler: async (ctx, { formId }) => {
    const user = await requireUser(ctx);
    const space = await spaceFor(ctx, formId);
    return { statuses: await statusesOf(ctx, space), canEdit: canManage(await roleIn(ctx, space, user._id)) };
  },
});

/**
 * Replaces a company's statuses. New ones arrive without a key and are given
 * one; any taken away say where their responses go (`moves`), and those
 * responses are moved over in batches. Owners and admins only.
 */
export const save = mutation({
  args: {
    formId: v.optional(v.id("forms")),
    statuses: v.array(v.object({ key: v.optional(v.string()), label: v.string(), tone: v.string() })),
    moves: v.optional(v.array(v.object({ from: v.string(), to: v.string() }))),
  },
  returns: v.null(),
  handler: async (ctx, { formId, statuses, moves = [] }) => {
    const user = await requireUser(ctx);
    const space = await spaceFor(ctx, formId);
    if (!canManage(await roleIn(ctx, space, user._id))) throw new ConvexError("Only the company's owner and admins change its statuses.");
    const before = await statusesOf(ctx, space);
    const taken = new Set(statuses.map((s) => s.key).filter((k): k is string => !!k));
    const next: Status[] = [];
    for (const s of statuses.slice(0, MAX_STATUSES + 1)) {
      const label = s.label.trim().replace(/\s+/g, " ").slice(0, 24);
      if (!label) throw new ConvexError("Every status needs a name.");
      if (next.some((x) => x.label.toLowerCase() === label.toLowerCase())) throw new ConvexError(`Two statuses are called “${label}”.`);
      const tone = (TONES as readonly string[]).includes(s.tone) ? (s.tone as Tone) : "neutral";
      let key = s.key;
      if (!key || !before.some((b) => b.key === key)) {
        key = keyFor(label, new Set([...taken, ...next.map((x) => x.key)]));
      }
      taken.add(key);
      next.push({ key, label, tone });
    }
    if (next.length > MAX_STATUSES) throw new ConvexError(`Twelve statuses is the most.`);
    for (const k of BUILT_IN) if (!next.some((s) => s.key === k)) throw new ConvexError("New and Read can be renamed, but not taken away.");

    // Whatever is taken away has to go somewhere that stays.
    const gone = before.filter((b) => !next.some((s) => s.key === b.key)).map((b) => b.key);
    for (const from of gone) {
      const to = moves.find((m) => m.from === from)?.to ?? "read";
      if (!next.some((s) => s.key === to)) throw new ConvexError("Move its responses to a status that is staying.");
      await ctx.scheduler.runAfter(0, internal.statuses.move, { ownerId: space.ownerId, brand: space.brand === "me" ? "me" : String(space.brand), from, to });
    }

    const row = await statusRow(ctx, space);
    const brand = space.brand === "me" ? "me" : String(space.brand);
    if (row) await ctx.db.patch(row._id, { list: next, updatedAt: Date.now() });
    else await ctx.db.insert("responseStatuses", { ownerId: space.ownerId, brand, list: next, updatedAt: Date.now() });
    return null;
  },
});

/** Moves a company's responses off a status that was taken away, a page at a time. */
export const move = internalMutation({
  args: { ownerId: v.id("users"), brand: v.string(), from: v.string(), to: v.string(), cursor: v.optional(v.union(v.string(), v.null())) },
  returns: v.null(),
  handler: async (ctx, a) => {
    const page = await ctx.db
      .query("responses")
      .withIndex("by_owner_status", (q) => q.eq("ownerId", a.ownerId).eq("status", a.from))
      .paginate({ cursor: a.cursor ?? null, numItems: 300 });
    const brands = new Map<string, string>();
    for (const r of page.page) {
      if (!brands.has(r.formId)) {
        const f = await ctx.db.get(r.formId);
        brands.set(r.formId, f ? (f.brand === "me" ? "me" : String(f.brand)) : "");
      }
      // The same owner's other companies can use the same key; only this one's move.
      if (brands.get(r.formId) === a.brand) await ctx.db.patch(r._id, { status: a.to });
    }
    if (!page.isDone) await ctx.scheduler.runAfter(0, internal.statuses.move, { ...a, cursor: page.continueCursor });
    return null;
  },
});

export { DEFAULT_STATUSES };
