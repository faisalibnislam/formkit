import { v } from "convex/values";
import { internalAction, internalMutation, internalQuery, type QueryCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import { PLANS, compOf, planOf, type PlanId } from "./model/plans";
import { period as aiPeriodNow } from "./model/aiMeter";
import { billingOf, standing } from "./model/standing";

/**
 * The admin figures that need every account: Plans and revenue, the plan
 * counts on Billing, the cards above Companies, and how many accounts each
 * plan has for AI cost.
 *
 * These pages used to read the whole users, companies and forms tables on
 * each load, which stops working once a table outgrows what one query may
 * read. This walks them a page at a time, hourly or when staff press Refresh
 * (admin.refreshOverview), and keeps the results in adminReports.
 */

const DAY = 86_400_000;
const USERS_PAGE = 100;
const COMPANIES_PAGE = 200;
const ROWS_PAGE = 1000;
/** Forms read per account when looking for likely upgrades. */
const FORMS_PER_OWNER = 500;
const PAYING = new Set(["active", "trialing", "past_due"]);
const LEADS = 12;
const BUSINESS_LEADS = 8;
const RISK = 20;

export function monthKey(at: number) {
  const d = new Date(at);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function lastMonths(n: number) {
  const out: string[] = [];
  const d = new Date();
  d.setUTCDate(1);
  for (let i = n - 1; i >= 0; i--) {
    const m = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - i, 1));
    out.push(monthKey(m.getTime()));
  }
  return out;
}

const round = (n: number) => Math.round(n * 100) / 100;

function paying(u: Doc<"users">) {
  return !!u.plan && u.plan !== "free" && !compOf(u) && PAYING.has(u.planStatus ?? "") && planOf(u) !== "free";
}

function mrrOf(u: Doc<"users">) {
  if (!paying(u) || u.planCancelAtPeriodEnd) return 0;
  const p = PLANS[u.plan as Exclude<PlanId, "free">].price;
  return u.planInterval === "year" ? p.year / 12 : p.month;
}

/** What a plan holder brings in a month, seats included (Admin → Billing). */
function seatMonthly(h: Doc<"users"> | Doc<"companies">) {
  const p = PLANS[planOf(h)];
  return (h.planInterval === "year" ? p.price.year / 12 : p.price.month) * Math.max(1, h.planSeats ?? 1);
}

type ByPlan = Record<PlanId, { total: number; monthly: number; yearly: number; comped: number; mrr: number }>;
type Risk = { _id: string; name: string; email: string; plan: PlanId; interval: string | null; why: string; endsAt: number | null; mrr: number };
type Lead = { _id: string; name: string; email: string; responses: number; forms: number; reasons: string[]; score: number };
type BusinessLead = { _id: string; name: string; email: string; forms: number; responses: number };
type Cohort = { free: number; pro: number; business: number; paying: number };
type PlanCounts = Record<PlanId, number>;

const planCounts = (): PlanCounts => ({ free: 0, pro: 0, business: 0 });
const byPlanZero = (): ByPlan => ({
  free: { total: 0, monthly: 0, yearly: 0, comped: 0, mrr: 0 },
  pro: { total: 0, monthly: 0, yearly: 0, comped: 0, mrr: 0 },
  business: { total: 0, monthly: 0, yearly: 0, comped: 0, mrr: 0 },
});
const billingZero = () => ({ pro: 0, business: 0, comped: 0, paying: 0, mrr: 0 });
const companiesZero = () => ({
  companies: 0,
  personal: 0,
  paid: 0,
  given: 0,
  inherited: 0,
  ending: 0,
  byPlan: planCounts(),
  mrr: 0,
});
type BillingCounts = ReturnType<typeof billingZero>;
type CompanyCounts = ReturnType<typeof companiesZero>;

function countHolder(b: BillingCounts, h: Doc<"users"> | Doc<"companies">) {
  const p = planOf(h);
  if (p === "pro") b.pro += 1;
  if (p === "business") b.business += 1;
  if (compOf(h)) b.comped += 1;
  else if (p !== "free") {
    b.paying += 1;
    b.mrr += seatMonthly(h);
  }
}

