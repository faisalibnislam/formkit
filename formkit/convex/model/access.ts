import { Doc, Id } from "../_generated/dataModel";
import { MutationCtx, QueryCtx } from "../_generated/server";
import { requireUser } from "./identity";

export type Role = "owner" | "editor" | "commenter" | "viewer";

/**
 * What the signed-in person may do on a form. The owner can do everything;
 * an Editor edits and reads responses; a Commenter comments; a Viewer reads.
 */
export async function accessOf(
  ctx: QueryCtx | MutationCtx,
  formId: Id<"forms">,
): Promise<{ form: Doc<"forms">; user: Doc<"users">; role: Role }> {
  const user = await requireUser(ctx);
  const form = await ctx.db.get(formId);
  if (!form) throw new Error("That form no longer exists.");
  if (form.ownerId === user._id) return { form, user, role: "owner" };
  const share = await ctx.db
    .query("collaborators")
    .withIndex("by_form", (q) => q.eq("formId", formId))
    .filter((q) => q.eq(q.field("userId"), user._id))
    .first();
  if (!share || share.status !== "active") throw new Error("You do not have access to that form.");
  return { form, user, role: share.role };
}

export function canComment(role: Role) {
  return role !== "viewer";
}

/** A steady colour per person, so an avatar reads the same everywhere. */
const PALETTE = ["#2e78bb", "#4b9d6e", "#c98a1e", "#c4614f", "#6b8f9c", "#7a5480", "#337c38"];
export function colourFor(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length]!;
}

export async function logActivity(
  ctx: MutationCtx,
  formId: Id<"forms">,
  userId: Id<"users">,
  what: string,
  icon?: string,
) {
  await ctx.db.insert("activity", { formId, userId, what, icon, at: Date.now() });
}

export function token(bytes = 18) {
  const b = new Uint8Array(bytes);
  crypto.getRandomValues(b);
  return Array.from(b, (x) => x.toString(36).padStart(2, "0")).join("").slice(0, bytes * 2);
}
