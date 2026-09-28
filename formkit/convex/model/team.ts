import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { currentUser } from "./identity";
import { hasFeature } from "./plans";

/**
 * Business teams. A member works on every one of the owner's forms, as an
 * Admin (who also runs the team and approves forms), an Editor or a Viewer.
 * All of it follows the owner's plan: if Business lapses, members keep
 * nothing but the forms they were invited to one by one.
 */

export type TeamRole = "admin" | "editor" | "viewer";

export async function membershipOf(ctx: QueryCtx, ownerId: Id<"users">, userId: Id<"users">) {
  if (ownerId === userId) return null;
  const row = await ctx.db
    .query("teamMembers")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .filter((q) => q.eq(q.field("ownerId"), ownerId))
    .first();
  if (!row || row.status !== "active") return null;
  if (!(await hasFeature(ctx, ownerId, "team"))) return null;
  return row;
}

export async function teamRoleOf(ctx: QueryCtx, ownerId: Id<"users">, userId: Id<"users">): Promise<TeamRole | null> {
  return (await membershipOf(ctx, ownerId, userId))?.role ?? null;
}

/** The accounts whose teams this person is on, and in which role. */
export async function teamsOf(ctx: QueryCtx, userId: Id<"users">) {
  const rows = await ctx.db
    .query("teamMembers")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .collect();
  const out: { row: Doc<"teamMembers">; owner: Doc<"users"> }[] = [];
  for (const row of rows) {
    if (row.status !== "active") continue;
    const owner = await ctx.db.get(row.ownerId);
    if (owner && !owner.deactivatedAt && (await hasFeature(ctx, owner, "team"))) out.push({ row, owner });
  }
  return out;
}

/** Whether this person runs the account: its owner, or an admin on its team. */
export async function managesAccount(ctx: QueryCtx, ownerId: Id<"users">, userId: Id<"users">) {
  return ownerId === userId || (await teamRoleOf(ctx, ownerId, userId)) === "admin";
}

/** Business: one line in the account's audit log. */
export async function audit(
  ctx: MutationCtx,
  ownerId: Id<"users">,
  actor: Doc<"users"> | null,
  action: string,
  subject?: string,
) {
  if (!(await hasFeature(ctx, ownerId, "audit"))) return;
  await ctx.db.insert("accountAudit", {
    ownerId,
    actorId: actor?._id,
    actorName: actor ? (actor.name ?? actor.email ?? "Someone") : "Formkit",
    action,
    subject: subject?.slice(0, 200),
    at: Date.now(),
  });
}

/**
 * Business approvals: with them on, anyone but the owner and the team's
 * admins asks before a form goes live.
 */
export async function needsApproval(ctx: QueryCtx, form: Doc<"forms">, userId: Id<"users">) {
  const owner = await ctx.db.get(form.ownerId);
  if (!owner?.approvals || !(await hasFeature(ctx, owner, "approvals"))) return false;
  return !(await managesAccount(ctx, form.ownerId, userId));
}

/** What the builder shows about approval, for the person looking. */
export async function approvalView(ctx: QueryCtx, form: Doc<"forms">) {
  const me = await currentUser(ctx);
  if (!me) return null;
  const required = await needsApproval(ctx, form, me._id);
  const canApprove = await managesAccount(ctx, form.ownerId, me._id);
  const a = form.approval;
  const by = a ? await ctx.db.get(a.by) : null;
  return {
    required,
    canApprove,
    state: a?.state ?? null,
    by: by ? (by.name ?? by.email ?? "Someone") : null,
    mine: a ? a.by === me._id : false,
    at: a?.at ?? null,
    note: a?.note ?? null,
  };
}

/** The owner and the team's admins: who approves, and who hears about the account. */
export async function accountManagers(ctx: QueryCtx, ownerId: Id<"users">) {
  const admins = (
    await ctx.db
      .query("teamMembers")
      .withIndex("by_owner", (q) => q.eq("ownerId", ownerId))
      .collect()
  )
    .filter((r) => r.status === "active" && r.role === "admin" && r.userId)
    .map((r) => r.userId!);
  return [ownerId, ...admins];
}

/** Business: a template shared on one of this person's teams, by its slug. */
export async function teamTemplate(ctx: QueryCtx, slug: string, userId: Id<"users">) {
  const rows = await ctx.db
    .query("templates")
    .withIndex("by_slug", (q) => q.eq("slug", slug))
    .collect();
  for (const t of rows) {
    if (t.shared && t.ownerId && (await teamRoleOf(ctx, t.ownerId, userId))) return t;
  }
  return null;
}
