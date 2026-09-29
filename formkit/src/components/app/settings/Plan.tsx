"use client";

import { useViewer } from "@/lib/seed";
import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useAction, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "../../../../convex/_generated/api";
import { FEATURES, PLANS, type Feature, type Interval, type PlanId, type PlanSummary } from "../../../../convex/model/plans";
import { Button, Modal, ProgressBar, Segmented, Switch } from "@/components/ui";
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
  const refresh = useAction(api.billing.refresh);
  const { go, busy } = useCheckout();
  const plan = viewer.plan as PlanSummary;
  const [interval, setInterval] = useState<Interval>(plan.interval ?? "year");
  const [opening, setOpening] = useState(false);
  const [checking, setChecking] = useState(false);
  const [asking, setAsking] = useState<{ plan: Exclude<PlanId, "free">; interval: Interval } | "cancel" | null>(null);
  const welcome = search.get("welcome") as PlanId | null;
  useUpgradeFromLink(plan.id, go);

  // Paying through Polar right now, with a subscription Formkit can change.
  const live =
    plan.billed && plan.id !== "free" && !plan.comped && ["active", "trialing", "past_due"].includes(plan.status ?? "");

  // Back from checkout: ask Polar straight away rather than wait for its
  // webhook, and again a little later if the payment is still settling.
  const want = useRef<PlanId | null>(null);
  useEffect(() => {
    want.current = welcome && welcome !== plan.id ? welcome : null;
  }, [welcome, plan.id]);
  useEffect(() => {
    if (!welcome || welcome === "free") return;
    const timers = [0, 4000, 12000].map((ms) =>
      window.setTimeout(() => {
        if (want.current) void refresh({}).catch(() => undefined);
      }, ms),
    );
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [welcome, refresh]);

  // Subscriptions recorded before the renewal date was kept: fetch it once.
  const filled = useRef(false);
  useEffect(() => {
    if (!live || plan.periodEnd || filled.current) return;
    filled.current = true;
    void refresh({}).catch(() => undefined);
  }, [live, plan.periodEnd, refresh]);

  const check = async () => {
    setChecking(true);
    try {
      const r = await refresh({});
      toast(
        r.plan === "free"
          ? r.found
            ? "Polar has a plan for you, but on another company"
            : "Polar has no paid plan for this company"
          : `${company} is on ${PLANS[r.plan as PlanId].name}`,
        {
          detail:
            r.plan === "free"
              ? r.found
                ? "Switch company with the menu beside the logo to find it."
                : "If you were charged, write to us from the Contact page and we will sort it out."
              : "Up to date with Polar.",
        },
      );
    } catch (e) {
      toast(errorText(e, "Polar could not be reached. Try again in a moment."));
    } finally {
      setChecking(false);
    }
  };

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
          canChange ? (
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
        {live && <RenewRow plan={plan} company={company} canChange={canChange} />}
        {canChange && (
          <div className="fk-plan-actions">
            {live && !plan.cancelAtPeriodEnd && (
              <Button variant="destructive" size="sm" onClick={() => setAsking("cancel")}>
                Cancel plan
              </Button>
            )}
            <span className="fk-plan-actions-hint">
              Paid, but this shows the wrong plan?{" "}
              <button type="button" className="fk-linkbtn" onClick={() => void check()} disabled={checking}>
                {checking ? "Checking…" : "Check with Polar"}
              </button>
            </span>
          </div>
        )}
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
          cta={(id) => {
            const sameInterval = !live || (plan.interval ?? "month") === interval;
            if (id === plan.id && (id === "free" || sameInterval || !live)) {
              return (
                <Button variant="secondary" disabled style={{ width: "100%" }}>
                  Your plan
                </Button>
              );
            }
            if (id === "free") {
              return live && !plan.cancelAtPeriodEnd ? (
                <Button variant="ghost" style={{ width: "100%" }} disabled={!canChange} onClick={() => setAsking("cancel")}>
                  Move to Free
                </Button>
              ) : (
                <Button variant="ghost" disabled style={{ width: "100%" }}>
                  {plan.cancelAtPeriodEnd && plan.endsAt ? `From ${date(plan.endsAt)}` : "Always available"}
                </Button>
              );
            }
            const paid = id as Exclude<PlanId, "free">;
            const label =
              id === plan.id
                ? `Switch to ${interval === "year" ? "yearly" : "monthly"}`
                : PLAN_RANK[id] < PLAN_RANK[plan.id]
                  ? `Switch to ${PLANS[id].name}`
                  : `Upgrade to ${PLANS[id].name}`;
            return (
              <Button
                variant={id === "pro" && plan.id === "free" ? "primary" : "secondary"}
                style={{ width: "100%" }}
                disabled={busy !== null || plan.comped || !canChange}
                onClick={() => (live ? setAsking({ plan: paid, interval }) : go(paid, interval))}
              >
                {busy === id ? "One moment…" : label}
              </Button>
            );
          }}
        />
      </Panel>

      {asking === "cancel" && (
        <CancelDialog company={company} plan={plan} onClose={() => setAsking(null)} />
      )}
      {asking && asking !== "cancel" && (
        <SwitchDialog
          company={company}
          plan={plan}
          seats={seats}
          to={asking}
          busy={busy !== null}
          onClose={() => setAsking(null)}
          onConfirm={async () => {
            await go(asking.plan, asking.interval);
            setAsking(null);
          }}
        />
      )}

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

const perSeat = (p: Exclude<PlanId, "free">, i: Interval) => PLANS[p].price[i];
const money = (n: number) => `$${n.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;

/** Changing a paid plan in place: what it will cost, before it happens. */
function SwitchDialog({
  company,
  plan,
  seats,
  to,
  busy,
  onClose,
  onConfirm,
}: {
  company: string;
  plan: PlanSummary;
  seats: number;
  to: { plan: Exclude<PlanId, "free">; interval: Interval };
  busy: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}) {
  const each = perSeat(to.plan, to.interval);
  const total = each * seats;
  const up = PLAN_RANK[to.plan] > PLAN_RANK[plan.id];
  const every = to.interval === "year" ? "a year" : "a month";
  return (
    <Modal
      title={
        to.plan === plan.id
          ? `Bill ${company} ${to.interval === "year" ? "yearly" : "monthly"}?`
          : `${up ? "Upgrade" : "Switch"} ${company} to ${PLANS[to.plan].name}?`
      }
      description={`${seats} ${seats === 1 ? "seat" : "seats"} at ${money(each)} ${every} each: ${money(total)} ${every}. Polar credits what is left of this period and charges the difference.`}
      onClose={onClose}
      width={480}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Not now
          </Button>
          <Button disabled={busy} onClick={() => void onConfirm()}>
            {busy ? "Switching…" : to.plan === plan.id ? "Switch billing" : `${up ? "Upgrade" : "Switch"} to ${PLANS[to.plan].name}`}
          </Button>
        </>
      }
    >
      <p style={{ margin: 0, fontSize: 14, color: "var(--color-text-secondary)", lineHeight: 1.55 }}>
        {up
          ? `Everything in ${PLANS[to.plan].name} is on as soon as you confirm.`
          : to.plan !== plan.id
            ? `Features outside ${PLANS[to.plan].name} stop straight away. Nothing is deleted, and they come back if you switch again.`
            : "Nothing about the plan changes, only how often it is billed."}{" "}
        The same card is charged; receipts are under Invoices and billing.
      </p>
    </Modal>
  );
}

/** Cancelling: the plan runs to the end of the period, then the company is on Free. */
function CancelDialog({ company, plan, onClose }: { company: string; plan: PlanSummary; onClose: () => void }) {
  const cancel = useAction(api.billing.cancel);
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  return (
    <Modal
      title={`Cancel ${company}’s ${plan.name} plan?`}
      description={`${company} keeps ${plan.name} ${
        plan.periodEnd ? `until ${date(plan.periodEnd)}` : "until the end of the period already paid for"
      }, and is not charged again. Then it moves to Free. You can turn auto-renew back on until then.`}
      onClose={onClose}
      width={480}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Keep {plan.name}
          </Button>
          <Button
            variant="destructive"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await cancel({});
                toast(`${plan.name} is cancelled`, { detail: "It stays on until the end of the period. You can take it back until then." });
                onClose();
              } catch (e) {
                toast(errorText(e, "That could not be cancelled. Try again in a moment."));
                setBusy(false);
              }
            }}
          >
            {busy ? "Cancelling…" : "Cancel plan"}
          </Button>
        </>
      }
    >
      <p style={{ margin: 0, fontSize: 14, color: "var(--color-text-secondary)", lineHeight: 1.55 }}>
        Nothing is deleted. On Free, features outside it stop: a custom domain goes back to your formkit.app link, and
        the monthly AI allowance drops to Free’s. Everything you built or collected stays yours and exportable.
      </p>
    </Modal>
  );
}

/**
 * Auto-renew, stated plainly: when the plan renews and for how much, or when
 * it ends. One switch, no hoops: off cancels at the end of the period paid
 * for, on takes that back.
 */
function RenewRow({ plan, company, canChange }: { plan: PlanSummary; company: string; canChange: boolean }) {
  const cancel = useAction(api.billing.cancel);
  const resume = useAction(api.billing.resume);
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const on = !plan.cancelAtPeriodEnd;
  const when = plan.periodEnd ? date(plan.periodEnd) : null;
  const seats = plan.billedSeats ?? plan.seats ?? 1;
  const each = plan.id === "free" ? 0 : PLANS[plan.id].price[plan.interval ?? "month"];
  const every = plan.interval === "year" ? "year" : "month";

  const hint = on
    ? `${when ? `Renews on ${when}` : `Renews every ${every}`} for ${money(each * seats)} (${seats} ${seats === 1 ? "seat" : "seats"} at ${money(each)}). Turn it off and ${plan.name} ends ${when ? `on ${when}` : "when this period does"}, with nothing more charged.`
    : `${plan.name} ends ${when ? `on ${when}` : "at the end of this period"}, and you will not be charged again. Turn it on to keep ${plan.name}.`;

  async function flip(next: boolean) {
    if (busy) return;
    setBusy(true);
    try {
      if (next) {
        await resume({});
        toast("Auto-renew is on", { detail: `${company} keeps ${plan.name}${when ? ` and renews on ${when}` : ""}.` });
      } else {
        await cancel({});
        toast("Auto-renew is off", {
          detail: `${plan.name} stays on ${when ? `until ${when}` : "to the end of this period"}. Nothing more is charged.`,
        });
      }
    } catch (e) {
      toast(errorText(e, "That could not be changed. Try again in a moment."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Row label="Auto-renew" hint={plan.status === "past_due" ? `The last payment did not go through. ${hint}` : hint}>
      {canChange ? (
        <span className="fk-renew" data-busy={busy || undefined}>
          <strong>{busy ? "Saving…" : on ? "On" : "Off"}</strong>
          <Switch checked={on} onChange={(next) => void flip(next)} label={`Renew ${company}’s ${plan.name} plan automatically`} />
        </span>
      ) : (
        <strong>{on ? "On" : "Off"}</strong>
      )}
    </Row>
  );
}

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
