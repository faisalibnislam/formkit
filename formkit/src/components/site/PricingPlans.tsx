"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { Interval } from "../../../convex/model/plans";
import { PlanCards, bestSavingPercent } from "@/components/plan/PlanCards";
import { Segmented } from "@/components/ui";

/**
 * The plan cards on /pricing, with the monthly / yearly switch. A paid plan's
 * button goes to Settings → Plan, which opens Polar's checkout for it —
 * through sign-in first for someone who is not signed in.
 */
export function PricingPlans() {
  const [interval, setInterval] = useState<Interval>("year");
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 22 }}>
        <Segmented
          ariaLabel="Billing period"
          value={interval}
          onChange={setInterval}
          options={[
            { value: "month", label: "Monthly" },
            { value: "year", label: `Yearly — save up to ${bestSavingPercent()}%` },
          ]}
        />
      </div>
      <PlanCards
        interval={interval}
        highlight="pro"
        cta={(id) =>
          id === "free" ? (
            <Link href="/signup" className="fk-pill fk-pill-lg fk-pill-quiet">
              Start free
            </Link>
          ) : (
            <Link
              href={`/app/settings?tab=plan&upgrade=${id}&interval=${interval}`}
              className={`fk-pill fk-pill-lg ${id === "pro" ? "fk-pill-dark" : "fk-pill-quiet"}`}
            >
              Get {id === "pro" ? "Pro" : "Business"}
              <ArrowRight size={16} strokeWidth={1.8} aria-hidden />
            </Link>
          )
        }
      />
    </div>
  );
}
