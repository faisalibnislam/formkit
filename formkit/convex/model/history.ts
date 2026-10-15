import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { currentUser } from "./identity";
import { applyToDraft, draftOf } from "./served";

/**
 * Undo and redo for the builder: questions, their options, pages and logic.
 *
 * Every change to those calls `remember` first, which keeps the draft as it
 * was. Undo puts the newest one back (through applyToDraft, so questions keep
 * their ids and answers stay attached) and keeps what it replaced for Redo.
 * A run of the same small change - typing a title - is one step.
 *
 * Undo puts back the whole of the questions and logic, so it only goes when
 * the newest change is your own: undoing over a collaborator's edit would
 * quietly throw theirs away.
 */

export const HISTORY_LIMIT = 40;
/** Edits with the same key closer together than this are one step. */
export const MERGE_MS = 4000;

type Kind = "undo" | "redo";

async function newest(ctx: MutationCtx, formId: Id<"forms">, kind: Kind) {
  return await ctx.db
    .query("draftHistory")
    .withIndex("by_form_kind_at", (q) => q.eq("formId", formId).eq("kind", kind))
    .order("desc")
    .first();
}

async function keep(ctx: MutationCtx, formId: Id<"forms">, kind: Kind, entry: { userId?: Id<"users">; label: string; key?: string }) {
  const { blocks, rules } = await draftOf(ctx, formId);
  await ctx.db.insert("draftHistory", { formId, kind, ...entry, at: Date.now(), blocks, rules });
}

/** Call before a change to a draft's questions, pages or logic. */
export async function remember(
  ctx: MutationCtx,
  formId: Id<"forms">,
  label: string,
  opts: { key?: string; userId?: Id<"users"> } = {},
) {
  const userId = opts.userId ?? (await currentUser(ctx))?._id;
  const last = await newest(ctx, formId, "undo");
  const redo = await ctx.db
    .query("draftHistory")
    .withIndex("by_form_kind_at", (q) => q.eq("formId", formId).eq("kind", "redo"))
    .take(HISTORY_LIMIT + 1);
  // A new change ends whatever could be redone.
  for (const r of redo) await ctx.db.delete(r._id);

  if (last && opts.key && last.key === opts.key && last.userId === userId && Date.now() - last.at < MERGE_MS && !redo.length) {
    await ctx.db.patch(last._id, { at: Date.now() });
    return;
  }
  await keep(ctx, formId, "undo", { userId, label, key: opts.key });

  const old = await ctx.db
    .query("draftHistory")
    .withIndex("by_form_kind_at", (q) => q.eq("formId", formId).eq("kind", "undo"))
    .order("desc")
    .take(HISTORY_LIMIT + 5);
  for (const row of old.slice(HISTORY_LIMIT)) await ctx.db.delete(row._id);
}

/**
 * Takes one step back (undo) or forward (redo). Returns what was undone or
 * redone, for the toast.
 */
export async function step(ctx: MutationCtx, form: Doc<"forms">, userId: Id<"users">, kind: Kind) {
  const entry = await newest(ctx, form._id, kind);
  if (!entry) throw new Error(kind === "undo" ? "There is nothing to undo." : "There is nothing to redo.");
  if (entry.userId !== userId) {
    throw new Error("Someone else changed the form since, so undo would lose their edit.");
  }
  // What is there now becomes the step the other way.
  await keep(ctx, form._id, kind === "undo" ? "redo" : "undo", { userId, label: entry.label });
  await ctx.db.delete(entry._id);
  const moved = await applyToDraft(ctx, form, { blocks: entry.blocks, rules: entry.rules });

  // A question that came back has a new id; the rest of the history follows it.
  if (moved.size) {
    for (const kindToFix of ["undo", "redo"] as const) {
      const rows = await ctx.db
        .query("draftHistory")
        .withIndex("by_form_kind_at", (q) => q.eq("formId", form._id).eq("kind", kindToFix))
        .take(HISTORY_LIMIT + 5);
      for (const row of rows) {
        let text = JSON.stringify({ blocks: row.blocks, rules: row.rules });
        if (![...moved.keys()].some((id) => text.includes(id))) continue;
        for (const [from, to] of moved) text = text.split(from).join(to);
        await ctx.db.patch(row._id, JSON.parse(text) as { blocks: unknown[]; rules: unknown[] });
      }
    }
  }
  await ctx.db.patch(form._id, { updatedAt: Date.now() });
  return entry.label;
}
