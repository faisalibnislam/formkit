"use client";

import { useViewer } from "@/lib/seed";
import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useAction, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
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
  const viewer = useViewer();

  if (!viewer) return <PageSkeleton kind="panel" />;
  return <PlanBody viewer={viewer} />;
}

/**
 * Arriving from the pricing page (`?upgrade=pro&interval=year`) opens the
 * checkout for that plan straight away - once, and only if it is an upgrade.
 */
function useUpgradeFromLink(current: PlanId, go: (plan: Exclude<PlanId, "free">, interval: Interval) => void) {
  const search = useSearchParams();
  const started = useRef(false);
  useEffect(() => {
    const want = search.get("upgrade");
    if (started.current || (want !== "pro" && want !== "business")) return;
    if (PLAN_RANK[want] <= PLAN_RANK[current]) return;
    started.current = true;
    go(want, search.get("interval") === "month" ? "month" : "year");
  }, [search, current, go]);
}

function PlanBody({ viewer }: { viewer: NonNullable<FunctionReturnType<typeof api.users.viewer>> }) {
  const search = useSearchParams();
  const toast = useToast();
  const portal = useAction(api.billing.portal);
  const { go, busy } = useCheckout();
  const [interval, setInterval] = useState<Interval>("year");
  const [opening, setOpening] = useState(false);
  const plan = viewer.plan as PlanSummary;
  const welcome = search.get("welcome") as PlanId | null;
  useUpgradeFromLink(plan.id, go);

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

  const company = viewer.space.name;
  const canChange = viewer.space.role === "owner" || viewer.space.role === "admin";
  const seats = plan.seats ?? 1;
  const perSeat = plan.id === "free" ? 0 : PLANS[plan.id].price[plan.interval ?? "month"];
  const status = plan.comped
    ? plan.compUntil
      ? `A gift from Formkit, free of charge until ${date(plan.compUntil)}. Then ${company} goes back to Free, unless it has a plan of its own.`
      : "A gift from Formkit, free of charge."
    : plan.id === "free"
      ? "Free for as long as you like, with no card on file. Members are unlimited."
      : plan.cancelAtPeriodEnd && plan.endsAt
        ? `Cancelled. ${plan.name} stays on until ${date(plan.endsAt)}, and it will not be charged again.`
        : plan.status === "past_due" && plan.endsAt
          ? `The last payment did not go through. Update the card before ${date(plan.endsAt)} to keep ${plan.name}.`
          : `${seats} ${seats === 1 ? "seat" : "seats"} at $${perSeat} a seat, billed ${plan.interval === "year" ? "yearly" : "monthly"} through Polar. Seats follow the members.`;

  return (
    <>
      {search.get("credits") === "added" && (
        <div className="fk-plan-welcome" role="status">
          <strong>Thank you. Your AI credits are on their way.</strong> They appear below as soon as Polar confirms
          the payment, and last a year.
        </div>
      )}
      {welcome && welcome !== "free" && (
        <div className="fk-plan-welcome" role="status">
          <strong>Thank you, and welcome to {PLANS[welcome].name}.</strong>{" "}
          {plan.id === welcome
            ? "Everything in it is on now."
            : "Polar is confirming the payment; your plan switches over in a moment, no need to refresh."}
        </div>
      )}

      <Panel
        title={`${company} is on ${plan.name}`}
        lede={status}
        aside={
          plan.billed ? (
            <Button variant="secondary" size="sm" onClick={manage} disabled={opening}>
              {opening ? "Opening…" : "Invoices and billing"}
            </Button>
          ) : null
        }
      >
        <Row label="File uploads" hint="The largest single file a respondent can send.">
          <strong>{plan.limits.uploadMb} MB</strong>
        </Row>
        <Row label="Version history" hint="How far back you can restore a form.">
          <strong>{plan.limits.historyDays === null ? "All of it" : `${plan.limits.historyDays} days`}</strong>
        </Row>
        <Row label="Guests on each form" hint="People invited to one form, besides the company’s members.">
          <strong>{plan.limits.collaborators === null ? "Unlimited" : plan.limits.collaborators}</strong>
        </Row>
      </Panel>

      <AiThisMonth canBuy={canChange} />

      <Panel
        title={plan.id === "business" ? "Plans" : "Upgrade"}
        lede={
          canChange
            ? `Prices are per seat: every member of ${company} is one. Change or cancel any time; Polar prorates the difference.`
            : `Only ${company}’s owner and admins can change its plan.`
        }
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
                disabled={busy !== null || plan.comped || !canChange}
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
                <td aria-label="Not included">-</td>
                <td>{FEATURES[f].plan === "pro" ? "✓" : "-"}</td>
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

const KINDS = [
  { key: "builds", label: "New forms built by AI", hint: "Ask Formkit making a whole form." },
  { key: "edits", label: "AI edits", hint: "Adding or rewriting questions, logic, themes, questions to Ask Formkit." },
  { key: "responses", label: "Responses AI works on", hint: "An AI reply, AI logic or details pulled out. Each response counts once." },
  { key: "reports", label: "Insights reports", hint: "A read across your responses: themes, opportunities, complaints." },
] as const;

/** The company's AI this month, its credits, and buying more. */
function AiThisMonth({ canBuy }: { canBuy: boolean }) {
  const toast = useToast();
  const s = useQuery(api.credits.status, {});
  const buy = useAction(api.billing.buyCredits);
  const [opening, setOpening] = useState<string | null>(null);
  if (!s) return null;

  const buyPack = async (pack: "credits_100" | "credits_420" | "credits_1050") => {
    setOpening(pack);
    try {
      const { url } = await buy({ pack });
      window.location.assign(url);
    } catch (e) {
      setOpening(null);
      toast(errorText(e, "The checkout could not open. Try again in a moment."));
    }
  };

  return (
    <Panel
      title="AI this month"
      lede={
        s.plan === "free"
          ? "Free includes AI form building and edits. Everything resets on the 1st."
          : `Shared by everyone in the company: each of its ${s.seats} ${s.seats === 1 ? "seat" : "seats"} adds to it. Everything resets on the 1st.`
      }
    >
      {KINDS.map((k) =>
        s.pool[k.key] === 0 && s.used[k.key] === 0 ? null : (
          <Row key={k.key} label={k.label} hint={`${k.hint} After that, ${s.costs[k.key]} ${s.costs[k.key] === 1 ? "credit" : "credits"} each.`}>
            <span style={{ width: 200 }}>
              <span className="fk-proprow-hint" style={{ display: "block", textAlign: "right", marginBottom: 6 }}>
                {Math.min(s.used[k.key], s.pool[k.key]).toLocaleString("en-US")} of {s.pool[k.key].toLocaleString("en-US")} used
              </span>
              <ProgressBar value={s.pool[k.key] ? (Math.min(s.used[k.key], s.pool[k.key]) / s.pool[k.key]) * 100 : 0} />
            </span>
          </Row>
        ),
      )}
      <Row
        label="AI credits"
        hint="Keep AI going once part of the month’s allowance runs out. Used only then, oldest first; they last a year."
      >
        <strong>{s.credits.toLocaleString("en-US")}</strong>
      </Row>
      {canBuy && (
        <div className="fk-creditpacks">
          {s.packs.map((p) => (
            <button
              key={p.key}
              type="button"
              className="fk-creditpack"
              disabled={opening !== null}
              onClick={() => void buyPack(p.key)}
            >
              <span className="fk-creditpack-n">{p.credits.toLocaleString("en-US")} credits</span>
              <span className="fk-creditpack-price">{opening === p.key ? "Opening…" : `$${p.price}`}</span>
              {p.credits > p.price * 20 && <span className="fk-creditpack-bonus">5% bonus</span>}
            </button>
          ))}
        </div>
      )}
      {s.plan === "free" && (
        <p className="fk-proprow-hint" style={{ margin: "10px 0 0" }}>
          On Free, credits pay for AI form building and edits. AI replies, AI logic and insights are part of Pro.
        </p>
      )}
    </Panel>
  );
}
