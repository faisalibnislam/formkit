"use client";

import { useEffect, useState } from "react";
import { useAction } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { FEATURES, PLANS, type Interval, type PlanId } from "../../../convex/model/plans";
import { Button, Modal, Segmented } from "@/components/ui";
import { useToast } from "@/components/ui/Toast";
import { errorText } from "@/components/app/settings/bits";
import { PlanCards, bestSavingPercent } from "./PlanCards";
import { onUpgradeRequest, usePlan, type UpgradeAsk } from "./usePlan";

/** A small label beside a paid feature: "Pro" or "Business". */
export function ProChip({ plan = "pro", onClick }: { plan?: Exclude<PlanId, "free">; onClick?: () => void }) {
  const label = PLANS[plan].name;
  return onClick ? (
    <button type="button" className="fk-prochip" data-plan={plan} onClick={onClick} title={`Part of ${label}`}>
      {label}
    </button>
  ) : (
    <span className="fk-prochip" data-plan={plan} title={`Part of ${label}`}>
      {label}
    </span>
  );
}

/** Sends the person to Polar's checkout for a plan. */
export function useCheckout() {
  const checkout = useAction(api.billing.checkout);
  const toast = useToast();
  const [busy, setBusy] = useState<PlanId | null>(null);
  const go = async (plan: Exclude<PlanId, "free">, interval: Interval) => {
    setBusy(plan);
    try {
      const { url } = await checkout({ plan, interval });
      window.location.assign(url);
    } catch (e) {
      setBusy(null);
      toast(errorText(e, "Checkout could not open. Try again in a moment."));
    }
  };
  return { go, busy };
}

/**
 * The sheet any paid feature opens on a free account: what the feature is,
 * the plans that include it, and a way to buy one there and then. Mounted
 * once, in the app shell, and opened with `openUpgrade()`.
 */
export function UpgradeSheet() {
  const [ask, setAsk] = useState<UpgradeAsk | null>(null);
  const [interval, setInterval] = useState<Interval>("year");
  const plan = usePlan();
  const { go, busy } = useCheckout();

  useEffect(() => onUpgradeRequest((a) => setAsk(a)), []);
  if (!ask) return null;

  const needs: PlanId = ask.feature ? FEATURES[ask.feature].plan : (ask.plan ?? "pro");
  const current = plan?.id ?? "free";
  const title = ask.feature ? `${FEATURES[ask.feature].label} is part of ${PLANS[needs].name}` : "Upgrade Formkit";

  return (
    <Modal
      title={title}
      description={
        needs === "business"
          ? "Business is for teams and agencies. Plans can be changed or cancelled any time."
          : "Pro and Business add your own brand, your own domain and your tools. Change or cancel any time."
      }
      width={820}
      onClose={() => setAsk(null)}
    >
      <div className="fk-upgrade-toolbar">
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
        compact
        interval={interval}
        current={current}
        highlight={needs}
        cta={(id) =>
          id === current ? (
            <Button variant="secondary" disabled style={{ width: "100%" }}>
              Your plan
            </Button>
          ) : id === "pro" && current === "business" ? (
            <Button variant="ghost" disabled style={{ width: "100%" }}>
              Included in Business
            </Button>
          ) : (
            <Button
              variant={id === needs ? "primary" : "secondary"}
              style={{ width: "100%" }}
              disabled={busy !== null}
              onClick={() => go(id as Exclude<PlanId, "free">, interval)}
            >
              {busy === id ? "Opening checkout…" : `Upgrade to ${PLANS[id].name}`}
            </Button>
          )
        }
      />
      <p className="fk-upgrade-foot">
        Payments are handled by Polar, who send the receipt. Prices in US dollars; tax may be added at checkout.
      </p>
    </Modal>
  );
}
