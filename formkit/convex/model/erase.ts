import type { Doc } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { internal } from "../_generated/api";
import { purgeFormData } from "./forms";

/**
 * Everything a person's account holds, erased: their forms and everything
 * under them, their companies, team places, keys, connections, domains,
 * messages, sessions and sign-in methods, then the account itself.
 *
 * Kept, because the law or the business needs them: staff audit-log lines,
 * and billing records (orders), which lose the email address. Comments the
 * person left on other people's forms stay with those forms.
 *
 * Used by the 30-day purge after someone deletes their own account, and by
 * staff deleting an account. Billing is ended separately, as an action
 * (billing.endForDeletion), when the deletion is asked for.
 */
export async function eraseUser(ctx: MutationCtx, user: Doc<"users">) {
  const userId = user._id;

  const forms = await ctx.db
    .query("forms")
    .withIndex("by_owner", (q) => q.eq("ownerId", userId))
    .collect();
  for (const f of forms) await purgeFormData(ctx, f);

  const companies = await ctx.db
    .query("companies")
    .withIndex("by_owner", (q) => q.eq("ownerId", userId))
    .collect();
  const spaces = [`me:${userId}`, ...companies.map((c) => c._id as string)];
  for (const c of companies) {
    if (c.logoId) await ctx.storage.delete(c.logoId).catch(() => undefined);
    if (c.markId) await ctx.storage.delete(c.markId).catch(() => undefined);
    await ctx.db.delete(c._id);
  }
  for (const space of spaces) {
    for (const row of await ctx.db.query("aiAllowance").withIndex("by_space_period", (q) => q.eq("space", space)).collect()) {
      await ctx.db.delete(row._id);
    }
    for (const row of await ctx.db.query("aiCredits").withIndex("by_space", (q) => q.eq("space", space)).collect()) {
      await ctx.db.delete(row._id);
    }
    for (const row of await ctx.db.query("planGrants").withIndex("by_space", (q) => q.eq("space", space)).collect()) {
      await ctx.db.delete(row._id);
    }
  }

  // Custom domains come off the Vercel project as well as out of the table.
  for (const d of await ctx.db.query("domains").withIndex("by_owner", (q) => q.eq("ownerId", userId)).collect()) {
    await ctx.scheduler.runAfter(0, internal.domains.detach, { host: d.host });
    await ctx.db.delete(d._id);
  }

  const byOwner = [
    ["templates", "by_owner"],
    ["teamMembers", "by_owner"],
    ["apiKeys", "by_owner"],
    ["paymentAccounts", "by_owner"],
    ["emailDomains", "by_owner"],
  ] as const;
  for (const [table, index] of byOwner) {
    const rows = await ctx.db
      .query(table)
      .withIndex(index, (q) => q.eq("ownerId", userId))
      .collect();
    for (const row of rows) await ctx.db.delete(row._id);
  }
  // Apps the person connected stop working with the account.
  for (const row of await ctx.db.query("oauthTokens").withIndex("by_user", (q) => q.eq("userId", userId)).collect()) {
    await ctx.db.delete(row._id);
  }
  for (const row of await ctx.db.query("people").withIndex("by_owner_key", (q) => q.eq("ownerId", userId)).collect()) {
    await ctx.db.delete(row._id);
  }
  for (const row of await ctx.db.query("accountAudit").withIndex("by_owner_at", (q) => q.eq("ownerId", userId)).collect()) {
    await ctx.db.delete(row._id);
  }

  const byUser = [
    ["handles", "by_user"],
    ["emailLog", "by_user"],
    ["sessionInfo", "by_user"],
    ["announcementReads", "by_user"],
    ["activity", "by_user"],
    ["aiAccess", "by_user"],
    ["billingEvents", "by_user"],
    ["teamMembers", "by_user"],
  ] as const;
  for (const [table, index] of byUser) {
    const rows = await ctx.db
      .query(table)
      .withIndex(index, (q) => q.eq("userId", userId))
      .collect();
    for (const row of rows) await ctx.db.delete(row._id);
  }
  for (const row of await ctx.db.query("exports").withIndex("by_user_at", (q) => q.eq("userId", userId)).collect()) {
    await ctx.db.delete(row._id);
  }
  for (const row of await ctx.db.query("inbox").withIndex("by_user_at", (q) => q.eq("userId", userId)).collect()) {
    await ctx.db.delete(row._id);
  }
  for (const row of await ctx.db.query("tickets").withIndex("by_user_opened", (q) => q.eq("userId", userId)).collect()) {
    await ctx.db.delete(row._id);
  }
  // Places on other people's forms.
  if (user.email) {
    for (const row of await ctx.db.query("collaborators").withIndex("by_email", (q) => q.eq("email", user.email!)).collect()) {
      await ctx.db.delete(row._id);
    }
  }
  // Orders are bookkeeping: kept, without the address.
  for (const row of await ctx.db.query("polarOrders").filter((q) => q.eq(q.field("userId"), userId)).collect()) {
    await ctx.db.patch(row._id, { userId: undefined, email: undefined });
  }

  for (const s of await ctx.db.query("authSessions").withIndex("userId", (q) => q.eq("userId", userId)).collect()) {
    for (const t of await ctx.db.query("authRefreshTokens").withIndex("sessionId", (q) => q.eq("sessionId", s._id)).collect()) {
      await ctx.db.delete(t._id);
    }
    await ctx.db.delete(s._id);
  }
  for (const a of await ctx.db.query("authAccounts").withIndex("userIdAndProvider", (q) => q.eq("userId", userId)).collect()) {
    for (const c of await ctx.db.query("authVerificationCodes").withIndex("accountId", (q) => q.eq("accountId", a._id)).collect()) {
      await ctx.db.delete(c._id);
    }
    await ctx.db.delete(a._id);
  }
  if (user.avatarId) await ctx.storage.delete(user.avatarId).catch(() => undefined);
  await ctx.db.delete(userId);
  return { forms: forms.length };
}

