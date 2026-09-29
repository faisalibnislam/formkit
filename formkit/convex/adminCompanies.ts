import { ConvexError, v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { requireStaff } from "./model/identity";
import { aiStatus } from "./model/aiMeter";
import { endComp, giveComp, giveCredits } from "./model/grants";
import { PLANS, compOf, paidPlanOf, planOf, type PlanId } from "./model/plans";
import { resolveSpace, spaceKey } from "./model/spaces";

/**
 * Admin → Companies: every company on Formkit, personal ones included, with
 * who owns it, its plan and how it is had (paid, given free, inherited from
 * the owner, or Free), its seats and forms. Staff with billing can give a
 * company Pro or Business free of charge, for a while or for good, and give
 * it AI credits. Everything given is kept in `planGrants` (model/grants.ts).
 */

type Source = "paid" | "given" | "inherited" | "free";
const PAID_STATES = new Set(["active", "trialing", "past_due"]);
const DAY = 86_400_000;

const planArg = v.union(v.literal("pro"), v.literal("business"));

/** Plan, how it is had, and the billing behind it, from rows already in memory. */
function standing(owner: Doc<"users">, company: Doc<"companies"> | null) {
  const own = company ? !!(company.plan || compOf(company)) : true;
  const holder = company && own ? company : owner;
  if (owner.deactivatedAt) return { plan: "free" as PlanId, source: "free" as Source, holder, own };
  if (!own) {
    // A company without a plan of its own: its owner's paid plan, if they pay account-wide.
    const plan = owner.spaceBilling ? "free" : paidPlanOf(owner);
    return { plan, source: (plan === "free" ? "free" : "inherited") as Source, holder, own };
  }
  const plan = planOf(holder);
  const source: Source = compOf(holder) ? "given" : plan === "free" ? "free" : "paid";
  return { plan, source, holder, own };
}

function billingOf(holder: Doc<"users"> | Doc<"companies">, plan: PlanId, seats: number) {
  if (!holder.polarSubscriptionId || !holder.plan || holder.plan === "free") return null;
  const interval = holder.planInterval ?? "month";
  const per = PLANS[holder.plan].price[interval];
  const billedSeats = Math.max(1, holder.planSeats ?? seats);
  return {
    plan: holder.plan,
    interval,
    status: holder.planStatus ?? null,
    endsAt: holder.planEndsAt ?? null,
    cancelAtPeriodEnd: !!holder.planCancelAtPeriodEnd,
    seats: billedSeats,
    live: PAID_STATES.has(holder.planStatus ?? "") && plan !== "free",
    /** What it brings in each month, before Polar's fees. */
    monthly: Math.round(((interval === "year" ? per / 12 : per) * billedSeats) * 100) / 100,
  };
}

export const list = query({
  args: {
    search: v.optional(v.string()),
    kind: v.optional(v.union(v.literal("all"), v.literal("company"), v.literal("me"))),
    plan: v.optional(
      v.union(
        v.literal("all"),
        v.literal("free"),
        v.literal("pro"),
        v.literal("business"),
        v.literal("paid"),
        v.literal("given"),
        v.literal("ending"),
        v.literal("inherited"),
      ),
    ),
    owner: v.optional(v.id("users")),
    sort: v.optional(v.union(v.literal("newest"), v.literal("name"), v.literal("seats"))),
    page: v.optional(v.number()),
  },
  handler: async (ctx, { search, kind = "all", plan = "all", owner, sort = "newest", page = 0 }) => {
    await requireStaff(ctx, "users.view");
    const PAGE = 25;
    const now = Date.now();
    const users = await ctx.db.query("users").collect();
    const companies = await ctx.db.query("companies").collect();
    const members = await ctx.db.query("teamMembers").collect();
    const byId = new Map(users.map((u) => [u._id as string, u]));

    // Members and forms, counted once per company key.
    const seats = new Map<string, { active: number; pending: number }>();
    for (const m of members) {
      const key = m.companyId ?? `me:${m.ownerId}`;
      const s = seats.get(key) ?? { active: 0, pending: 0 };
      if (m.status === "active") s.active++;
      else s.pending++;
      seats.set(key, s);
    }

    const rows = [
      ...users
        .filter((u) => !u.staffRole || u.planComp || u.plan)
        .map((u) => ({ key: `me:${u._id}`, owner: u, company: null as Doc<"companies"> | null })),
      ...companies.flatMap((c) => {
        const o = byId.get(c.ownerId);
        return o ? [{ key: c._id as string, owner: o, company: c }] : [];
      }),
    ].map(({ key, owner: o, company }) => {
      const s = standing(o, company);
      const count = seats.get(key) ?? { active: 0, pending: 0 };
      const comp = s.source === "given" ? { plan: s.holder.planComp!, endsAt: s.holder.compEndsAt ?? null } : null;
      return {
        key,
        kind: company ? ("company" as const) : ("me" as const),
        name: company ? company.name : o.name?.trim() || o.email || "Personal",
        handle: (company ? company.handle : o.handle) ?? null,
        brandColor: company?.brandColor ?? null,
        owner: { _id: o._id, name: o.name ?? null, email: o.email ?? null, suspended: !!o.deactivatedAt },
        plan: s.plan,
        source: s.source,
        comp,
        billing: s.own ? billingOf(s.holder, s.plan, 1 + count.active) : null,
        seats: 1 + count.active,
        pending: count.pending,
        createdAt: company ? company._creationTime : o._creationTime,
        markId: company?.markId ?? company?.logoId ?? null,
      };
    });

    const term = search?.trim().toLowerCase();
    const filtered = rows
      .filter((r) => (kind === "all" ? true : r.kind === kind))
      .filter((r) => (owner ? r.owner._id === owner : true))
      .filter((r) =>
        term
          ? `${r.name} ${r.handle ?? ""} ${r.owner.name ?? ""} ${r.owner.email ?? ""} ${r.key}`.toLowerCase().includes(term)
          : true,
      )
      .filter((r) => {
        switch (plan) {
          case "all":
            return true;
          case "paid":
            return r.source === "paid";
          case "given":
            return r.source === "given";
          case "inherited":
            return r.source === "inherited";
          case "ending":
            return r.source === "given" && !!r.comp?.endsAt && r.comp.endsAt < now + 30 * DAY;
          default:
            return r.plan === plan;
        }
      })
      .sort((a, b) =>
        sort === "name"
          ? a.name.localeCompare(b.name)
          : sort === "seats"
            ? b.seats - a.seats || b.createdAt - a.createdAt
            : b.createdAt - a.createdAt,
      );

    const at = Math.max(0, Math.min(page, Math.max(0, Math.ceil(filtered.length / PAGE) - 1)));
    const slice = filtered.slice(at * PAGE, at * PAGE + PAGE);

    // Forms are counted for the page shown only: reading every form on
    // Formkit in one query would outgrow Convex's limits.
    const work = new Map<string, { forms: number; responses: number }>();
    for (const ownerId of new Set(slice.map((r) => r.owner._id))) {
      const theirs = await ctx.db
        .query("forms")
        .withIndex("by_owner", (q) => q.eq("ownerId", ownerId))
        .collect();
      for (const f of theirs) {
        if (f.deletedAt) continue;
        const key = f.brand && f.brand !== "me" ? (f.brand as string) : `me:${f.ownerId}`;
        const w = work.get(key) ?? { forms: 0, responses: 0 };
        w.forms++;
        w.responses += f.responsesCount;
        work.set(key, w);
      }
    }
    return {
      total: filtered.length,
      page: at,
      pageSize: PAGE,
      rows: await Promise.all(
        slice.map(async ({ markId, ...r }) => ({
          ...r,
          forms: work.get(r.key)?.forms ?? 0,
          responses: work.get(r.key)?.responses ?? 0,
          imageUrl: markId
            ? await ctx.storage.getUrl(markId)
            : r.kind === "me" && r.owner._id
              ? await avatarOf(ctx, byId.get(r.owner._id)!)
              : null,
        })),
      ),
      summary: {
        companies: rows.filter((r) => r.kind === "company").length,
        personal: rows.filter((r) => r.kind === "me").length,
        paid: rows.filter((r) => r.source === "paid").length,
        given: rows.filter((r) => r.source === "given").length,
        inherited: rows.filter((r) => r.source === "inherited").length,
        ending: rows.filter((r) => r.source === "given" && !!r.comp?.endsAt && r.comp.endsAt < now + 30 * DAY).length,
        byPlan: {
          free: rows.filter((r) => r.plan === "free").length,
          pro: rows.filter((r) => r.plan === "pro").length,
          business: rows.filter((r) => r.plan === "business").length,
        },
        mrr: Math.round(rows.reduce((n, r) => n + (r.billing?.live && !r.billing.cancelAtPeriodEnd && r.source === "paid" ? r.billing.monthly : 0), 0) * 100) / 100,
      },
    };
  },
});

async function avatarOf(ctx: { storage: { getUrl: (id: Id<"_storage">) => Promise<string | null> } }, u: Doc<"users">) {
  return u.avatarId ? await ctx.storage.getUrl(u.avatarId) : (u.image ?? null);
}

/** One company, for the side panel. */
export const detail = query({
  args: { key: v.string() },
  handler: async (ctx, { key }) => {
    await requireStaff(ctx, "users.view");
    const space = await resolveSpace(ctx, key);
    if (!space) return null;
    const owner = await ctx.db.get(space.ownerId);
    if (!owner) return null;
    const company = space.brand === "me" ? null : await ctx.db.get(space.brand);

    const rows = await ctx.db
      .query("teamMembers")
      .withIndex("by_owner", (q) => q.eq("ownerId", space.ownerId))
      .collect();
    const mine = rows.filter((r) => (r.companyId ?? "me") === space.brand);
    const people = await Promise.all(
      mine.map(async (r) => {
        const u = r.userId ? await ctx.db.get(r.userId) : null;
        return { _id: r._id, name: u?.name ?? null, email: r.email, role: r.role, status: r.status, userId: r.userId ?? null };
      }),
    );
    const seats = 1 + mine.filter((r) => r.status === "active").length;
    const s = standing(owner, company);

    const allForms = (
      await ctx.db
        .query("forms")
        .withIndex("by_owner", (q) => q.eq("ownerId", space.ownerId))
        .collect()
    ).filter((f) => !f.deletedAt && (f.brand ?? "me") === space.brand);

    const comp =
      s.source === "given"
        ? {
            plan: s.holder.planComp!,
            endsAt: s.holder.compEndsAt ?? null,
            note: s.holder.compNote ?? null,
            at: s.holder.compAt ?? null,
            by: s.holder.compBy ? ((await ctx.db.get(s.holder.compBy))?.name ?? "Staff") : null,
          }
        : null;

    const history = await ctx.db
      .query("planGrants")
      .withIndex("by_space", (q) => q.eq("space", spaceKey(space)))
      .order("desc")
      .take(25);

    return {
      key: spaceKey(space),
      kind: company ? ("company" as const) : ("me" as const),
      name: company ? company.name : owner.name?.trim() || owner.email || "Personal",
      handle: (company ? company.handle : owner.handle) ?? null,
      imageUrl: company
        ? company.markId
          ? await ctx.storage.getUrl(company.markId)
          : company.logoId
            ? await ctx.storage.getUrl(company.logoId)
            : null
        : await avatarOf(ctx, owner),
      brandColor: company?.brandColor ?? null,
      website: company?.website ?? null,
      createdAt: company ? company._creationTime : owner._creationTime,
      owner: {
        _id: owner._id,
        name: owner.name ?? null,
        email: owner.email ?? null,
        suspended: !!owner.deactivatedAt,
        companies: (
          await ctx.db
            .query("companies")
            .withIndex("by_owner", (q) => q.eq("ownerId", owner._id))
            .collect()
        ).length,
      },
      plan: s.plan,
      source: s.source,
      comp,
      // Whatever the company pays through Polar, even while a free plan covers it.
      billing: s.own ? billingOf(s.holder, s.plan, seats) : null,
      inheritedFrom: s.source === "inherited" ? billingOf(owner, s.plan, 1) : null,
      seats,
      members: people.sort((a, b) => (a.status === b.status ? 0 : a.status === "active" ? -1 : 1)),
      forms: {
        count: allForms.length,
        live: allForms.filter((f) => f.status === "published").length,
        responses: allForms.reduce((n, f) => n + f.responsesCount, 0),
        recent: allForms
          .sort((a, b) => (b.updatedAt ?? b._creationTime) - (a.updatedAt ?? a._creationTime))
          .slice(0, 5)
          .map((f) => ({ _id: f._id, title: f.title, status: f.status, responses: f.responsesCount })),
      },
      ai: await aiStatus(ctx, space),
      history: history.map((h) => ({
        _id: h._id,
        what: h.what,
        plan: h.plan ?? null,
        endsAt: h.endsAt ?? null,
        credits: h.credits ?? null,
        note: h.note ?? null,
        byName: h.byName,
        at: h.at,
      })),
    };
  },
});

/** Gives, changes or extends a free plan. */
export const give = mutation({
  args: {
    key: v.string(),
    plan: planArg,
    endsAt: v.union(v.number(), v.null()),
    note: v.optional(v.string()),
    tell: v.optional(v.boolean()),
  },
  returns: v.null(),
  handler: async (ctx, { key, ...opts }) => {
    const staff = await requireStaff(ctx, "billing");
    const space = await resolveSpace(ctx, key);
    if (!space) throw new ConvexError("That company no longer exists.");
    await giveComp(ctx, staff, space, opts);
    return null;
  },
});

/** Ends a free plan now. */
export const end = mutation({
  args: { key: v.string(), note: v.optional(v.string()), tell: v.optional(v.boolean()) },
  returns: v.null(),
  handler: async (ctx, { key, ...opts }) => {
    const staff = await requireStaff(ctx, "billing");
    const space = await resolveSpace(ctx, key);
    if (!space) throw new ConvexError("That company no longer exists.");
    if (!(await endComp(ctx, staff, space, opts))) throw new ConvexError("That company has no free plan to end.");
    return null;
  },
});

export const credits = mutation({
  args: { key: v.string(), credits: v.number(), note: v.optional(v.string()), tell: v.optional(v.boolean()) },
  returns: v.null(),
  handler: async (ctx, { key, ...opts }) => {
    const staff = await requireStaff(ctx, "billing");
    const space = await resolveSpace(ctx, key);
    if (!space) throw new ConvexError("That company no longer exists.");
    await giveCredits(ctx, staff, space, opts);
    return null;
  },
});

/** Hourly: free plans whose end date has come are ended, and their owners told. */
export const expireComps = internalMutation({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    const now = Date.now();
    let n = 0;
    for (const u of await ctx.db.query("users").collect()) {
      if (u.planComp && u.compEndsAt && u.compEndsAt <= now) {
        await endComp(ctx, null, { ownerId: u._id, brand: "me" }, { expired: true });
        n++;
      }
    }
    for (const c of await ctx.db.query("companies").collect()) {
      if (c.planComp && c.compEndsAt && c.compEndsAt <= now) {
        await endComp(ctx, null, { ownerId: c.ownerId, brand: c._id }, { expired: true });
        n++;
      }
    }
    return n;
  },
});
