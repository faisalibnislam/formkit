import { ConvexError, v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { requireUser } from "./model/identity";
import { hasFeature, requireFeature } from "./model/plans";
import { audit, managesAccount } from "./model/team";
import { sha256Hex } from "./model/apiKeys";

/**
 * Business controls: the account's audit log, how long responses are kept,
 * and keys for the REST API.
 */

/** The account this person runs: their own, or one they are admin on. */
async function managed(ctx: Parameters<typeof requireUser>[0], ownerId: Id<"users"> | undefined) {
  const me = await requireUser(ctx);
  const target = ownerId ?? me._id;
  if (!(await managesAccount(ctx, target, me._id))) throw new ConvexError("Only the owner or a team admin can see that.");
  return { me, ownerId: target };
}

/* ------------------------------------------------------------------ */
/* Audit log                                                           */
/* ------------------------------------------------------------------ */

export const auditLog = query({
  args: { ownerId: v.optional(v.id("users")), before: v.optional(v.number()) },
  handler: async (ctx, { ownerId, before }) => {
    const { ownerId: owner } = await managed(ctx, ownerId);
    if (!(await hasFeature(ctx, owner, "audit"))) return { enabled: false, rows: [], more: false };
    const rows = await ctx.db
      .query("accountAudit")
      .withIndex("by_owner_at", (q) => (before ? q.eq("ownerId", owner).lt("at", before) : q.eq("ownerId", owner)))
      .order("desc")
      .take(51);
    return {
      enabled: true,
      more: rows.length > 50,
      rows: rows.slice(0, 50).map((r) => ({ _id: r._id, at: r.at, who: r.actorName, action: r.action, subject: r.subject ?? null })),
    };
  },
});

/** Kept for a year. */
export const purgeAudit = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const cutoff = Date.now() - 366 * 86_400_000;
    const old = await ctx.db
      .query("accountAudit")
      .withIndex("by_at", (q) => q.lt("at", cutoff))
      .take(500);
    for (const r of old) await ctx.db.delete(r._id);
    return null;
  },
});

/* ------------------------------------------------------------------ */
/* Data retention                                                      */
/* ------------------------------------------------------------------ */

export const RETENTION_CHOICES = [30, 90, 180, 365, 730];

export const retention = query({
  args: {},
  handler: async (ctx) => {
    const me = await requireUser(ctx);
    return { days: me.retentionDays ?? null, choices: RETENTION_CHOICES };
  },
});

export const setRetention = mutation({
  args: { days: v.union(v.number(), v.null()) },
  returns: v.null(),
  handler: async (ctx, { days }) => {
    const me = await requireUser(ctx);
    if (days !== null) {
      await requireFeature(ctx, me._id, "retention");
      if (!RETENTION_CHOICES.includes(days)) throw new ConvexError("Pick one of the listed periods.");
    }
    await ctx.db.patch(me._id, { retentionDays: days ?? undefined });
    await audit(
      ctx,
      me._id,
      me,
      days ? `Set responses to be erased after ${days} days` : "Turned off automatic erasing of responses",
    );
    return null;
  },
});

/**
 * Hourly: erase responses older than each Business account's retention
 * period, uploaded files with them. A few hundred at a time, so a big account
 * is worked through over a few runs rather than in one heavy one.
 */
export const applyRetention = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const owners = await ctx.db
      .query("users")
      .withIndex("by_retention", (q) => q.gt("retentionDays", 0))
      .take(200);
    let budget = 400;
    for (const owner of owners) {
      if (budget <= 0) break;
      if (!owner.retentionDays || !(await hasFeature(ctx, owner, "retention"))) continue;
      const cutoff = Date.now() - owner.retentionDays * 86_400_000;
      const old = await ctx.db
        .query("responses")
        .withIndex("by_owner_submitted", (q) => q.eq("ownerId", owner._id).lt("submittedAt", cutoff))
        .take(budget);
      if (!old.length) continue;
      const touched = new Set<Id<"forms">>();
      for (const r of old) {
        for (const a of r.answers) {
          if (a.fileId) await ctx.storage.delete(a.fileId).catch(() => {});
        }
        await ctx.db.delete(r._id);
        touched.add(r.formId);
      }
      budget -= old.length;
      for (const formId of touched) await ctx.runMutation(internal.responses.recount, { formId });
      await audit(ctx, owner._id, null, `Erased ${old.length} response${old.length === 1 ? "" : "s"} past the retention period`);
    }
    return null;
  },
});

/* ------------------------------------------------------------------ */
/* API keys                                                            */
/* ------------------------------------------------------------------ */

export const apiKeys = query({
  args: {},
  handler: async (ctx) => {
    const me = await requireUser(ctx);
    const rows = await ctx.db
      .query("apiKeys")
      .withIndex("by_owner", (q) => q.eq("ownerId", me._id))
      .collect();
    return rows
      .sort((a, b) => b.createdAt - a.createdAt)
      .map((k) => ({ _id: k._id, name: k.name, prefix: k.prefix, createdAt: k.createdAt, lastUsedAt: k.lastUsedAt ?? null }));
  },
});

export const createApiKey = mutation({
  args: { name: v.string() },
  returns: v.string(),
  handler: async (ctx, { name }) => {
    const me = await requireUser(ctx);
    await requireFeature(ctx, me._id, "api");
    const existing = await ctx.db
      .query("apiKeys")
      .withIndex("by_owner", (q) => q.eq("ownerId", me._id))
      .collect();
    if (existing.length >= 20) throw new ConvexError("Twenty keys is the most an account can have. Revoke one first.");
    const bytes = new Uint8Array(24);
    crypto.getRandomValues(bytes);
    const secret = `fk_live_${[...bytes].map((b) => b.toString(16).padStart(2, "0")).join("")}`;
    await ctx.db.insert("apiKeys", {
      ownerId: me._id,
      name: name.trim().slice(0, 60) || "API key",
      prefix: secret.slice(0, 12),
      hash: await sha256Hex(secret),
      createdAt: Date.now(),
      createdBy: me._id,
    });
    await audit(ctx, me._id, me, "Created an API key", name.trim() || "API key");
    return secret;
  },
});

export const revokeApiKey = mutation({
  args: { keyId: v.id("apiKeys") },
  returns: v.null(),
  handler: async (ctx, { keyId }) => {
    const me = await requireUser(ctx);
    const key = await ctx.db.get(keyId);
    if (!key || key.ownerId !== me._id) return null;
    await ctx.db.delete(keyId);
    await audit(ctx, me._id, me, "Revoked an API key", key.name);
    return null;
  },
});
