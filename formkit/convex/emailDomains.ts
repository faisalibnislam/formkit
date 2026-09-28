import { ConvexError, v } from "convex/values";
import { action, internalAction, internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import type { QueryCtx } from "./_generated/server";
import { requireUser } from "./model/identity";
import { hasFeature, requireFeature } from "./model/plans";

/**
 * Pro: the confirmation a respondent gets comes from the owner's own domain -
 * "Studio Nine <hello@studionine.co>" - instead of Formkit's. The domain is
 * added to Resend, which gives the DNS records that prove it is theirs, and
 * checked until Resend reports it verified.
 *
 * Uses the same Resend key as the rest of Formkit's mail (AUTH_RESEND_KEY),
 * which needs full access for this - a sending-only key cannot add domains.
 */

type ResendRecord = { record?: string; name: string; type: string; value: string; priority?: number };
type ResendDomain = { id: string; name: string; status: string; records?: ResendRecord[] };

async function resend<T>(method: string, path: string, body?: unknown): Promise<{ ok: boolean; status: number; data: T }> {
  const key = process.env.AUTH_RESEND_KEY;
  if (!key) return { ok: false, status: 503, data: { message: "Email is not set up." } as T };
  const res = await fetch(`https://api.resend.com${path}`, {
    method,
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data: T;
  try {
    data = (text ? JSON.parse(text) : {}) as T;
  } catch {
    data = {} as T;
  }
  return { ok: res.ok, status: res.status, data };
}

const DOMAIN = /^(?=.{4,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;
const LOCAL = /^[a-z0-9](?:[a-z0-9._+-]{0,62}[a-z0-9])?$/i;

export const mine = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    const row = await ctx.db
      .query("emailDomains")
      .withIndex("by_owner", (q) => q.eq("ownerId", user._id))
      .first();
    if (!row) return null;
    return {
      _id: row._id,
      domain: row.domain,
      status: row.status,
      records: row.records ?? [],
      fromName: row.fromName ?? null,
      fromLocal: row.fromLocal,
      detail: row.detail ?? null,
      checkedAt: row.checkedAt ?? null,
    };
  },
});

export const add = mutation({
  args: { domain: v.string(), fromLocal: v.string(), fromName: v.optional(v.string()) },
  returns: v.id("emailDomains"),
  handler: async (ctx, { domain: raw, fromLocal, fromName }) => {
    const user = await requireUser(ctx);
    await requireFeature(ctx, user, "email.domain");
    const domain = raw.trim().toLowerCase().replace(/^.*@/, "").replace(/^https?:\/\//, "").replace(/\/.*$/, "");
    if (!DOMAIN.test(domain)) throw new ConvexError("That does not look like a domain. Try something like studionine.co.");
    if (domain === "formkit.app" || domain.endsWith(".formkit.app")) throw new ConvexError("Use a domain of your own.");
    if (!LOCAL.test(fromLocal.trim())) throw new ConvexError("Use a simple address before the @, like hello.");
    const existing = await ctx.db
      .query("emailDomains")
      .withIndex("by_owner", (q) => q.eq("ownerId", user._id))
      .first();
    if (existing) throw new ConvexError(`You already send from ${existing.domain}. Remove it first to use another.`);
    const id = await ctx.db.insert("emailDomains", {
      ownerId: user._id,
      domain,
      status: "pending",
      fromLocal: fromLocal.trim().toLowerCase(),
      fromName: fromName?.trim() || undefined,
      addedAt: Date.now(),
    });
    await ctx.scheduler.runAfter(0, internal.emailDomains.attach, { id });
    return id;
  },
});

/** The name and address before the @ can change at any time without re-verifying. */
export const setSender = mutation({
  args: { fromLocal: v.string(), fromName: v.optional(v.string()) },
  returns: v.null(),
  handler: async (ctx, { fromLocal, fromName }) => {
    const user = await requireUser(ctx);
    const row = await ctx.db
      .query("emailDomains")
      .withIndex("by_owner", (q) => q.eq("ownerId", user._id))
      .first();
    if (!row) return null;
    if (!LOCAL.test(fromLocal.trim())) throw new ConvexError("Use a simple address before the @, like hello.");
    await ctx.db.patch(row._id, { fromLocal: fromLocal.trim().toLowerCase(), fromName: fromName?.trim() || undefined });
    return null;
  },
});

export const remove = mutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    const row = await ctx.db
      .query("emailDomains")
      .withIndex("by_owner", (q) => q.eq("ownerId", user._id))
      .first();
    if (!row) return null;
    await ctx.db.delete(row._id);
    if (row.resendId) await ctx.scheduler.runAfter(0, internal.emailDomains.detach, { resendId: row.resendId });
    return null;
  },
});

