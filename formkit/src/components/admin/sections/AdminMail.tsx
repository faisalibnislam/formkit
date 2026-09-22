"use client";

import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Badge, EmptyState } from "@/components/ui";
import { fullTime } from "@/components/app/bits";

/** Everything Formkit has sent on a customer's behalf, and what became of it. */
export function AdminMail() {
  const rows = useQuery(api.admin.mail, {});

  if (rows && rows.length === 0) {
    return (
      <section className="fk-panel">
        <EmptyState title="Nothing sent yet" description="This fills up as forms collect answers." />
      </section>
    );
  }

  return (
    <section className="fk-panel" data-pad="none">
      <div className="fk-rows">
        {(rows ?? []).map((m) => (
          <div key={m._id} className="fk-row" data-static="true">
            <span className="fk-row-main">
              <span className="fk-row-title">{m.subject}</span>
              <span className="fk-row-meta">
                {m.kind} · to {m.to}
                {m.account ? ` · ${m.account}` : ""} · {fullTime(m.at)}
                {m.state === "failed" && m.detail ? ` · ${m.detail}` : ""}
              </span>
            </span>
            <span className="fk-row-side">
              <Badge tone={m.state === "sent" ? "success" : "error"}>
                {m.state === "sent" ? "Sent" : "Failed"}
              </Badge>
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
