import Link from "next/link";
import { ArrowRight, Check, Minus } from "lucide-react";
import { LADDER_PRICES, type PlanLadder as Ladder } from "@/content/featurePlans";

/** Which plan includes what, for one feature: Free, Pro and Business side by side. */
export function PlanLadder({ ladder }: { ladder: Ladder }) {
  const cols = [
    { id: "free" as const, items: ladder.free, lead: null },
    { id: "pro" as const, items: ladder.pro, lead: ladder.free.length ? "Everything in Free, and" : null },
    { id: "business" as const, items: ladder.business, lead: "Everything in Pro" + (ladder.business.length ? ", and" : "") },
  ];
  return (
    <div className="fk-ladder">
      {cols.map((c) => {
        const p = LADDER_PRICES[c.id];
        return (
          <div key={c.id} className="fk-ladder-col" data-plan={c.id}>
            <span className="fk-ladder-name">{p.name}</span>
            <span className="fk-ladder-price">
              <b>{p.price}</b> {c.id === "free" ? "forever" : "a seat a month"}
            </span>
            {c.lead && <span className="fk-ladder-lead">{c.lead}</span>}
            {c.items.length ? (
              <ul>
                {c.items.map((x) => (
                  <li key={x}>
                    <Check size={14} strokeWidth={2.4} aria-hidden /> {x}
                  </li>
                ))}
              </ul>
            ) : (
              c.id === "free" && (
                <p className="fk-ladder-none">
                  <Minus size={14} strokeWidth={2.4} aria-hidden /> Not on the free plan. It starts on Pro.
                </p>
              )
            )}
          </div>
        );
      })}
      <Link href="/pricing" className="fk-ladder-more">
        Compare every plan <ArrowRight size={15} strokeWidth={2} aria-hidden />
      </Link>
    </div>
  );
}
