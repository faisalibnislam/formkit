import type { ReactNode } from "react";
import { Check } from "lucide-react";
import { PLANS, type Interval, type PlanId } from "../../../convex/model/plans";

/**
 * The three plans side by side. Presentational only — no hooks — so the
 * marketing site renders it on the server and the app inside its sheets; the
 * caller supplies each card's button.
 */

export const PLAN_POINTS: Record<PlanId, { lead?: string; points: string[] }> = {
  free: {
    points: [
      "Unlimited forms and responses",
      "Every question type, pages and logic",
      "Your own link, embedding and themes",
      "Notifications and confirmation emails",
      "CSV export and core analytics",
      "Two collaborators on every form",
      `${PLANS.free.aiCredits} Ask Formkit credits a month`,
    ],
  },
  pro: {
    lead: "Everything in Free, and",
    points: [
      "Your own domain, like forms.acme.com",
      "No “Made with Formkit”, emails from your domain",
      "Custom fonts and CSS",
      "Partial responses, sources, devices and drop-off",
      "Calculations, hidden fields, answer piping, redirects",
      "Webhooks, Zapier, Make, Slack and Google Sheets",
      "Take payments with your own Stripe",
      "Excel export and an email copy of every response",
      `${PLANS.pro.aiCredits} AI credits, ${PLANS.pro.uploadMb} MB uploads`,
    ],
  },
  business: {
    lead: "Everything in Pro, and",
    points: [
      "A team with unlimited seats",
      "Several companies and brands",
      "Templates shared with the team",
      "Approval before a form goes live",
      "Audit log and data retention rules",
      "API access",
      "Sign-in with your company’s Google or Microsoft",
      "Priority support",
      `${PLANS.business.aiCredits} AI credits, ${PLANS.business.uploadMb} MB uploads`,
    ],
  },
};

export function priceLine(plan: PlanId, interval: Interval) {
  const p = PLANS[plan].price;
  if (plan === "free") return { amount: "$0", per: "forever" };
  return interval === "month"
    ? { amount: `$${p.month}`, per: "a month" }
    : { amount: `$${p.year}`, per: "a year" };
}

/** "Save $21" against paying monthly for a year, or null when it is not a saving. */
export function yearlySaving(plan: PlanId) {
  const p = PLANS[plan].price;
  const saved = p.month * 12 - p.year;
  return saved > 0 ? saved : null;
}

export function bestSavingPercent() {
  return Math.max(
    ...(["pro", "business"] as const).map((p) => {
      const price = PLANS[p].price;
      return Math.round(((price.month * 12 - price.year) / (price.month * 12)) * 100);
    }),
  );
}

export function PlanCards({
  interval,
  current,
  highlight,
  cta,
  compact = false,
}: {
  interval: Interval;
  current?: PlanId;
  highlight?: PlanId;
  cta: (plan: PlanId) => ReactNode;
  compact?: boolean;
}) {
  const plans: PlanId[] = compact ? ["pro", "business"] : ["free", "pro", "business"];
  return (
    <div className="fk-plans" data-count={plans.length}>
      {plans.map((id) => {
        const plan = PLANS[id];
        const price = priceLine(id, interval);
        const saving = interval === "year" ? yearlySaving(id) : null;
        const points = PLAN_POINTS[id];
        return (
          <article
            key={id}
            className="fk-plan"
            data-plan={id}
            data-highlight={highlight === id ? "true" : undefined}
            data-current={current === id ? "true" : undefined}
          >
            <header className="fk-plan-head">
              <div className="fk-plan-name">
                {plan.name}
                {current === id && <span className="fk-plan-tag">Your plan</span>}
                {current !== id && highlight === id && <span className="fk-plan-tag" data-tone="accent">Recommended</span>}
              </div>
              <p className="fk-plan-tagline">{plan.tagline}</p>
              <div className="fk-plan-price">
                <span className="fk-plan-amount">{price.amount}</span>
                <span className="fk-plan-per">{price.per}</span>
              </div>
              <div className="fk-plan-note">
                {id === "free"
                  ? "No card needed"
                  : interval === "month"
                    ? `or $${plan.price.year} a year`
                    : `$${(plan.price.year / 12).toFixed(2)} a month, billed yearly${
                        saving && saving / (plan.price.month * 12) >= 0.1 ? ` — save $${saving}` : ""
                      }`}
              </div>
            </header>
            <div className="fk-plan-cta">{cta(id)}</div>
            {points.lead && <div className="fk-plan-lead">{points.lead}</div>}
            <ul className="fk-plan-points">
              {points.points.map((p) => (
                <li key={p}>
                  <Check size={16} strokeWidth={2} aria-hidden />
                  <span>{p}</span>
                </li>
              ))}
            </ul>
          </article>
        );
      })}
    </div>
  );
}
