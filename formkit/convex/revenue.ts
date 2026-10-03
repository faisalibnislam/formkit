import { query } from "./_generated/server";
import { requireStaff } from "./model/identity";
import { readReport, type RevenueReport } from "./adminReports";

/**
 * Admin → Plans and revenue: who is on which plan, what it is worth, where
 * it is going, and where more of it could come from.
 *
 * Monthly recurring revenue (MRR) counts a yearly plan as a twelfth of its
 * price. Comped plans are customers, not revenue. Figures before billing
 * events were first recorded are reconstructed from today's plans.
 *
 * The figures need every account, so they are counted hourly and on Refresh
 * (adminReports.ts); the latest plan changes are read live.
 */

const RECENT = 15;
const round = (n: number) => Math.round(n * 100) / 100;

export const overview = query({
  args: {},
  handler: async (ctx) => {
    await requireStaff(ctx, "billing");
    const report = await readReport<RevenueReport>(ctx, "revenue");
    if (!report) return { asOf: null };
    const events = await ctx.db.query("billingEvents").withIndex("by_at").order("desc").take(RECENT);
    return {
      asOf: report.at,
      ...report.data,
      recent: await Promise.all(
        events.map(async (e) => {
          const u = await ctx.db.get(e.userId);
          return { at: e.at, kind: e.kind, plan: e.plan, prevPlan: e.prevPlan ?? null, interval: e.interval ?? null, delta: round(e.mrr - e.prevMrr), who: u?.email ?? u?.name ?? "Deleted account" };
        }),
      ),
    };
  },
});
