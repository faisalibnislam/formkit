import { v } from "convex/values";
import { internalMutation, query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { requireStaff } from "./model/identity";
import { PLANS, planOf, type PlanId } from "./model/plans";
import { readReport, type AccountsReport } from "./adminReports";

/**
 * What the AI costs Formkit. Every Gemini call is added into a daily row per
 * account, feature and model (see model/gemini.ts); the admin console reads
 * the rows back as totals, breakdowns and cost per plan.
 */

const DAY = 24 * 60 * 60 * 1000;
const dayOf = (at: number) => new Date(at).toISOString().slice(0, 10);

export const record = internalMutation({
  args: {
    who: v.string(),
    feature: v.string(),
    model: v.string(),
    input: v.number(),
    output: v.number(),
    usd: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, a) => {
    const day = dayOf(Date.now());
    const row = await ctx.db
      .query("aiCost")
      .withIndex("by_key", (q) => q.eq("day", day).eq("who", a.who).eq("feature", a.feature).eq("model", a.model))
      .unique();
    if (row) {
      await ctx.db.patch(row._id, {
        calls: row.calls + 1,
        input: row.input + a.input,
        output: row.output + a.output,
        usd: row.usd + a.usd,
      });
    } else {
      await ctx.db.insert("aiCost", { day, who: a.who, feature: a.feature, model: a.model, calls: 1, ...pick(a) });
    }
    return null;
  },
});

const pick = (a: { input: number; output: number; usd: number }) => ({ input: a.input, output: a.output, usd: a.usd });

type Sum = { calls: number; input: number; output: number; usd: number };
const zero = (): Sum => ({ calls: 0, input: 0, output: 0, usd: 0 });
const add = (s: Sum, r: Sum) => {
  s.calls += r.calls;
  s.input += r.input;
  s.output += r.output;
  s.usd += r.usd;
};

/** Admin → AI cost: the last so many days, every way it is worth slicing. */
export const summary = query({
  args: { days: v.optional(v.number()) },
  handler: async (ctx, { days = 30 }) => {
    await requireStaff(ctx, "billing");
    const span = Math.min(366, Math.max(1, Math.round(days)));
    const now = Date.now();
    const since = dayOf(now - (span - 1) * DAY);
    const rows = await ctx.db
      .query("aiCost")
      .withIndex("by_day", (q) => q.gte("day", since))
      .collect();

    const total = zero();
    const byFeature = new Map<string, Sum>();
    const byModel = new Map<string, Sum>();
    const byDay = new Map<string, number>();
    const byWho = new Map<string, Sum>();
    const bump = (m: Map<string, Sum>, k: string, r: Sum) => {
      const s = m.get(k) ?? zero();
      add(s, r);
      m.set(k, s);
    };
    for (const r of rows) {
      add(total, r);
      bump(byFeature, r.feature, r);
      bump(byModel, r.model, r);
      bump(byWho, r.who, r);
      byDay.set(r.day, (byDay.get(r.day) ?? 0) + r.usd);
    }

    // Each account's plan, and how many accounts each plan has in all, so a
    // plan's AI cost can be set against what its accounts pay. Only accounts
    // that used AI are read; the totals per plan come from the hourly count.
    const planOfUser = new Map<string, PlanId>();
    for (const who of byWho.keys()) {
      const id = ctx.db.normalizeId("users", who);
      const u = id ? await ctx.db.get(id) : null;
      if (u) planOfUser.set(who, planOf(u));
    }
    const report = await readReport<AccountsReport>(ctx, "accounts");
    const accounts: Record<PlanId, number> = report?.data ?? { free: 0, pro: 0, business: 0 };
    const plans = (["free", "pro", "business"] as const).map((plan) => {
      const s = zero();
      let using = 0;
      for (const [who, sum] of byWho) {
        if (planOfUser.get(who) !== plan) continue;
        add(s, sum);
        using += 1;
      }
      // Revenue for the same span, at the monthly price.
      const revenue = accounts[plan] * PLANS[plan].price.month * (span / 30);
      return {
        plan,
        accounts: accounts[plan],
        using,
        usd: s.usd,
        calls: s.calls,
        perAccount: accounts[plan] ? s.usd / accounts[plan] : 0,
        perUser: using ? s.usd / using : 0,
        revenue,
      };
    });

    const top = [...byWho.entries()]
      .filter(([who]) => who !== "-")
      .sort((a, b) => b[1].usd - a[1].usd)
      .slice(0, 12);
    const topAccounts = await Promise.all(
      top.map(async ([who, s]) => {
        const u = await ctx.db.get(who as Id<"users">);
        return {
          who,
          name: u?.name ?? null,
          email: u?.email ?? null,
          plan: u ? planOf(u) : ("free" as PlanId),
          ...s,
        };
      }),
    );

    const days_ = Array.from({ length: span }, (_, i) => {
      const d = dayOf(now - (span - 1 - i) * DAY);
      return { day: d, usd: byDay.get(d) ?? 0 };
    });
    const list = (m: Map<string, Sum>) =>
      [...m.entries()].map(([key, s]) => ({ key, ...s })).sort((a, b) => b.usd - a.usd);

    return {
      span,
      total,
      byFeature: list(byFeature),
      byModel: list(byModel),
      daily: days_,
      plans,
      topAccounts,
      unattributed: byWho.get("-")?.usd ?? 0,
    };
  },
});
