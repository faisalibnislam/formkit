import { Doc, Id } from "../_generated/dataModel";
import { MutationCtx, QueryCtx } from "../_generated/server";
import { requireUser } from "./identity";

/** Turns a title into the slug half of a public link. */
export function slugify(title: string) {
  const base = title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
  return base || "untitled-form";
}

export async function uniqueSlug(ctx: MutationCtx, title: string) {
  const base = slugify(title);
  let candidate = base;
  for (let n = 2; n < 200; n++) {
    const clash = await ctx.db
      .query("forms")
      .withIndex("by_slug", (q) => q.eq("slug", candidate))
      .first();
    if (!clash) return candidate;
    candidate = `${base}-${n}`;
  }
  return `${base}-${Date.now()}`;
}

/**
 * The form, if the signed-in person may act on it.
 *
 * An Editor edits the form *and* reads its responses from their own account, so
 * they pass `write`. A Commenter or Viewer reads only.
 */
export async function formFor(
  ctx: QueryCtx | MutationCtx,
  formId: Id<"forms">,
  need: "read" | "write" = "write",
): Promise<Doc<"forms">> {
  const user = await requireUser(ctx);
  const form = await ctx.db.get(formId);
  if (!form) throw new Error("That form no longer exists.");
  if (form.ownerId === user._id) return form;

  const share = await ctx.db
    .query("collaborators")
    .withIndex("by_form", (q) => q.eq("formId", formId))
    .filter((q) => q.eq(q.field("userId"), user._id))
    .first();

  if (!share || share.status !== "active") throw new Error("You do not have access to that form.");
  if (need === "write" && share.role !== "editor") {
    throw new Error("Your role on this form is read-only.");
  }
  return form;
}

/**
 * Every mutation must refuse while a support view is open.
 *
 * `Formkit Main App?viewAs=…` shows staff a customer's dashboard read-only. The
 * flag lives on the request, not the document, so the guard is a parameter the
 * client passes and the server re-checks against the staff role.
 */
export async function refuseIfSupport(ctx: MutationCtx, supportView: boolean | undefined) {
  if (!supportView) return;
  const user = await requireUser(ctx);
  if (user.staffRole) throw new Error("The support view is read-only.");
}

/** Completion rate, recomputed from what is actually stored. */
export function completionRate(form: Doc<"forms">) {
  if (!form.responsesCount) return 0;
  return Math.round((form.completedCount / form.responsesCount) * 1000) / 10;
}

/** A closing rule that has elapsed flips the form to closed on the next read. */
export function shouldAutoClose(form: Doc<"forms">, now: number) {
  if (form.status !== "published" || !form.closing) return false;
  if (form.closing.closeAt && form.closing.closeAt <= now) return true;
  if (form.closing.closeAfter && form.responsesCount >= form.closing.closeAfter) return true;
  return false;
}

/**
 * A question as a template or a version stores it — everything but the
 * identity fields, which are re-made when it is inserted back into a form.
 */
export type StoredBlock = Omit<Doc<"blocks">, "_id" | "_creationTime" | "formId" | "order">;

/** Strips the system and ownership fields off a stored question. */
export function storedBlock(value: unknown): StoredBlock {
  const { _id, _creationTime, formId, order, ...rest } = value as Doc<"blocks">;
  return { ...rest, kind: rest.kind ?? "field" };
}
