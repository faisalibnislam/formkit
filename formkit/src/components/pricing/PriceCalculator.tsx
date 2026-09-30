"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, Sparkles, Users } from "lucide-react";
import { PLANS, type Interval } from "../../../convex/model/plans";
import { Chips } from "@/components/site/scenes/shared";

/**
 * What a company would pay, and how much AI its seats add up to. Every figure
 * comes from convex/model/plans.ts, so it can never disagree with checkout.
 */

type Paid = "pro" | "business";

const AI_ROWS = [
  { key: "builds", label: "New forms built by AI" },
  { key: "edits", label: "AI edits" },
  { key: "responses", label: "Responses AI works on" },
  { key: "reports", label: "Insights reports" },
] as const;

function money(n: number) {
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: Number.isInteger(n) ? 0 : 2,
    maximumFractionDigits: 2,
  });
}

/** A number that slides to its new value instead of jumping. */
function useTween(target: number, ms = 450) {
  const [shown, setShown] = useState(target);
  const from = useRef(target);
  useEffect(() => {
    const start = performance.now();
    const a = from.current;
    let raf = 0;
    const tick = (t: number) => {
      const k = Math.min(1, (t - start) / ms);
      const eased = 1 - Math.pow(1 - k, 3);
      const v = a + (target - a) * eased;
      from.current = v;
      setShown(v);
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return shown;
}

function Num({ value, format }: { value: number; format?: (n: number) => string }) {
  const v = useTween(value);
  return <>{format ? format(v) : Math.round(v).toLocaleString("en-US")}</>;
}

export function PriceCalculator() {
  const [seats, setSeats] = useState(3);
  const [plan, setPlan] = useState<Paid>("pro");
  const [interval, setInterval] = useState<Interval>("year");
  const p = PLANS[plan];
  const perSeatMonth = interval === "year" ? p.price.year / 12 : p.price.month;
  const monthly = seats * perSeatMonth;
  const billed = interval === "year" ? seats * p.price.year : seats * p.price.month;
  const saved = interval === "year" ? seats * (p.price.month * 12 - p.price.year) : 0;
  const max = PLANS.business.ai;

  return (
    <div className="fk-calc">
      <div className="fk-calc-controls">
        <label className="fk-calc-seats">
          <span className="fk-calc-label">
            <Users size={16} strokeWidth={2} aria-hidden /> People in the company
          </span>
          <span className="fk-calc-seatnum">
            <b>{seats}</b> {seats === 1 ? "seat" : "seats"}
          </span>
          <input
            type="range"
            min={1}
            max={50}
            value={seats}
            onChange={(e) => setSeats(Number(e.target.value))}
            style={{ ["--fill" as string]: `${((seats - 1) / 49) * 100}%` }}
            aria-label="Seats"
          />
          <span className="fk-calc-ticks" aria-hidden>
            <span>1</span>
            <span>25</span>
            <span>50</span>
          </span>
        </label>
        <div className="fk-calc-row">
          <span className="fk-calc-label">Plan</span>
          <Chips
            label="Plan"
            value={plan}
            onChange={setPlan}
            options={[
              { value: "pro", label: `Pro · $${PLANS.pro.price.month}` },
              { value: "business", label: `Business · $${PLANS.business.price.month}` },
            ]}
          />
        </div>
        <div className="fk-calc-row">
          <span className="fk-calc-label">Billing</span>
          <Chips
            label="Billing"
            value={interval}
            onChange={setInterval}
            options={[
              { value: "month", label: "Monthly" },
              { value: "year", label: "Yearly" },
            ]}
          />
        </div>
        <div className="fk-calc-seat">
          <span className="fk-calc-label">One {p.name} seat, each month</span>
          <ul>
            <li>
              <b>{money(Math.round(perSeatMonth * 100) / 100)}</b>
              <span>{interval === "year" ? "billed yearly" : "billed monthly"}</span>
            </li>
            <li>
              <b>{p.ai.builds}</b>
              <span>AI builds</span>
            </li>
            <li>
              <b>{p.ai.edits}</b>
              <span>AI edits</span>
            </li>
            <li>
              <b>{p.ai.responses}</b>
              <span>AI responses</span>
            </li>
          </ul>
        </div>
        <p className="fk-calc-note">
          Guests invited to a single form are free and never a seat. On Free, members are free too.
        </p>
      </div>

      <div className="fk-calc-out" data-plan={plan}>
        <span className="fk-calc-kicker">{p.name} for {seats} {seats === 1 ? "person" : "people"}</span>
        <div className="fk-calc-total">
          <b>
            <Num value={monthly} format={(n) => money(Math.round(n * 100) / 100)} />
          </b>
          <span>a month</span>
        </div>
        <p className="fk-calc-billed">
          {interval === "year" ? (
            <>
              {money(billed)} billed once a year
              {saved > 0 && (
                <em>
                  {" "}
                  · you save {money(saved)}
                </em>
              )}
            </>
          ) : (
            <>{money(billed)} billed every month</>
          )}
        </p>

        <div className="fk-calc-ai">
          <span className="fk-calc-ai-head">
            <Sparkles size={15} strokeWidth={2} aria-hidden /> The company&rsquo;s AI each month, shared by everyone
          </span>
          {AI_ROWS.map((r) => {
            const v = seats * p.ai[r.key];
            const cap = 50 * max[r.key];
            return (
              <div key={r.key} className="fk-calc-ai-row">
                <span>{r.label}</span>
                <span className="fk-calc-bar">
                  <i style={{ width: `${Math.max(3, Math.sqrt(v / cap) * 100)}%` }} />
                </span>
                <b>
                  <Num value={v} />
                </b>
              </div>
            );
          })}
        </div>

        <Link href={`/app/settings?tab=plan&upgrade=${plan}&interval=${interval}`} className="fk-pill fk-pill-lg fk-pill-light">
          Get {p.name} <ArrowRight size={16} strokeWidth={1.8} aria-hidden />
        </Link>
      </div>
    </div>
  );
}
