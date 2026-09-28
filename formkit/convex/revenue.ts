import { query } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import { requireStaff } from "./model/identity";
import { PLANS, planOf, type PlanId } from "./model/plans";

/**
 * Admin → Plans and revenue: who is on which plan, what it is worth, where
 * it is going, and where more of it could come from.
 *
 * Monthly recurring revenue (MRR) counts a yearly plan as a twelfth of its
 * price. Comped plans are customers, not revenue. Figures before billing
 * events were first recorded are reconstructed from today's plans.
 */

const DAY = 86_400_000;
const PAYING = new Set(["active", "trialing", "past_due"]);

function paying(u: Doc<"users">) {
  return !!u.plan && u.plan !== "free" && !u.planComp && PAYING.has(u.planStatus ?? "") && planOf(u) !== "free";
}

function mrrOf(u: Doc<"users">) {
  if (!paying(u) || u.planCancelAtPeriodEnd) return 0;
  const p = PLANS[u.plan as Exclude<PlanId, "free">].price;
  return u.planInterval === "year" ? p.year / 12 : p.month;
}

function monthKey(at: number) {
  const d = new Date(at);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function lastMonths(n: number) {
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

export const overview = query({
  args: {},
  handler: async (ctx) => {
    await requireStaff(ctx, "billing");
    const now = Date.now();
    const users = (await ctx.db.query("users").collect()).filter((u) => !u.staffRole || u.plan);
    const events = await ctx.db.query("billingEvents").withIndex("by_at").collect();
    const orders = await ctx.db.query("polarOrders").withIndex("by_at").collect();
    const forms = await ctx.db.query("forms").collect();
    const period = new Date().toISOString().slice(0, 7);

    /* ---------- today ---------- */
    const byPlan: Record<PlanId, { total: number; monthly: number; yearly: number; comped: number; mrr: number }> = {
      free: { total: 0, monthly: 0, yearly: 0, comped: 0, mrr: 0 },
      pro: { total: 0, monthly: 0, yearly: 0, comped: 0, mrr: 0 },
      business: { total: 0, monthly: 0, yearly: 0, comped: 0, mrr: 0 },
    };
    let cancelling = 0;
    let cancellingMrr = 0;
    let pastDue = 0;
    let pastDueMrr = 0;
    const risk: { _id: string; name: string; email: string; plan: PlanId; interval: string | null; why: string; endsAt: number | null; mrr: number }[] = [];
    for (const u of users) {
      const p = planOf(u);
      byPlan[p].total++;
      if (u.planComp) {
        byPlan[p].comped++;
        continue;
      }
      if (!paying(u)) continue;
      if (u.planInterval === "year") byPlan[p].yearly++;
      else byPlan[p].monthly++;
      const full = PLANS[p].price;
      const value = u.planInterval === "year" ? full.year / 12 : full.month;
      byPlan[p].mrr += u.planCancelAtPeriodEnd ? 0 : value;
      if (u.planCancelAtPeriodEnd) {
        cancelling++;
        cancellingMrr += value;
        risk.push({ _id: u._id, name: u.name ?? "", email: u.email ?? "", plan: p, interval: u.planInterval ?? null, why: "Cancelling", endsAt: u.planEndsAt ?? null, mrr: round(value) });
      } else if (u.planStatus === "past_due") {
        pastDue++;
        pastDueMrr += value;
        risk.push({ _id: u._id, name: u.name ?? "", email: u.email ?? "", plan: p, interval: u.planInterval ?? null, why: "Payment failed", endsAt: u.planEndsAt ?? null, mrr: round(value) });
      }
    }
    const payingCount = byPlan.pro.monthly + byPlan.pro.yearly + byPlan.business.monthly + byPlan.business.yearly;
    const mrr = byPlan.pro.mrr + byPlan.business.mrr;
    const monthlyPayers = byPlan.pro.monthly + byPlan.business.monthly;
    const yearlyPayers = byPlan.pro.yearly + byPlan.business.yearly;
    const monthlyMrr = users.filter((u) => paying(u) && u.planInterval !== "year").reduce((n, u) => n + mrrOf(u), 0);

    /* ---------- MRR over the last twelve months, walked back from today ---------- */
    const months = lastMonths(12);
    const delta = new Map<string, number>();
    const moves = new Map<string, { started: number; upgraded: number; downgraded: number; ended: number; cancelling: number }>();
    for (const e of events) {
      const k = monthKey(e.at);
      delta.set(k, (delta.get(k) ?? 0) + (e.mrr - e.prevMrr));
      const m = moves.get(k) ?? { started: 0, upgraded: 0, downgraded: 0, ended: 0, cancelling: 0 };
      if (e.kind === "started") m.started++;
      if (e.kind === "upgraded") m.upgraded++;
      if (e.kind === "downgraded") m.downgraded++;
      if (e.kind === "ended") m.ended++;
      if (e.kind === "cancelling") m.cancelling++;
      moves.set(k, m);
    }
    let running = mrr;
    const mrrSeries: { month: string; mrr: number }[] = [];
    for (let i = months.length - 1; i >= 0; i--) {
      mrrSeries.unshift({ month: months[i]!, mrr: round(Math.max(0, running)) });
      running -= delta.get(months[i]!) ?? 0;
    }

    /* ---------- money collected ---------- */
    const collected = new Map<string, number>();
    for (const o of orders) collected.set(monthKey(o.at), (collected.get(monthKey(o.at)) ?? 0) + o.amount / 100);
    const revenueSeries = months.map((m) => ({ month: m, amount: round(collected.get(m) ?? 0) }));
    const collectedAll = round(orders.reduce((n, o) => n + o.amount / 100, 0));
    const collected30 = round(orders.filter((o) => o.at > now - 30 * DAY).reduce((n, o) => n + o.amount / 100, 0));

    /* ---------- signups, and how many of each month's signups pay now ---------- */
    const signups = months.map((m) => {
      const cohort = users.filter((u) => monthKey(u._creationTime) === m);
      return {
        month: m,
        free: cohort.filter((u) => planOf(u) === "free").length,
        pro: cohort.filter((u) => planOf(u) === "pro").length,
        business: cohort.filter((u) => planOf(u) === "business").length,
        paying: cohort.filter(paying).length,
      };
    });

    /* ---------- where more revenue could come from ---------- */
    const formsByOwner = new Map<string, Doc<"forms">[]>();
    for (const f of forms) {
      if (f.deletedAt) continue;
      const list = formsByOwner.get(f.ownerId) ?? [];
      list.push(f);
      formsByOwner.set(f.ownerId, list);
    }
    const activeCut = now - 30 * DAY;
    const free = users.filter((u) => planOf(u) === "free" && !u.deactivatedAt);
    const activeFree = free.filter((u) => (formsByOwner.get(u._id) ?? []).some((f) => f.status === "published" || f.updatedAt > activeCut));
    const leads = activeFree
      .map((u) => {
        const own = formsByOwner.get(u._id) ?? [];
        const responses = own.reduce((n, f) => n + f.responsesCount, 0);
        const aiUsed = u.aiPeriod === period ? (u.aiUsed ?? 0) : 0;
        const reasons: string[] = [];
        if (aiUsed >= PLANS.free.aiCredits) reasons.push("Used every AI credit");
        if (responses >= 100) reasons.push(`${responses.toLocaleString("en-US")} responses`);
        if (own.filter((f) => f.status === "published").length >= 3) reasons.push("3+ live forms");
        return { _id: u._id, name: u.name ?? "", email: u.email ?? "", responses, forms: own.length, reasons, score: responses + own.length * 20 + (aiUsed >= PLANS.free.aiCredits ? 200 : 0) };
      })
      .filter((l) => l.reasons.length > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 12);
    const businessLeads = users
      .filter((u) => planOf(u) === "pro" && !u.deactivatedAt)
      .map((u) => {
        const own = formsByOwner.get(u._id) ?? [];
        return { _id: u._id, name: u.name ?? "", email: u.email ?? "", forms: own.length, responses: own.reduce((n, f) => n + f.responsesCount, 0) };
      })
      .filter((l) => l.forms >= 10 || l.responses >= 1000)
      .sort((a, b) => b.responses - a.responses)
      .slice(0, 8);

    const conversion = users.length ? payingCount / users.length : 0;
    return {
      generatedAt: now,
      totals: {
        users: users.length,
        paying: payingCount,
        comped: byPlan.pro.comped + byPlan.business.comped,
        conversion: round(conversion * 100),
        mrr: round(mrr),
        arr: round(mrr * 12),
        arpu: payingCount ? round(mrr / payingCount) : 0,
        monthlyPayers,
        yearlyPayers,
        cancelling,
        cancellingMrr: round(cancellingMrr),
        pastDue,
        pastDueMrr: round(pastDueMrr),
        collectedAll,
        collected30,
      },
      byPlan: (["free", "pro", "business"] as const).map((p) => ({ plan: p, ...byPlan[p], mrr: round(byPlan[p].mrr) })),
      mrrSeries,
      revenueSeries,
      moves: months.map((m) => ({ month: m, ...(moves.get(m) ?? { started: 0, upgraded: 0, downgraded: 0, ended: 0, cancelling: 0 }) })),
      signups,
      potential: {
        activeFree: activeFree.length,
        freeTotal: free.length,
        /** If this share of active Free accounts took Pro monthly. */
        scenarios: [5, 10, 25].map((pct) => ({
          pct,
          accounts: Math.round((activeFree.length * pct) / 100),
          mrr: round(Math.round((activeFree.length * pct) / 100) * PLANS.pro.price.month),
        })),
        /** Moving every monthly payer to yearly: cash now, a little less a year. */
        yearly: {
          payers: monthlyPayers,
          cashUpfront: round(
            users
              .filter((u) => paying(u) && u.planInterval !== "year" && !u.planCancelAtPeriodEnd)
              .reduce((n, u) => n + PLANS[u.plan as Exclude<PlanId, "free">].price.year, 0),
          ),
          yearValueChange: round(
            users
              .filter((u) => paying(u) && u.planInterval !== "year" && !u.planCancelAtPeriodEnd)
              .reduce((n, u) => {
                const p = PLANS[u.plan as Exclude<PlanId, "free">].price;
                return n + (p.year - p.month * 12);
              }, 0),
          ),
          monthlyMrr: round(monthlyMrr),
        },
        /** Pro accounts that look like teams. */
        businessUpside: round(businessLeads.length * (PLANS.business.price.month - PLANS.pro.price.month)),
      },
      leads,
      businessLeads,
      risk: risk.sort((a, b) => b.mrr - a.mrr).slice(0, 20),
      recent: await Promise.all(
        events
          .slice(-15)
          .reverse()
          .map(async (e) => {
            const u = await ctx.db.get(e.userId);
            return { at: e.at, kind: e.kind, plan: e.plan, prevPlan: e.prevPlan ?? null, interval: e.interval ?? null, delta: round(e.mrr - e.prevMrr), who: u?.email ?? u?.name ?? "Deleted account" };
          }),
      ),
    };
  },
});
