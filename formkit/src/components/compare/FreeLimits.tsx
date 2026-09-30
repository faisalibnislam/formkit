"use client";

import Link from "next/link";
import { useState } from "react";
import { Check, Infinity as Endless, Info, X } from "lucide-react";
import { FREE_LIMITS } from "@/content/compare";

/**
 * Slide to the number of answers you expect and see which free plans still
 * hold them. Every limit is one the comparison pages already state; products
 * with no fixed figure say so instead of being guessed at.
 */

const STEPS = [10, 25, 50, 100, 150, 250, 500, 1000, 2500, 5000, 10000];
const TOP = STEPS[STEPS.length - 1]!;

/** Where a number sits on the bar, on a log scale so 30 and 10,000 both show. */
const at = (n: number) => (Math.log10(Math.min(n, TOP)) / Math.log10(TOP)) * 100;

export function FreeLimits() {
  const [step, setStep] = useState(4);
  const want = STEPS[step]!;
  const fits = FREE_LIMITS.filter((l) => l.limit !== null && l.limit >= want).length;
  const known = FREE_LIMITS.filter((l) => l.limit !== null).length;

  return (
    <div className="fk-lim">
      <div className="fk-lim-control">
        <label htmlFor="fk-lim-range">
          Answers a month, on one form
          <b>{want.toLocaleString("en-US")}</b>
        </label>
        <input
          id="fk-lim-range"
          type="range"
          min={0}
          max={STEPS.length - 1}
          value={step}
          onChange={(e) => setStep(Number(e.target.value))}
          aria-valuetext={`${want.toLocaleString("en-US")} answers`}
          style={{ ["--fill" as string]: `${(step / (STEPS.length - 1)) * 100}%` }}
        />
        <span className="fk-lim-ticks" aria-hidden>
          <span>10</span>
          <span>100</span>
          <span>1,000</span>
          <span>10,000</span>
        </span>
        <p className="fk-lim-sum" aria-live="polite">
          <b>{fits}</b> of the {known} free plans with a published figure hold {want.toLocaleString("en-US")} answers.
        </p>
      </div>

      <ul className="fk-lim-rows" style={{ ["--want" as string]: `${at(want)}%` }}>
        {FREE_LIMITS.map((l) => {
          const state = l.limit === null ? "unknown" : l.limit >= want ? "fits" : "over";
          const ours = l.name === "Formkit";
          const name = l.slug ? <Link href={`/compare/${l.slug}`}>{l.name}</Link> : <b>{l.name}</b>;
          return (
            <li key={l.name} data-state={state} data-ours={ours || undefined}>
              <span className="fk-lim-name">{name}</span>
              <span className="fk-lim-track" aria-hidden>
                {l.limit !== null && (
                  <i style={{ width: l.limit === Infinity ? "100%" : `${Math.max(4, at(l.limit))}%` }}>
                    {l.limit === Infinity && <Endless size={14} strokeWidth={2.2} />}
                  </i>
                )}
                <em className="fk-lim-mark" />
              </span>
              <span className="fk-lim-note">
                <span className="fk-lim-icon" aria-hidden>
                  {state === "fits" ? (
                    <Check size={13} strokeWidth={2.6} />
                  ) : state === "over" ? (
                    <X size={13} strokeWidth={2.6} />
                  ) : (
                    <Info size={13} strokeWidth={2.4} />
                  )}
                </span>
                <span className="sr-only">
                  {state === "fits" ? "Holds it: " : state === "over" ? "Over the free limit: " : "No fixed figure: "}
                </span>
                {l.note}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
