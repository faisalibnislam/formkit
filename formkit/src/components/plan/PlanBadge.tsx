import type { ReactNode } from "react";
import { Crown, Star } from "lucide-react";

/**
 * The paid plan, worn on the avatar: a small medallion at its lower-right
 * corner (sky for Pro, gold for Business) and a thin ring of the same
 * colour around the picture. Free wears nothing.
 */

type Paid = "pro" | "business";
const isPaid = (plan: string | null | undefined): plan is Paid => plan === "pro" || plan === "business";

export const PLAN_LABEL: Record<Paid, string> = { pro: "Pro", business: "Business" };

export function PlanBadge({ plan, size = 18 }: { plan: string | null | undefined; size?: number }) {
  if (!isPaid(plan)) return null;
  const Icon = plan === "business" ? Crown : Star;
  return (
    <span
      className="fk-plancoin"
      data-plan={plan}
      role="img"
      aria-label={`${PLAN_LABEL[plan]} plan`}
      title={`${PLAN_LABEL[plan]} plan`}
      style={{ width: size, height: size }}
    >
      <Icon size={Math.round(size * 0.58)} strokeWidth={2} fill="currentColor" aria-hidden />
    </span>
  );
}

/** An avatar, ringed and badged for a paid plan. */
export function PlanAvatar({ plan, children }: { plan: string | null | undefined; children: ReactNode }) {
  return (
    <span className="fk-planavatar" data-plan={isPaid(plan) ? plan : undefined}>
      {children}
      <PlanBadge plan={plan} />
    </span>
  );
}

/** A quiet chip naming the plan, for the account menu's header. */
export function PlanChip({ plan }: { plan: string | null | undefined }) {
  if (!isPaid(plan)) return null;
  return (
    <span className="fk-planchip" data-plan={plan}>
      <PlanBadge plan={plan} size={14} />
      {PLAN_LABEL[plan]} plan
    </span>
  );
}