/** One company's standing in the Companies cards, seats read only when billing needs them. */
async function countSpace(
  c: CompanyCounts,
  owner: Doc<"users">,
  company: Doc<"companies"> | null,
  seats: () => Promise<number>,
  now: number,
) {
  const s = standing(owner, company);
  if (company) c.companies += 1;
  else c.personal += 1;
  c.byPlan[s.plan] += 1;
  if (s.source === "paid") c.paid += 1;
  if (s.source === "given") {
    c.given += 1;
    const ends = s.holder.compEndsAt;
    if (ends && ends < now + 30 * DAY) c.ending += 1;
  }
  if (s.source === "inherited") c.inherited += 1;
  const h = s.holder;
  if (s.own && s.source === "paid" && h.polarSubscriptionId && h.plan && h.plan !== "free") {
    const b = billingOf(h, s.plan, h.planSeats ? 1 : await seats());
    if (b?.live && !b.cancelAtPeriodEnd) c.mrr += b.monthly;
  }
}

/** One page of accounts, summed for every report. */
export const usersChunk = internalQuery({
  args: { cursor: v.union(v.string(), v.null()) },
  handler: async (ctx, { cursor }) => {
    const page = await ctx.db.query("users").paginate({ numItems: USERS_PAGE, cursor });
    const now = Date.now();
    const months = new Set(lastMonths(12));
    const activeCut = now - 30 * DAY;
    const period = aiPeriodNow();

    const rev = {
      users: 0,
      byPlan: byPlanZero(),
      cancelling: 0,
      cancellingMrr: 0,
      pastDue: 0,
      pastDueMrr: 0,
      monthlyMrr: 0,
      risk: [] as Risk[],
      signups: {} as Record<string, Cohort>,
      free: 0,
      activeFree: 0,
      leads: [] as Lead[],
      businessLeads: [] as BusinessLead[],
      cashUpfront: 0,
      yearValueChange: 0,
    };
    const billing = billingZero();
    const companies = companiesZero();
    const accounts = planCounts();

    for (const u of page.page) {
      const p = planOf(u);
      if (!u.staffRole) accounts[p] += 1;
      countHolder(billing, u);
      if (!u.staffRole || u.planComp || u.plan) {
        await countSpace(
          companies,
          u,
          null,
          async () =>
            1 +
            (
              await ctx.db
                .query("teamMembers")
                .withIndex("by_owner", (q) => q.eq("ownerId", u._id))
                .collect()
            ).filter((m) => !m.companyId && m.status === "active").length,
          now,
        );
      }

      // Plans and revenue: customers, and staff only when they pay.
      if (u.staffRole && !u.plan) continue;
      rev.users += 1;
      const month = monthKey(u._creationTime);
      if (months.has(month)) {
        const c = (rev.signups[month] ??= { free: 0, pro: 0, business: 0, paying: 0 });
        c[p] += 1;
        if (paying(u)) c.paying += 1;
      }
      rev.byPlan[p].total += 1;
      if (compOf(u)) rev.byPlan[p].comped += 1;
      else if (paying(u)) {
        if (u.planInterval === "year") rev.byPlan[p].yearly += 1;
        else rev.byPlan[p].monthly += 1;
        const full = PLANS[p].price;
        const value = u.planInterval === "year" ? full.year / 12 : full.month;
        rev.byPlan[p].mrr += u.planCancelAtPeriodEnd ? 0 : value;
        const at = { _id: u._id, name: u.name ?? "", email: u.email ?? "", plan: p, interval: u.planInterval ?? null, endsAt: u.planEndsAt ?? null, mrr: round(value) };
        if (u.planCancelAtPeriodEnd) {
          rev.cancelling += 1;
          rev.cancellingMrr += value;
          rev.risk.push({ ...at, why: "Cancelling" });
        } else if (u.planStatus === "past_due") {
          rev.pastDue += 1;
          rev.pastDueMrr += value;
          rev.risk.push({ ...at, why: "Payment failed" });
        }
        if (u.planInterval !== "year") {
          rev.monthlyMrr += mrrOf(u);
          if (!u.planCancelAtPeriodEnd) {
            const price = PLANS[u.plan as Exclude<PlanId, "free">].price;
            rev.cashUpfront += price.year;
            rev.yearValueChange += price.year - price.month * 12;
          }
        }
      }

      // Where more revenue could come from: busy Free accounts, Pro accounts that look like teams.
      if (u.deactivatedAt || (p !== "free" && p !== "pro")) continue;
      if (p === "free") rev.free += 1;
      const own = (
        await ctx.db
          .query("forms")
          .withIndex("by_owner", (q) => q.eq("ownerId", u._id))
          .take(FORMS_PER_OWNER)
      ).filter((f) => !f.deletedAt);
      const responses = own.reduce((n, f) => n + f.responsesCount, 0);
      if (p === "pro") {
        if (own.length >= 10 || responses >= 1000)
          rev.businessLeads.push({ _id: u._id, name: u.name ?? "", email: u.email ?? "", forms: own.length, responses });
        continue;
      }
      if (!own.some((f) => f.status === "published" || f.updatedAt > activeCut)) continue;
      rev.activeFree += 1;
      const aiUsed =
        (
          await ctx.db
            .query("aiAllowance")
            .withIndex("by_space_period", (q) => q.eq("space", `me:${u._id}`).eq("period", period))
            .first()
        )?.builds ?? 0;
      const reasons: string[] = [];
      if (aiUsed >= PLANS.free.ai.builds) reasons.push("Built every free AI form");
      if (responses >= 100) reasons.push(`${responses.toLocaleString("en-US")} responses`);
      if (own.filter((f) => f.status === "published").length >= 3) reasons.push("3+ live forms");
      if (reasons.length)
        rev.leads.push({
          _id: u._id,
          name: u.name ?? "",
          email: u.email ?? "",
          responses,
          forms: own.length,
          reasons,
          score: responses + own.length * 20 + (aiUsed >= PLANS.free.ai.builds ? 200 : 0),
        });
    }
    rev.leads = topLeads(rev.leads);
    rev.businessLeads = topBusinessLeads(rev.businessLeads);
    rev.risk = topRisk(rev.risk);
    return { rev, billing, companies, accounts, cursor: page.continueCursor, done: page.isDone };
  },
});

