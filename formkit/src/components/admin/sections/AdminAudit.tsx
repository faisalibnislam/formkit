"use client";

import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { EmptyState } from "@/components/ui";
import { fullTime } from "@/components/app/bits";

/** Every change made from this console, and who made it. */
export function AdminAudit() {
  const rows = useQuery(api.admin.audit, {});

  if (rows && rows.length === 0) {
    return (
      <section className="fk-panel">
        <EmptyState title="Nothing yet" description="Actions taken here are recorded as they happen." />
      </section>
    );
  }

  return (
    <section className="fk-panel" data-pad="none">
      <div className="fk-rows">
        {(rows ?? []).map((a) => (
          <div key={a._id} className="fk-row" data-static="true">
            <span className="fk-row-main">
              <span className="fk-row-title">
                {a.actorName}: {a.action}
                {a.subject ? `: ${a.subject}` : ""}
              </span>
              <span className="fk-row-meta">
                {fullTime(a.at)}
                {a.detail ? ` · ${a.detail}` : ""}
              </span>
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
