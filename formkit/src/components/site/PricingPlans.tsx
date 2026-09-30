"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Building2, Check, Sparkles, User } from "lucide-react";
import { PLANS, type Interval, type PlanId } from "../../../convex/model/plans";
import { PLAN_POINTS, bestSavingPercent } from "@/components/plan/PlanCards";

/**
 * The plan cards at the top of /pricing, with the monthly / yearly switch.
 * They rise out of the hero; Pro is the ink card. A paid plan's button goes
 * to Settings → Plan, which opens Polar's checkout - through sign-in first for
 * someone who is not signed in.
 */

const ICON: Record<PlanId, typeof User> = { free: User, pro: Sparkles, business: Building2 };

const FOR: Record<PlanId, string> = {
  free: "For anyone with a question to ask",
  pro: "For freelancers and growing businesses",
  business: "For teams and agencies",
};

function money(n: number) {
  return Number.isInteger(n) ? `$${n}` : `$${n.toFixed(2)}`;
}

export function PricingPlans() {
  const [interval, setInterval] = useState<Interval>("year");
  const save = bestSavingPercent();

  return (
    <div className="fk-price">
      <div className="fk-price-switch" role="radiogroup" aria-label="Billing period">
        {(["month", "year"] as const).map((v) => (
          <button
            key={v}
            type="button"
            role="radio"
            aria-checked={interval === v}
            className="fk-price-switch-opt"
            onClick={() => setInterval(v)}
          >
            {v === "month" ? "Monthly" : "Yearly"}
            {v === "year" && <span className="fk-price-save">Save up to {save}%</span>}
          </button>
        ))}
      </div>

      <div className="fk-price-cards">
        {(["free", "pro", "business"] as const).map((id) => {
          const plan = PLANS[id];
          const Icon = ICON[id];
          const perMonth = interval === "year" ? plan.price.year / 12 : plan.price.month;
          const saved = plan.price.month * 12 - plan.price.year;
          const points = PLAN_POINTS[id];
          return (
            <article key={id} className="fk-price-card" data-plan={id}>
              {id === "pro" && <span className="fk-price-ribbon">Most popular</span>}
              <div className="fk-price-card-top">
                <span className="fk-price-mark">
                  <Icon size={20} strokeWidth={1.8} aria-hidden />
                </span>
                <div>
                  <h3 className="fk-price-name">{plan.name}</h3>
                  <p className="fk-price-for">{FOR[id]}</p>
                </div>
              </div>

              <div className="fk-price-amount">
                {id === "free" ? (
                  <>
                    <span className="fk-price-big">$0</span>
                    <span className="fk-price-per">free forever</span>
                  </>
                ) : (
                  <>
                    {interval === "year" && <s className="fk-price-was">{money(plan.price.month)}</s>}
                    <span className="fk-price-big" key={interval}>
                      {money(Math.round(perMonth * 100) / 100)}
                    </span>
                    <span className="fk-price-per">a seat a month</span>
                  </>
                )}
              </div>
              <p className="fk-price-billed">
                {id === "free"
                  ? "No card, no trial, no time limit"
                  : interval === "year"
                    ? `${money(plan.price.year)} a seat, billed once a year${saved > 0 ? `, so you save ${money(saved)}` : ""}`
                    : `Billed monthly, or ${money(plan.price.year)} a seat a year`}
              </p>

              {id === "free" ? (
                <Link href="/signup" className="fk-pill fk-pill-lg fk-price-cta" data-tone="quiet">
                  Start free
                </Link>
              ) : (
                <Link
                  href={`/app/settings?tab=plan&upgrade=${id}&interval=${interval}`}
                  className="fk-pill fk-pill-lg fk-price-cta"
                  data-tone={id === "pro" ? "light" : "dark"}
                >
                  Get {plan.name}
                  <ArrowRight size={16} strokeWidth={1.8} aria-hidden />
                </Link>
              )}

              <div className="fk-price-divider" />
              <p className="fk-price-lead">{points.lead ?? "Everything to run a form"}</p>
              <ul className="fk-price-points">
                {points.points.map((p) => (
                  <li key={p}>
                    <span className="fk-price-tick">
                      <Check size={12} strokeWidth={2.6} aria-hidden />
                    </span>
                    <span>{p}</span>
                  </li>
                ))}
              </ul>
            </article>
          );
        })}
      </div>
      <p className="fk-price-fine">Prices are per seat: every member of a company is one. In US dollars, with tax added at checkout where it applies. Cancel any time.</p>
    </div>
  );
}