const topLeads = (l: Lead[]) => l.sort((a, b) => b.score - a.score).slice(0, LEADS);
const topBusinessLeads = (l: BusinessLead[]) => l.sort((a, b) => b.responses - a.responses).slice(0, BUSINESS_LEADS);
const topRisk = (l: Risk[]) => l.sort((a, b) => b.mrr - a.mrr).slice(0, RISK);

/** One page of companies (personal ones are counted with their accounts). */
export const companiesChunk = internalQuery({
  args: { cursor: v.union(v.string(), v.null()) },
  handler: async (ctx, { cursor }) => {
    const page = await ctx.db.query("companies").paginate({ numItems: COMPANIES_PAGE, cursor });
    const now = Date.now();
    const billing = billingZero();
    const companies = companiesZero();
    for (const c of page.page) {
      if (c.plan || compOf(c)) countHolder(billing, c);
      const owner = await ctx.db.get(c.ownerId);
      if (!owner) continue;
      await countSpace(
        companies,
        owner,
        c,
        async () =>
          1 +
          (
            await ctx.db
              .query("teamMembers")
              .withIndex("by_company", (q) => q.eq("companyId", c._id))
              .collect()
          ).filter((m) => m.status === "active").length,
        now,
      );
    }
    return { billing, companies, cursor: page.continueCursor, done: page.isDone };
  },
});