export const checkNow = action({
  args: {},
  returns: v.null(),
  handler: async (ctx): Promise<null> => {
    const row: Doc<"emailDomains"> | null = await ctx.runQuery(internal.emailDomains.ownRow, {});
    if (!row) return null;
    await check(ctx, row);
    return null;
  },
});

export const ownRow = internalQuery({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    return await ctx.db
      .query("emailDomains")
      .withIndex("by_owner", (q) => q.eq("ownerId", user._id))
      .first();
  },
});

export const row = internalQuery({
  args: { id: v.id("emailDomains") },
  handler: async (ctx, { id }) => ctx.db.get(id),
});

export const attach = internalAction({
  args: { id: v.id("emailDomains") },
  returns: v.null(),
  handler: async (ctx, { id }): Promise<null> => {
    const row: Doc<"emailDomains"> | null = await ctx.runQuery(internal.emailDomains.row, { id });
    if (!row) return null;
    const res = await resend<ResendDomain & { message?: string }>("POST", "/domains", { name: row.domain });
    if (!res.ok) {
      await ctx.runMutation(internal.emailDomains.record, {
        id,
        status: "failed",
        detail:
          res.status === 401 || res.status === 403
            ? "Formkit's mail key cannot add domains yet. Formkit has been told."
            : (res.data.message ?? `Resend refused the domain (${res.status}).`),
      });
      return null;
    }
    await ctx.runMutation(internal.emailDomains.record, {
      id,
      status: "pending",
      resendId: res.data.id,
      records: toRecords(res.data.records),
      detail: "Add these records where your domain's DNS is managed, then check again.",
    });
    return null;
  },
});

function toRecords(records: ResendRecord[] | undefined) {
  return (records ?? []).map((r) => ({
    type: r.type,
    name: r.name,
    value: r.value,
    ...(r.priority !== undefined ? { priority: r.priority } : {}),
  }));
}

async function check(ctx: { runMutation: import("./_generated/server").ActionCtx["runMutation"] }, row: Doc<"emailDomains">) {
  if (!row.resendId) return;
  await resend("POST", `/domains/${row.resendId}/verify`);
  const res = await resend<ResendDomain>("GET", `/domains/${row.resendId}`);
  if (!res.ok) return;
  const verified = res.data.status === "verified";
  await ctx.runMutation(internal.emailDomains.record, {
    id: row._id,
    status: verified ? "verified" : res.data.status === "failed" ? "failed" : "pending",
    records: toRecords(res.data.records),
    detail: verified
      ? undefined
      : res.data.status === "failed"
        ? "Resend could not find the records. Check them against the list below, then check again."
        : "Waiting for the DNS records. Changes can take up to a few hours to spread.",
  });
}

export const record = internalMutation({
  args: {
    id: v.id("emailDomains"),
    status: v.union(v.literal("pending"), v.literal("verified"), v.literal("failed")),
    resendId: v.optional(v.string()),
    records: v.optional(
      v.array(v.object({ type: v.string(), name: v.string(), value: v.string(), priority: v.optional(v.number()) })),
    ),
    detail: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, { id, status, resendId, records, detail }) => {
    if (!(await ctx.db.get(id))) return null;
    await ctx.db.patch(id, {
      status,
      ...(resendId ? { resendId } : {}),
      ...(records ? { records } : {}),
      detail,
      checkedAt: Date.now(),
    });
    return null;
  },
});

export const detach = internalAction({
  args: { resendId: v.string() },
  returns: v.null(),
  handler: async (_ctx, { resendId }) => {
    await resend("DELETE", `/domains/${resendId}`);
    return null;
  },
});

export const pendingRows = internalQuery({
  args: {},
  handler: async (ctx) => {
    const week = Date.now() - 7 * 24 * 60 * 60 * 1000;
    return (await ctx.db.query("emailDomains").collect()).filter((r) => r.status === "pending" && r.addedAt > week);
  },
});

export const recheckPending = internalAction({
  args: {},
  returns: v.null(),
  handler: async (ctx): Promise<null> => {
    const rows: Doc<"emailDomains">[] = await ctx.runQuery(internal.emailDomains.pendingRows, {});
    for (const r of rows) await check(ctx, r);
    return null;
  },
});

/**
 * The From line for mail sent on an owner's behalf, when they have a verified
 * domain and a plan that includes it; null means Formkit's own address.
 */
export async function senderFor(ctx: QueryCtx, ownerId: Id<"users">, fallbackName: string) {
  const row = await ctx.db
    .query("emailDomains")
    .withIndex("by_owner", (q) => q.eq("ownerId", ownerId))
    .first();
  if (!row || row.status !== "verified") return null;
  if (!(await hasFeature(ctx, ownerId, "email.domain"))) return null;
  const name = (row.fromName ?? fallbackName).replace(/["<>]/g, "").trim();
  return `${name} <${row.fromLocal}@${row.domain}>`;
}
