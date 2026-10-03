import type { Doc } from "../_generated/dataModel";
import { PLANS, compOf, paidPlanOf, planOf, type PlanId } from "./plans";

/**
 * A company's standing as staff see it in Admin → Companies: its plan, how
 * it is had (paid, given free, inherited from the owner, or Free) and the
 * billing behind it.
 */

export type Source = "paid" | "given" | "inherited" | "free";
const PAID_STATES = new Set(["active", "trialing", "past_due"]);
/** Plan, how it is had, and the billing behind it, from rows already in memory. */
export function standing(owner: Doc<"users">, company: Doc<"companies"> | null) {
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

export function billingOf(holder: Doc<"users"> | Doc<"companies">, plan: PlanId, seats: number) {
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