/** Money collected, one page of orders: in all, by month, and in the last 30 days. */
export const ordersChunk = internalQuery({
  args: { cursor: v.union(v.string(), v.null()) },
  handler: async (ctx, { cursor }) => {
    const page = await ctx.db.query("polarOrders").withIndex("by_at").paginate({ numItems: ROWS_PAGE, cursor });
    const since = Date.now() - 30 * DAY;
    const byMonth: Record<string, number> = {};
    let all = 0;
    let last30 = 0;
    for (const o of page.page) {
      const usd = o.amount / 100;
      all += usd;
      if (o.at > since) last30 += usd;
      const k = monthKey(o.at);
      byMonth[k] = (byMonth[k] ?? 0) + usd;
    }
    return { all, last30, byMonth, cursor: page.continueCursor, done: page.isDone };
  },
});

type Moves = { started: number; upgraded: number; downgraded: number; ended: number; cancelling: number };

/** Plan changes since `from`, one page: the MRR they moved and what kind they were. */
export const eventsChunk = internalQuery({
  args: { from: v.number(), cursor: v.union(v.string(), v.null()) },
  handler: async (ctx, { from, cursor }) => {
    const page = await ctx.db
      .query("billingEvents")
      .withIndex("by_at", (q) => q.gte("at", from))
      .paginate({ numItems: ROWS_PAGE, cursor });
    const delta: Record<string, number> = {};
    const moves: Record<string, Moves> = {};
    for (const e of page.page) {
      const k = monthKey(e.at);
      delta[k] = (delta[k] ?? 0) + (e.mrr - e.prevMrr);
      const m = (moves[k] ??= { started: 0, upgraded: 0, downgraded: 0, ended: 0, cancelling: 0 });
      if (e.kind === "started") m.started++;
      if (e.kind === "upgraded") m.upgraded++;
      if (e.kind === "downgraded") m.downgraded++;
      if (e.kind === "ended") m.ended++;
      if (e.kind === "cancelling") m.cancelling++;
    }
    return { delta, moves, cursor: page.continueCursor, done: page.isDone };
  },
});

export const save = internalMutation({
  args: { reports: v.array(v.object({ key: v.string(), data: v.any() })) },
  returns: v.null(),
  handler: async (ctx, { reports }) => {
    const at = Date.now();
    for (const { key, data } of reports) {
      const had = await ctx.db
        .query("adminReports")
        .withIndex("by_key", (q) => q.eq("key", key))
        .unique();
      if (had) await ctx.db.replace(had._id, { key, at, data });
      else await ctx.db.insert("adminReports", { key, at, data });
    }
    return null;
  },
});

type UsersChunk = {
  rev: {
    users: number;
    byPlan: ByPlan;
    cancelling: number;
    cancellingMrr: number;
    pastDue: number;
    pastDueMrr: number;
    monthlyMrr: number;
    risk: Risk[];
    signups: Record<string, Cohort>;
    free: number;
    activeFree: number;
    leads: Lead[];
    businessLeads: BusinessLead[];
    cashUpfront: number;
    yearValueChange: number;
  };
  billing: BillingCounts;
  companies: CompanyCounts;
  accounts: PlanCounts;
  cursor: string;
  done: boolean;
};

function addCounts<T extends Record<string, number | Record<string, number>>>(into: T, from: T) {
  for (const k of Object.keys(from) as (keyof T)[]) {
    const val = from[k];
    if (typeof val === "number") (into[k] as number) += val;
    else for (const [kk, n] of Object.entries(val)) (into[k] as Record<string, number>)[kk] += n;
  }
}

