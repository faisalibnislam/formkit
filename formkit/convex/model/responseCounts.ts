import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";

type Counted = Pick<Doc<"responses">, "partial" | "preview">;

/** What one response adds to its form's totals: previews count for nothing. */
function weight(r: Counted | null) {
  if (!r || r.preview) return { responses: 0, completed: 0 };
  return { responses: 1, completed: r.partial ? 0 : 1 };
}

/**
 * Moves a form's responsesCount and completedCount by one response going
 * from `before` to `after` (either may be null: added, or deleted). A
 * partial finished later moves Completed only.
 */
export async function countChange(
  ctx: MutationCtx,
  formId: Id<"forms">,
  before: Counted | null,
  after: Counted | null,
) {
  const was = weight(before);
  const now = weight(after);
  const responses = now.responses - was.responses;
  const completed = now.completed - was.completed;
  if (!responses && !completed) return;
  const form = await ctx.db.get(formId);
  if (!form) return;
  await ctx.db.patch(formId, {
    responsesCount: Math.max(0, form.responsesCount + responses),
    completedCount: Math.max(0, form.completedCount + completed),
  });
}
