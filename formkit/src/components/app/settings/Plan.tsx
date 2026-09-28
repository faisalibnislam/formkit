"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { useAction, useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { FEATURES, PLANS, type Feature, type Interval, type PlanId, type PlanSummary } from "../../../../convex/model/plans";
import { Button, ProgressBar, Segmented } from "@/components/ui";
import { useToast } from "@/components/ui/Toast";
import { PlanCards, bestSavingPercent } from "@/components/plan/PlanCards";
import { useCheckout } from "@/components/plan/UpgradeSheet";
import { PageSkeleton } from "../Skeleton";
import { Panel, Row, errorText } from "./bits";

const date = (at: number) => new Date(at).toLocaleDateString("en-US", { day: "numeric", month: "long", year: "numeric" });

/** Settings → Plan: what this account is on, what it has used, and changing it. */
export function PlanSection() {
  const viewer = useQuery(api.users.viewer, {});
  const search = useSearchParams();
  const toast = useToast();
  const portal = useAction(api.billing.portal);
  const { go, busy } = useCheckout();
  const [interval, setInterval] = useState<Interval>("year");
  const [opening, setOpening] = useState(false);

  if (!viewer) return <PageSkeleton kind="panel" />;
  const plan = viewer.plan as PlanSummary;
  const welcome = search.get("welcome") as PlanId | null;

  const manage = async () => {
    setOpening(true);
    try {
      const { url } = await portal({});
      window.location.assign(url);
    } catch (e) {
      setOpening(false);
      toast(errorText(e, "Billing could not open. Try again in a moment."));
    }
  };

  const status = plan.comped
    ? "Given to you by Formkit, free of charge."
    : plan.id === "free"
      ? "Free for as long as you like — no card on file."
      : plan.cancelAtPeriodEnd && plan.endsAt
        ? `Cancelled. ${plan.name} stays on until ${date(plan.endsAt)}, and you will not be charged again.`
        : plan.status === "past_due" && plan.endsAt
          ? `The last payment did not go through. Update your card before ${date(plan.endsAt)} to keep ${plan.name}.`
          : `Billed ${plan.interval === "year" ? "yearly" : "monthly"} through Polar.`;

  return (
    <>
      {welcome && welcome !== "free" && (
        <div className="fk-plan-welcome" role="status">
          <strong>Thank you — welcome to {PLANS[welcome].name}.</strong>{" "}
          {plan.id === welcome
            ? "Everything in it is on now."
            : "Polar is confirming the payment; your plan switches over in a moment, no need to refresh."}
        </div>
      )}

      <Panel
        title={`You are on ${plan.name}`}
        lede={status}
        aside={
          plan.billed ? (
            <Button variant="secondary" size="sm" onClick={manage} disabled={opening}>
              {opening ? "Opening…" : "Invoices and billing"}
            </Button>
          ) : null
        }
      >
        <Row label="Ask Formkit credits" hint="Resets on the first of each month.">
          <span style={{ width: 200 }}>
            <span className="fk-proprow-hint" style={{ display: "block", textAlign: "right", marginBottom: 6 }}>
              {viewer.ai.used} of {viewer.ai.limit} used
            </span>
            <ProgressBar value={viewer.ai.limit ? (viewer.ai.used / viewer.ai.limit) * 100 : 0} />
          </span>
        </Row>
        <Row label="File uploads" hint="The largest single file a respondent can send.">
          <strong>{plan.limits.uploadMb} MB</strong>
        </Row>
        <Row label="Version history" hint="How far back you can restore a form.">
          <strong>{plan.limits.historyDays === null ? "All of it" : `${plan.limits.historyDays} days`}</strong>
        </Row>
        <Row label="Collaborators" hint="People working on one form besides you.">
          <strong>{plan.limits.collaborators === null ? "Unlimited" : plan.limits.collaborators}</strong>
        </Row>
      </Panel>

      <Panel
        title={plan.id === "business" ? "Plans" : "Upgrade"}
        lede="Change or cancel any time. Moving between plans is prorated by Polar."
        aside={
          <Segmented
            ariaLabel="Billing period"
            size="sm"
            value={interval}
            onChange={setInterval}
            options={[
              { value: "month", label: "Monthly" },
              { value: "year", label: `Yearly −${bestSavingPercent()}%` },
            ]}
          />
        }
      >
        <PlanCards
          interval={interval}
          current={plan.id}
          highlight={plan.id === "free" ? "pro" : plan.id === "pro" ? "business" : undefined}
          cta={(id) =>
            id === plan.id ? (
              <Button variant="secondary" disabled style={{ width: "100%" }}>
                Your plan
              </Button>
            ) : id === "free" ? (
              plan.billed && !plan.cancelAtPeriodEnd ? (
                <Button variant="ghost" style={{ width: "100%" }} onClick={manage} disabled={opening}>
                  Cancel in billing
                </Button>
              ) : (
                <Button variant="ghost" disabled style={{ width: "100%" }}>
                  Always available
                </Button>
              )
            ) : (
              <Button
                variant={id === "pro" && plan.id === "free" ? "primary" : "secondary"}
                style={{ width: "100%" }}
                disabled={busy !== null || plan.comped}
                onClick={() => go(id as Exclude<PlanId, "free">, interval)}
              >
                {busy === id
                  ? "Opening checkout…"
                  : PLAN_RANK[id] < PLAN_RANK[plan.id]
                    ? `Switch to ${PLANS[id].name}`
                    : `Upgrade to ${PLANS[id].name}`}
              </Button>
            )
          }
        />
      </Panel>

      <Panel title="Everything, plan by plan">
        <table className="fk-plan-table">
          <thead>
            <tr>
              <th scope="col">Feature</th>
              <th scope="col">Free</th>
              <th scope="col">Pro</th>
              <th scope="col">Business</th>
            </tr>
          </thead>
          <tbody>
            {(Object.keys(FEATURES) as Feature[]).map((f) => (
              <tr key={f}>
                <th scope="row">{FEATURES[f].label}</th>
                <td aria-label="Not included">—</td>
                <td>{FEATURES[f].plan === "pro" ? "✓" : "—"}</td>
                <td>✓</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
    </>
  );
}

const PLAN_RANK: Record<PlanId, number> = { free: 0, pro: 1, business: 2 };
