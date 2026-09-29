import { getAuthSessionId, getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError } from "convex/values";
import { Doc, Id } from "../_generated/dataModel";
import { MutationCtx, QueryCtx } from "../_generated/server";
import { PLANS, planOfId } from "./plans";

/** The signed-in person, or null. Never throws - callers decide what a guest sees. */
export async function currentUser(ctx: QueryCtx | MutationCtx): Promise<Doc<"users"> | null> {
  const userId = await getAuthUserId(ctx);
  if (userId === null) return null;
  return await ctx.db.get(userId);
}

/**
 * Whether this session has given its two-factor code. Always true for an
 * account without two-factor. Checked in `requireUser`, which every signed-in
 * function goes through, so a session holding only a password reads nothing.
 */
export async function twoFactorPassed(ctx: QueryCtx | MutationCtx, user: Doc<"users">) {
  if (!user.twoFactor) return true;
  const sessionId = await getAuthSessionId(ctx);
  if (!sessionId) return false;
  const info = await ctx.db
    .query("sessionInfo")
    .withIndex("by_session", (q) => q.eq("sessionId", sessionId))
    .first();
  return !!info?.twoFactorAt;
}

/** The signed-in person, or a refusal. Use wherever a guest has no business. */
export async function requireUser(ctx: QueryCtx | MutationCtx): Promise<Doc<"users">> {
  const user = await currentUser(ctx);
  if (!user) throw new Error("Sign in to do that.");
  if (user.deactivatedAt) throw new Error("This account is deactivated. Reactivate it to continue.");
  if (!(await twoFactorPassed(ctx, user))) {
    throw new ConvexError({ code: "2fa", message: "Enter the code from your authenticator app to continue." });
  }
  return user;
}

/**
 * formkit.app/admin is gated by who you are: staff get the console, a signed-in
 * customer is offered their dashboard, a stranger is sent to the marketing site.
 */
export async function requireStaff(
  ctx: QueryCtx | MutationCtx,
  permission?: string,
): Promise<Doc<"users">> {
  const user = await requireUser(ctx);
  if (!user.staffRole) throw new Error("That is staff-only.");
  if (permission && user.staffRole !== "owner") {
    const allowed = await staffPermissions(ctx, user);
    if (!allowed.includes(permission)) {
      throw new Error(`Your role does not include "${permission}".`);
    }
  }
  return user;
}

export const PERMS = [
  "users.view",
  "users.suspend",
  "users.delete",
  "ai.access",
  "moderation",
  "support",
  "announcements",
  "flags",
  "billing",
  "team",
] as const;

export const ROLE_DEFAULTS: Record<string, string[]> = {
  owner: [...PERMS],
  admin: PERMS.filter((p) => p !== "team"),
  support: ["users.view", "support"],
};

/**
 * Two layers: `rolePerms` sets what a role can do, and a per-person override
 * snapshots the role grant at the moment of the first change - once somebody is
 * customised, later role changes no longer reach them.
 */
export async function staffPermissions(
  ctx: QueryCtx | MutationCtx,
  user: Doc<"users">,
): Promise<string[]> {
  if (user.staffRole === "owner") return [...PERMS];
  const override = await platformValue<Record<string, string[]>>(ctx, "staffPerms");
  const mine = override?.[user._id];
  if (mine) return mine;
  const roles = await platformValue<Record<string, string[]>>(ctx, "rolePerms");
  return roles?.[user.staffRole ?? ""] ?? ROLE_DEFAULTS[user.staffRole ?? ""] ?? [];
}

export async function platformValue<T>(
  ctx: QueryCtx | MutationCtx,
  key: string,
): Promise<T | null> {
  const row = await ctx.db
    .query("platform")
    .withIndex("by_key", (q) => q.eq("key", key))
    .unique();
  return (row?.value as T) ?? null;
}

export async function setPlatformValue(ctx: MutationCtx, key: string, value: unknown) {
  const row = await ctx.db
    .query("platform")
    .withIndex("by_key", (q) => q.eq("key", key))
    .unique();
  if (row) await ctx.db.patch(row._id, { value });
  else await ctx.db.insert("platform", { key, value });
}

export async function writeAudit(
  ctx: MutationCtx,
  actor: Doc<"users"> | null,
  action: string,
  subject?: string,
  detail?: string,
) {
  await ctx.db.insert("auditLog", {
    actorId: actor?._id,
    actorName: actor?.name ?? actor?.email ?? "Formkit",
    action,
    subject,
    detail,
    at: Date.now(),
  });
}

/**
 * Ask Formkit is on for every account, with monthly credits set by its plan.
 * Staff can still turn it off for one account (an `aiAccess` row with
 * `enabled: false`), and a platform pause suspends everyone at once.
 */
export async function aiAllowed(ctx: QueryCtx | MutationCtx, userId: Id<"users">) {
  const paused = (await platformValue<boolean>(ctx, "aiPaused")) ?? false;
  if (paused) return false;
  const row = await ctx.db
    .query("aiAccess")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .unique();
  return row?.enabled !== false;
}


