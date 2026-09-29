import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { planOf, planOfSpace, planSummary, type PlanId, type SpaceRef } from "./plans";

/**
 * Companies: the workspaces everything lives in.
 *
 * Every account has a personal company (its forms carry brand "me") and can
 * make as many more as it likes. A company is its owner plus that brand, so a
 * form's company is simply `{ ownerId, brand }` - the rows stored before
 * companies were workspaces need nothing moved.
 *
 * Members (teamMembers rows with the company's id, or none for the personal
 * company) work on every form in it. On a paid plan each member, the owner
 * included, is a seat. People invited to a single form are guests: free, and
 * not members.
 */

export type Role = "owner" | "admin" | "editor" | "viewer";

/** A company's key: "me:<ownerId>" for a personal company, or the company's id. */
export function spaceKey(space: SpaceRef) {
  return space.brand === "me" ? `me:${space.ownerId}` : (space.brand as string);
}

export const spaceOfForm = (form: Pick<Doc<"forms">, "ownerId" | "brand">): SpaceRef => ({
  ownerId: form.ownerId,
  brand: form.brand,
});

export const personalSpace = (userId: Id<"users">): SpaceRef => ({ ownerId: userId, brand: "me" });

/** The company a key names, if it still exists. */
export async function resolveSpace(ctx: QueryCtx | MutationCtx, key: string | null | undefined): Promise<SpaceRef | null> {
  if (!key) return null;
  if (key.startsWith("me:")) {
    const id = ctx.db.normalizeId("users", key.slice(3));
    return id && (await ctx.db.get(id)) ? personalSpace(id) : null;
  }
  const id = ctx.db.normalizeId("companies", key);
  const company = id ? await ctx.db.get(id) : null;
  return company ? { ownerId: company.ownerId, brand: company._id } : null;
}

/** The membership row that makes someone a member of a company, if any. */
export async function membershipIn(ctx: QueryCtx | MutationCtx, space: SpaceRef, userId: Id<"users">) {
  const rows = await ctx.db
    .query("teamMembers")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .collect();
  return (
    rows.find(
      (r) =>
        r.status === "active" &&
        r.ownerId === space.ownerId &&
        (r.companyId ?? "me") === space.brand,
    ) ?? null
  );
}

/** Someone's role in a company, or null when they are not a member. */
export async function roleIn(ctx: QueryCtx | MutationCtx, space: SpaceRef, userId: Id<"users">): Promise<Role | null> {
  if (space.ownerId === userId) return "owner";
  return (await membershipIn(ctx, space, userId))?.role ?? null;
}

/** Owners and admins run a company: members, plan, billing and settings. */
export const canManage = (role: Role | null) => role === "owner" || role === "admin";

/** Every member of a company, the owner first. */
export async function membersOf(ctx: QueryCtx | MutationCtx, space: SpaceRef) {
  const rows =
    space.brand === "me"
      ? (
          await ctx.db
            .query("teamMembers")
            .withIndex("by_owner", (q) => q.eq("ownerId", space.ownerId))
            .collect()
        ).filter((r) => !r.companyId)
      : await ctx.db
          .query("teamMembers")
          .withIndex("by_company", (q) => q.eq("companyId", space.brand as Id<"companies">))
          .collect();
  return rows;
}

/** Seats: the owner plus every active member. Pending invites are not seats until accepted. */
export async function seatsOf(ctx: QueryCtx | MutationCtx, space: SpaceRef) {
  return 1 + (await membersOf(ctx, space)).filter((r) => r.status === "active").length;
}

/** The company the app is showing this person: the one they picked, or their own. */
export async function currentSpace(ctx: QueryCtx | MutationCtx, user: Doc<"users">): Promise<SpaceRef> {
  const picked = await resolveSpace(ctx, user.space);
  if (picked && (await roleIn(ctx, picked, user._id))) return picked;
  return personalSpace(user._id);
}

/** A company's name and marks, as the switcher and lists show them. */
export async function spaceIdentity(ctx: QueryCtx | MutationCtx, space: SpaceRef) {
  if (space.brand === "me") {
    const owner = await ctx.db.get(space.ownerId);
    return {
      kind: "me" as const,
      name: owner?.name?.trim() || owner?.email || "Personal",
      imageUrl: owner?.avatarId ? await ctx.storage.getUrl(owner.avatarId) : (owner?.image ?? null),
      handle: owner?.handle ?? null,
    };
  }
  const company = await ctx.db.get(space.brand);
  return {
    kind: "company" as const,
    name: company?.name ?? "A company",
    imageUrl: company?.markId
      ? await ctx.storage.getUrl(company.markId)
      : company?.logoId
        ? await ctx.storage.getUrl(company.logoId)
        : null,
    handle: company?.handle ?? null,
  };
}

/** A company's plan, seats and features, for the app. */
export async function spacePlan(ctx: QueryCtx | MutationCtx, space: SpaceRef) {
  const id = await planOfSpace(ctx, space);
  const owner = await ctx.db.get(space.ownerId);
  const seats = await seatsOf(ctx, space);
  if (space.brand === "me") return planSummary(id, owner, seats, !!owner?.polarSubscriptionId);
  const company = await ctx.db.get(space.brand);
  // A grandfathered company shows its owner's account-wide subscription.
  const own = !!(company?.plan || company?.planComp);
  return planSummary(
    id,
    own ? (company ?? null) : owner,
    seats,
    own ? !!company?.polarSubscriptionId : !!owner?.polarSubscriptionId,
  );
}

/** Every company someone can open: their own, the ones they made, the ones they are a member of. */
export async function spacesOf(ctx: QueryCtx | MutationCtx, user: Doc<"users">) {
  const out: { space: SpaceRef; role: Role }[] = [{ space: personalSpace(user._id), role: "owner" }];
  const owned = await ctx.db
    .query("companies")
    .withIndex("by_owner", (q) => q.eq("ownerId", user._id))
    .collect();
  for (const c of owned) out.push({ space: { ownerId: user._id, brand: c._id }, role: "owner" });
  const memberships = await ctx.db
    .query("teamMembers")
    .withIndex("by_user", (q) => q.eq("userId", user._id))
    .collect();
  for (const m of memberships) {
    if (m.status !== "active") continue;
    const owner = await ctx.db.get(m.ownerId);
    if (!owner || owner.deactivatedAt) continue;
    if (m.companyId && !(await ctx.db.get(m.companyId))) continue;
    out.push({ space: { ownerId: m.ownerId, brand: m.companyId ?? "me" }, role: m.role });
  }
  return out;
}

/** Every form in a company, the deleted ones included. */
export async function spaceForms(ctx: QueryCtx | MutationCtx, space: SpaceRef) {
  return (
    await ctx.db
      .query("forms")
      .withIndex("by_owner", (q) => q.eq("ownerId", space.ownerId))
      .collect()
  ).filter((f) => f.brand === space.brand);
}

/** The plan id alone, for places that only branch on it. */
export async function spacePlanId(ctx: QueryCtx | MutationCtx, space: SpaceRef): Promise<PlanId> {
  return planOfSpace(ctx, space);
}

export { planOf };
