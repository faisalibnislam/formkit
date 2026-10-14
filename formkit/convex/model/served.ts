import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { recount, storedBlock } from "./forms";

/**
 * What respondents see is the published version, not the builder's draft.
 *
 * Publishing freezes a full snapshot of the form into `versions`: its
 * questions and pages, its logic rules, and the content around them (the
 * keys in CONTENT below). The live form, uploads, submissions, AI logic and
 * quiz marking all read that snapshot through `servedForm`, so editing a
 * published form changes nothing for respondents until it is published
 * again - which is also when Business approvals apply.
 *
 * Settings that are about running the form rather than what it asks take
 * effect at once and are not snapshotted: security (password, spam,
 * one response each), closing rules, notifications and AI reply.
 *
 * A form published before snapshots existed has no `rules` on its live
 * version; it is served from the builder's tables, as it always was, until
 * `snapshotLiveForms` (a cron) freezes what it shows right now.
 */

export const CONTENT = ["title", "welcome", "thanks", "endings", "quiz", "theme", "payment", "calc"] as const;
export type ContentKey = (typeof CONTENT)[number];
export type Content = Partial<Pick<Doc<"forms">, ContentKey>>;

export type Served = {
  /** The form, with its content as published (everything else as it is now). */
  form: Doc<"forms">;
  blocks: Doc<"blocks">[];
  rules: Doc<"logicRules">[];
  /** The version being served, or null for the draft. */
  version: number | null;
};

export function contentOf(form: Doc<"forms">): Content {
  const out: Record<string, unknown> = {};
  for (const k of CONTENT) out[k] = form[k];
  return out as Content;
}

async function draftOf(ctx: QueryCtx | MutationCtx, formId: Id<"forms">) {
  const blocks = (
    await ctx.db
      .query("blocks")
      .withIndex("by_form_order", (q) => q.eq("formId", formId))
      .collect()
  ).sort((a, b) => a.order - b.order);
  const rules = (
    await ctx.db
      .query("logicRules")
      .withIndex("by_form", (q) => q.eq("formId", formId))
      .collect()
  ).sort((a, b) => a.order - b.order);
  return { blocks, rules };
}

/** The draft as it stands, ready to store as a version. */
export async function snapshotOf(ctx: QueryCtx | MutationCtx, form: Doc<"forms">) {
  const { blocks, rules } = await draftOf(ctx, form._id);
  return { blocks, rules, content: contentOf(form) };
}

/** The live version's row, when it holds a full snapshot. */
async function liveSnapshot(ctx: QueryCtx | MutationCtx, form: Doc<"forms">) {
  if (!form.liveVersion) return null;
  const row = await ctx.db
    .query("versions")
    .withIndex("by_form", (q) => q.eq("formId", form._id).eq("number", form.liveVersion!))
    .unique();
  return row?.rules ? row : null;
}

/**
 * The form as respondents get it. `draft` is for the builder's preview (and
 * a preview submission), which always shows what is being edited.
 */
export async function servedForm(
  ctx: QueryCtx | MutationCtx,
  form: Doc<"forms">,
  opts: { draft?: boolean } = {},
): Promise<Served> {
  const snap = opts.draft ? null : await liveSnapshot(ctx, form);
  if (snap) {
    return {
      form: { ...form, ...((snap.content ?? {}) as Content) },
      blocks: (snap.blocks as Doc<"blocks">[]).slice().sort((a, b) => a.order - b.order),
      rules: (snap.rules as Doc<"logicRules">[]).slice().sort((a, b) => a.order - b.order),
      version: snap.number,
    };
  }
  const { blocks, rules } = await draftOf(ctx, form._id);
  return { form, blocks, rules, version: null };
}

/** Whether a form's live version is a full snapshot yet. */
export async function isSnapshotted(ctx: QueryCtx | MutationCtx, form: Doc<"forms">) {
  return !!(await liveSnapshot(ctx, form));
}

/**
 * Puts a version back into the builder's draft. Questions keep their ids
 * where they still exist (so answers already given stay attached, and rules
 * keep pointing at them); one that was deleted since comes back with a new
 * id, and every reference to it in the snapshot is moved over.
 */
export async function applyToDraft(
  ctx: MutationCtx,
  form: Doc<"forms">,
  snap: { blocks: unknown[]; rules?: unknown[] | null; content?: unknown },
) {
  const { blocks: current, rules: currentRules } = await draftOf(ctx, form._id);
  const existing = new Set(current.map((b) => b._id as string));
  const kept = new Set<string>();
  const moved = new Map<string, string>();

  const ordered = (snap.blocks as Doc<"blocks">[]).slice().sort((a, b) => a.order - b.order);
  for (const [i, b] of ordered.entries()) {
    if (existing.has(b._id)) {
      await ctx.db.replace(b._id, { ...storedBlock(b), formId: form._id, order: i });
      kept.add(b._id);
    } else {
      const id = await ctx.db.insert("blocks", { ...storedBlock(b), formId: form._id, order: i });
      moved.set(b._id, id);
      kept.add(id);
    }
  }
  for (const b of current) if (!kept.has(b._id)) await ctx.db.delete(b._id);

  // Old ids to new, wherever a snapshot names a question.
  const remap = <T>(value: T): T => {
    if (!moved.size) return value;
    let text = JSON.stringify(value);
    for (const [from, to] of moved) text = text.split(from).join(to);
    return JSON.parse(text) as T;
  };
  if (moved.size) {
    for (const id of moved.values()) {
      const b = await ctx.db.get(id as Id<"blocks">);
      if (b?.extract) await ctx.db.patch(b._id, { extract: remap(b.extract) });
    }
  }

  if (snap.rules) {
    for (const r of currentRules) await ctx.db.delete(r._id);
    for (const r of snap.rules as Doc<"logicRules">[]) {
      const { _id, _creationTime, ...rest } = remap(r);
      void _id;
      void _creationTime;
      await ctx.db.insert("logicRules", { ...rest, formId: form._id });
    }
  }
  if (snap.content) {
    const content = remap(snap.content as Content);
    const patch: Record<string, unknown> = {};
    for (const k of CONTENT) patch[k] = content[k];
    await ctx.db.patch(form._id, patch as Partial<Doc<"forms">>);
  }
  await recount(ctx, form._id);
}
