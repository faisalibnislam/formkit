"use client";

import { useState } from "react";
import { CREDIT_COST, CREDIT_PACKS } from "../../../convex/model/plans";

/** Pick a pack and see what it buys, from the same costs checkout uses. */
const USES = [
  { key: "builds", one: "new form built by AI", many: "new forms built by AI" },
  { key: "edits", one: "AI edit", many: "AI edits" },
  { key: "responses", one: "response AI works on", many: "responses AI works on" },
  { key: "reports", one: "insights report", many: "insights reports" },
] as const;

export function CreditPicker() {
  const [at, setAt] = useState(1);
  const pack = CREDIT_PACKS[at]!;
  return (
    <div className="fk-credits">
      <div className="fk-credits-packs" role="radiogroup" aria-label="Credit pack">
        {CREDIT_PACKS.map((k, i) => (
          <button key={k.key} type="button" role="radio" aria-checked={i === at} onClick={() => setAt(i)}>
            <b>${k.price}</b>
            <span>{k.credits.toLocaleString("en-US")} credits</span>
            {i > 0 && (
              <em>
                {Math.round(((k.credits / k.price - CREDIT_PACKS[0]!.credits / CREDIT_PACKS[0]!.price) /
                  (CREDIT_PACKS[0]!.credits / CREDIT_PACKS[0]!.price)) *
                  100)}
                % more
              </em>
            )}
          </button>
        ))}
      </div>
      <div className="fk-credits-buys" key={pack.key}>
        <span>
          ${pack.price} buys any mix of, for example:
        </span>
        <ul>
          {USES.map((u) => {
            const n = Math.floor(pack.credits / CREDIT_COST[u.key]);
            return (
              <li key={u.key}>
                <b>{n.toLocaleString("en-US")}</b> {n === 1 ? u.one : u.many}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