/** Every report, counted from the start. Hourly, and on Refresh. */
export const run = internalAction({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const months = lastMonths(12);
    const rev: UsersChunk["rev"] = {
      users: 0,
      byPlan: byPlanZero(),
      cancelling: 0,
      cancellingMrr: 0,
      pastDue: 0,
      pastDueMrr: 0,
      monthlyMrr: 0,
      risk: [],
      signups: {},
      free: 0,
      activeFree: 0,
      leads: [],
      businessLeads: [],
      cashUpfront: 0,
      yearValueChange: 0,
    };
    const billing = billingZero();
    const companies = companiesZero();
    const accounts = planCounts();

    let cursor: string | null = null;
    for (;;) {
      const p: UsersChunk = await ctx.runQuery(internal.adminReports.usersChunk, { cursor });
      for (const k of ["users", "cancelling", "cancellingMrr", "pastDue", "pastDueMrr", "monthlyMrr", "free", "activeFree", "cashUpfront", "yearValueChange"] as const)
        rev[k] += p.rev[k];
      for (const plan of ["free", "pro", "business"] as const) addCounts(rev.byPlan[plan], p.rev.byPlan[plan]);
      for (const [m, c] of Object.entries(p.rev.signups)) {
        const had = (rev.signups[m] ??= { free: 0, pro: 0, business: 0, paying: 0 });
        addCounts(had, c);
      }
      rev.risk = topRisk([...rev.risk, ...p.rev.risk]);
      rev.leads = topLeads([...rev.leads, ...p.rev.leads]);
      rev.businessLeads = topBusinessLeads([...rev.businessLeads, ...p.rev.businessLeads]);
      addCounts(billing, p.billing);
      addCounts(companies, p.companies);
      addCounts(accounts, p.accounts);
      if (p.done) break;
      cursor = p.cursor;
    }

    cursor = null;
    for (;;) {
      const p: { billing: BillingCounts; companies: CompanyCounts; cursor: string; done: boolean } = await ctx.runQuery(
        internal.adminReports.companiesChunk,
        { cursor },
      );
      addCounts(billing, p.billing);
      addCounts(companies, p.companies);
      if (p.done) break;
      cursor = p.cursor;
    }

    const collected: Record<string, number> = {};
    let collectedAll = 0;
    let collected30 = 0;
    cursor = null;
    for (;;) {
      const p: { all: number; last30: number; byMonth: Record<string, number>; cursor: string; done: boolean } =
        await ctx.runQuery(internal.adminReports.ordersChunk, { cursor });
      collectedAll += p.all;
      collected30 += p.last30;
      for (const [m, n] of Object.entries(p.byMonth)) collected[m] = (collected[m] ?? 0) + n;
      if (p.done) break;
      cursor = p.cursor;
    }

    const delta: Record<string, number> = {};
    const moves: Record<string, Moves> = {};
    cursor = null;
    for (;;) {
      const p: { delta: Record<string, number>; moves: Record<string, Moves>; cursor: string; done: boolean } =
        await ctx.runQuery(internal.adminReports.eventsChunk, { from: Date.parse(`${months[0]}-01T00:00:00Z`), cursor });
      for (const [m, n] of Object.entries(p.delta)) delta[m] = (delta[m] ?? 0) + n;
      for (const [m, mv] of Object.entries(p.moves)) addCounts((moves[m] ??= { started: 0, upgraded: 0, downgraded: 0, ended: 0, cancelling: 0 }), mv);
      if (p.done) break;
      cursor = p.cursor;
    }

    /* ---------- Plans and revenue, in the shape the page reads ---------- */
    const byPlan = rev.byPlan;
    const payingCount = byPlan.pro.monthly + byPlan.pro.yearly + byPlan.business.monthly + byPlan.business.yearly;
    const mrr = byPlan.pro.mrr + byPlan.business.mrr;
    const monthlyPayers = byPlan.pro.monthly + byPlan.business.monthly;
    const yearlyPayers = byPlan.pro.yearly + byPlan.business.yearly;

    // MRR over the last twelve months, walked back from today.
    let running = mrr;
    const mrrSeries: { month: string; mrr: number }[] = [];
    for (let i = months.length - 1; i >= 0; i--) {
      mrrSeries.unshift({ month: months[i]!, mrr: round(Math.max(0, running)) });
      running -= delta[months[i]!] ?? 0;
    }
    const businessLeads = rev.businessLeads;
    const revenue = {
      totals: {
        users: rev.users,
        paying: payingCount,
        comped: byPlan.pro.comped + byPlan.business.comped,
        conversion: round((rev.users ? payingCount / rev.users : 0) * 100),
        mrr: round(mrr),
        arr: round(mrr * 12),
        arpu: payingCount ? round(mrr / payingCount) : 0,
        monthlyPayers,
        yearlyPayers,
        cancelling: rev.cancelling,
        cancellingMrr: round(rev.cancellingMrr),
        pastDue: rev.pastDue,
        pastDueMrr: round(rev.pastDueMrr),
        collectedAll: round(collectedAll),
        collected30: round(collected30),
      },
      byPlan: (["free", "pro", "business"] as const).map((p) => ({ plan: p, ...byPlan[p], mrr: round(byPlan[p].mrr) })),
      mrrSeries,
      revenueSeries: months.map((m) => ({ month: m, amount: round(collected[m] ?? 0) })),
      moves: months.map((m) => ({ month: m, ...(moves[m] ?? { started: 0, upgraded: 0, downgraded: 0, ended: 0, cancelling: 0 }) })),
      signups: months.map((m) => ({ month: m, ...(rev.signups[m] ?? { free: 0, pro: 0, business: 0, paying: 0 }) })),
      potential: {
        activeFree: rev.activeFree,
        freeTotal: rev.free,
        /** If this share of active Free accounts took Pro monthly. */
        scenarios: [5, 10, 25].map((pct) => ({
          pct,
          accounts: Math.round((rev.activeFree * pct) / 100),
          mrr: round(Math.round((rev.activeFree * pct) / 100) * PLANS.pro.price.month),
        })),
        /** Moving every monthly payer to yearly: cash now, a little less a year. */
        yearly: {
          payers: monthlyPayers,
          cashUpfront: round(rev.cashUpfront),
          yearValueChange: round(rev.yearValueChange),
          monthlyMrr: round(rev.monthlyMrr),
        },
        /** Pro accounts that look like teams. */
        businessUpside: round(businessLeads.length * (PLANS.business.price.month - PLANS.pro.price.month)),
      },
      leads: rev.leads,
      businessLeads,
      risk: rev.risk,
    };

    await ctx.runMutation(internal.adminReports.save, {
      reports: [
        { key: "revenue", data: revenue },
        { key: "billing", data: { ...billing, mrr: round(billing.mrr) } },
        { key: "companies", data: { ...companies, mrr: round(companies.mrr) } },
        { key: "accounts", data: accounts },
      ],
    });
    return null;
  },
});

