import { ConvexError, v } from "convex/values";
import { action, internalAction, internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import type { QueryCtx } from "./_generated/server";
import { requireUser } from "./model/identity";
import { hasFeature, requireFeature } from "./model/plans";

/**
 * Custom domains (Pro): forms.acme.com for one identity - the person, or one
 * of their companies. The domain is added to the Vercel project that serves
 * Formkit, and checked until its DNS points here. From then on
 * forms.acme.com/<slug> is that identity's form at <slug>, and its share
 * link uses the domain.
 *
 * If the owner's plan lapses, the domain keeps answering but sends every
 * request on to the identity's formkit.app link, so nothing already shared
 * breaks.
 *
 * Environment (Convex): VERCEL_API_TOKEN, VERCEL_PROJECT_ID, and
 * VERCEL_TEAM_ID when the project belongs to a team.
 */

const HOST = /^(?=.{4,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;
const OURS = ["formkit.app", "vercel.app", "vercel.com", "localhost"];

export function cleanHost(raw: string) {
  return raw
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "")
    .replace(/\.$/, "");
}

/* ------------------------------------------------------------------ */
/* Vercel                                                              */
/* ------------------------------------------------------------------ */

function vercel(path: string) {
  const team = process.env.VERCEL_TEAM_ID;
  return `https://api.vercel.com${path}${team ? `${path.includes("?") ? "&" : "?"}teamId=${team}` : ""}`;
}

async function vercelCall<T>(method: string, path: string, body?: unknown): Promise<{ ok: boolean; status: number; data: T }> {
  const token = process.env.VERCEL_API_TOKEN;
  if (!token || !process.env.VERCEL_PROJECT_ID) {
    return { ok: false, status: 503, data: { error: { message: "Custom domains are not switched on yet." } } as T };
  }
  const res = await fetch(vercel(path), {
    method,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
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

type ProjectDomain = {
  name: string;
  apexName?: string;
  verified?: boolean;
  verification?: { type: string; domain: string; value: string }[];
  error?: { code?: string; message?: string };
};

type DomainConfig = {
  misconfigured?: boolean;
  recommendedIPv4?: { rank: number; value: string[] }[];
  recommendedCNAME?: { rank: number; value: string }[];
};

/** What to put in DNS: a CNAME for a subdomain, an A record for a bare domain, plus any ownership TXT. */
function recordsFor(host: string, apex: string, config: DomainConfig | null, verification: ProjectDomain["verification"]) {
  const records: { type: string; name: string; value: string }[] = [];
  if (host === apex) {
    const ip = config?.recommendedIPv4?.sort((a, b) => a.rank - b.rank)[0]?.value[0] ?? "76.76.21.21";
    records.push({ type: "A", name: "@", value: ip });
  } else {
    const cname = config?.recommendedCNAME?.sort((a, b) => a.rank - b.rank)[0]?.value ?? "cname.vercel-dns.com";
    records.push({ type: "CNAME", name: host.slice(0, -(apex.length + 1)), value: cname.replace(/\.$/, "") });
  }
  for (const v of verification ?? []) {
    records.push({ type: v.type, name: v.domain.endsWith(`.${apex}`) ? v.domain.slice(0, -(apex.length + 1)) : v.domain, value: v.value });
  }
  return records;
}

function apexOf(host: string) {
  const parts = host.split(".");
  // Good enough for the common cases; a two-part public suffix (co.uk)
  // takes three labels.
  const twoPart = /^(co|com|org|net|ac|gov|edu)\.[a-z]{2}$/.test(parts.slice(-2).join("."));
  return parts.slice(twoPart ? -3 : -2).join(".");
}

/* ------------------------------------------------------------------ */
/* The customer's side                                                 */
/* ------------------------------------------------------------------ */

async function identityOf(ctx: QueryCtx, user: Doc<"users">, owner: "me" | Id<"companies">) {
  if (owner === "me") return { name: user.name ?? "You", handle: user.handle ?? null };
  const company = await ctx.db.get(owner);
  if (!company || company.ownerId !== user._id) throw new ConvexError("That company is not yours.");
  return { name: company.name, handle: company.handle ?? null };
}

export const mine = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    const rows = await ctx.db
      .query("domains")
      .withIndex("by_owner", (q) => q.eq("ownerId", user._id))
      .collect();
    return {
      configured: !!process.env.VERCEL_API_TOKEN && !!process.env.VERCEL_PROJECT_ID,
      domains: await Promise.all(
        rows.map(async (d) => ({
          _id: d._id,
          owner: d.owner,
          host: d.host,
          status: d.status,
          records: d.records ?? [],
          detail: d.detail ?? null,
          checkedAt: d.checkedAt ?? null,
          identity: await identityOf(ctx, user, d.owner).catch(() => ({ name: "A removed company", handle: null })),
        })),
      ),
    };
  },
});

export const add = mutation({
  args: { host: v.string(), owner: v.union(v.literal("me"), v.id("companies")) },
  returns: v.id("domains"),
  handler: async (ctx, { host: raw, owner }) => {
    const user = await requireUser(ctx);
    await requireFeature(ctx, user, "domains");
    const host = cleanHost(raw);
    if (!HOST.test(host)) throw new ConvexError("That does not look like a domain. Try something like forms.acme.com.");
    if (OURS.some((o) => host === o || host.endsWith(`.${o}`))) throw new ConvexError("Use a domain of your own.");

    const identity = await identityOf(ctx, user, owner);
    if (!identity.handle) {
      throw new ConvexError(
        owner === "me"
          ? "Claim your own Formkit link first. The domain shows the forms published under it."
          : `Claim a Formkit link for ${identity.name} first. The domain shows the forms published under it.`,
      );
    }
    const taken = await ctx.db
      .query("domains")
      .withIndex("by_host", (q) => q.eq("host", host))
      .first();
    if (taken) throw new ConvexError(taken.ownerId === user._id ? "You have already added that domain." : "That domain is connected to another account.");

    const mineRows = await ctx.db
      .query("domains")
      .withIndex("by_owner", (q) => q.eq("ownerId", user._id))
      .collect();
    const existing = mineRows.find((d) => d.owner === owner);
    if (existing) throw new ConvexError(`${identity.name} already has ${existing.host}. Remove it first to use another.`);

    const id = await ctx.db.insert("domains", {
      ownerId: user._id,
      owner,
      host,
      status: "pending",
      addedAt: Date.now(),
    });
    await ctx.scheduler.runAfter(0, internal.domains.attach, { domainId: id });
    return id;
  },
});

export const remove = mutation({
  args: { domainId: v.id("domains") },
  returns: v.null(),
  handler: async (ctx, { domainId }) => {
    const user = await requireUser(ctx);
    const row = await ctx.db.get(domainId);
    if (!row || row.ownerId !== user._id) return null;
    await ctx.db.delete(domainId);
    await ctx.scheduler.runAfter(0, internal.domains.detach, { host: row.host });
    return null;
  },
});

/** "Check now" from Settings. */
export const checkNow = action({
  args: { domainId: v.id("domains") },
  returns: v.null(),
  handler: async (ctx, { domainId }): Promise<null> => {
    const row: Doc<"domains"> | null = await ctx.runQuery(internal.domains.ownRow, { domainId });
    if (!row) throw new ConvexError("That domain is no longer connected.");
    await check(ctx, row);
    return null;
  },
});

export const ownRow = internalQuery({
  args: { domainId: v.id("domains") },
  handler: async (ctx, { domainId }) => {
    const user = await requireUser(ctx);
    const row = await ctx.db.get(domainId);
    return row && row.ownerId === user._id ? row : null;
  },
});

/* ------------------------------------------------------------------ */
/* Attaching and checking                                              */
/* ------------------------------------------------------------------ */

export const row = internalQuery({
  args: { domainId: v.id("domains") },
  handler: async (ctx, { domainId }) => ctx.db.get(domainId),
});

export const attach = internalAction({
  args: { domainId: v.id("domains") },
  returns: v.null(),
  handler: async (ctx, { domainId }): Promise<null> => {
    const row: Doc<"domains"> | null = await ctx.runQuery(internal.domains.row, { domainId });
    if (!row) return null;
    const res = await vercelCall<ProjectDomain>("POST", `/v10/projects/${process.env.VERCEL_PROJECT_ID}/domains`, {
      name: row.host,
    });
    if (!res.ok && res.data.error?.code !== "domain_already_in_use_by_project") {
      const message = res.data.error?.message ?? `Vercel refused the domain (${res.status}).`;
      await ctx.runMutation(internal.domains.record, {
        domainId,
        status: res.status === 409 ? "failed" : "pending",
        detail: res.status === 409 ? "That domain is already used by another site on Vercel." : message,
      });
      return null;
    }
    await check(ctx, row);
    return null;
  },
});

async function check(
  ctx: { runMutation: import("./_generated/server").ActionCtx["runMutation"] },
  row: Doc<"domains">,
  retried = false,
): Promise<void> {
  const project = process.env.VERCEL_PROJECT_ID;
  const [pd, cfg] = await Promise.all([
    vercelCall<ProjectDomain>("GET", `/v9/projects/${project}/domains/${row.host}`),
    vercelCall<DomainConfig>("GET", `/v6/domains/${row.host}/config`),
  ]);
  // Added while custom domains were switched off, or removed in Vercel since:
  // put it on the project now, then read it again.
  if (pd.status === 404 && project && !retried) {
    const added = await vercelCall<ProjectDomain>("POST", `/v10/projects/${project}/domains`, { name: row.host });
    if (added.ok || added.data.error?.code === "domain_already_in_use_by_project") {
      return check(ctx, row, true);
    }
    if (added.status === 409 && !retried) {
      await ctx.runMutation(internal.domains.record, {
        domainId: row._id,
        status: "failed",
        detail: "That domain is already used by another site on Vercel.",
      });
      return;
    }
  }
  if (!pd.ok) {
    await ctx.runMutation(internal.domains.record, {
      domainId: row._id,
      status: "pending",
      detail: pd.data.error?.message ?? "Waiting to reach Vercel.",
    });
    return;
  }
  // A domain Vercel wants proof of ownership for gets verified once the TXT is in.
  if (pd.data.verified === false) {
    await vercelCall("POST", `/v9/projects/${project}/domains/${row.host}/verify`);
  }
  const apex = pd.data.apexName ?? apexOf(row.host);
  const records = recordsFor(row.host, apex, cfg.ok ? cfg.data : null, pd.data.verification);
  const live = pd.data.verified !== false && cfg.ok && cfg.data.misconfigured === false;
  await ctx.runMutation(internal.domains.record, {
    domainId: row._id,
    status: live ? "active" : "pending",
    records,
    detail: live ? undefined : "Waiting for the DNS record. Changes can take up to a few hours to spread.",
  });
}

export const record = internalMutation({
  args: {
    domainId: v.id("domains"),
    status: v.union(v.literal("pending"), v.literal("active"), v.literal("failed")),
    records: v.optional(v.array(v.object({ type: v.string(), name: v.string(), value: v.string() }))),
    detail: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, { domainId, status, records, detail }) => {
    const row = await ctx.db.get(domainId);
    if (!row) return null;
    await ctx.db.patch(domainId, {
      status,
      ...(records ? { records } : {}),
      detail,
      checkedAt: Date.now(),
    });
    return null;
  },
});

export const detach = internalAction({
  args: { host: v.string() },
  returns: v.null(),
  handler: async (_ctx, { host }) => {
    await vercelCall("DELETE", `/v9/projects/${process.env.VERCEL_PROJECT_ID}/domains/${host}`);
    return null;
  },
});

export const pending = internalQuery({
  args: {},
  handler: async (ctx) => {
    const week = Date.now() - 7 * 24 * 60 * 60 * 1000;
    return (
      await ctx.db
        .query("domains")
        .withIndex("by_status", (q) => q.eq("status", "pending"))
        .collect()
    ).filter((d) => d.addedAt > week);
  },
});

/** Every ten minutes, domains still waiting on DNS are looked at again, for a week. */
export const recheckPending = internalAction({
  args: {},
  returns: v.null(),
  handler: async (ctx): Promise<null> => {
    const rows: Doc<"domains">[] = await ctx.runQuery(internal.domains.pending, {});
    for (const row of rows) await check(ctx, row);
    return null;
  },
});

/* ------------------------------------------------------------------ */
/* Serving                                                             */
/* ------------------------------------------------------------------ */

/**
 * What a request to a custom host should see. Asked by the site's proxy on
 * every request to a host that is not Formkit's own, so it reads little.
 */
export const resolve = query({
  args: { host: v.string() },
  handler: async (ctx, { host }) => {
    const row = await ctx.db
      .query("domains")
      .withIndex("by_host", (q) => q.eq("host", cleanHost(host)))
      .first();
    if (!row || row.status !== "active") return null;
    const owner = await ctx.db.get(row.ownerId);
    if (!owner || owner.deactivatedAt) return null;
    const handle =
      row.owner === "me" ? (owner.handle ?? null) : ((await ctx.db.get(row.owner))?.handle ?? null);
    if (!handle) return null;
    return { handle, live: await hasFeature(ctx, owner, "domains") };
  },
});

/** The page at a custom domain's root: whose it is, and their open forms. */
export const listing = query({
  args: { host: v.string() },
  handler: async (ctx, { host }) => {
    const row = await ctx.db
      .query("domains")
      .withIndex("by_host", (q) => q.eq("host", cleanHost(host)))
      .first();
    if (!row || row.status !== "active") return null;
    const owner = await ctx.db.get(row.ownerId);
    if (!owner || !(await hasFeature(ctx, owner, "domains"))) return null;
    const company = row.owner === "me" ? null : await ctx.db.get(row.owner);
    const forms = (
      await ctx.db
        .query("forms")
        .withIndex("by_owner", (q) => q.eq("ownerId", row.ownerId))
        .collect()
    ).filter((f) => f.brand === row.owner && f.status === "published" && !f.deletedAt);
    return {
      name: company?.name ?? owner.name ?? "Forms",
      logoUrl: company?.logoId ? await ctx.storage.getUrl(company.logoId) : null,
      color: company?.brandColor ?? null,
      forms: forms
        .sort((a, b) => b.updatedAt - a.updatedAt)
        .map((f) => ({ slug: f.slug, title: f.title, description: f.description ?? null })),
    };
  },
});