export type RevenueReport = {
  totals: {
    users: number;
    paying: number;
    comped: number;
    conversion: number;
    mrr: number;
    arr: number;
    arpu: number;
    monthlyPayers: number;
    yearlyPayers: number;
    cancelling: number;
    cancellingMrr: number;
    pastDue: number;
    pastDueMrr: number;
    collectedAll: number;
    collected30: number;
  };
  byPlan: ({ plan: PlanId } & ByPlan[PlanId])[];
  mrrSeries: { month: string; mrr: number }[];
  revenueSeries: { month: string; amount: number }[];
  moves: ({ month: string } & Moves)[];
  signups: ({ month: string } & Cohort)[];
  potential: {
    activeFree: number;
    freeTotal: number;
    scenarios: { pct: number; accounts: number; mrr: number }[];
    yearly: { payers: number; cashUpfront: number; yearValueChange: number; monthlyMrr: number };
    businessUpside: number;
  };
  leads: Lead[];
  businessLeads: BusinessLead[];
  risk: Risk[];
};
export type BillingReport = BillingCounts;
export type CompaniesReport = CompanyCounts;
export type AccountsReport = PlanCounts;

/** The last count of one report, or null before the first has run. */
export async function readReport<T>(ctx: QueryCtx, key: "revenue" | "billing" | "companies" | "accounts") {
  const row = await ctx.db
    .query("adminReports")
    .withIndex("by_key", (q) => q.eq("key", key))
    .unique();
  return row ? { at: row.at, data: row.data as T } : null;
}
