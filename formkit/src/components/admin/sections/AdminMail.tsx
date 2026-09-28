"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "convex/react";
import { X } from "lucide-react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { Badge, Button, EmptyState, PillTabs } from "@/components/ui";
import { fullTime } from "@/components/app/bits";

/**
 * Everything Formkit has sent on a customer's behalf in the last 30 days, and
 * what became of it: when, what kind, the subject, and whether it was
 * delivered. Opened from somebody's entry under Users, it shows only theirs.
 */
export function AdminMail() {
  const router = useRouter();
  const params = useSearchParams();
  const userId = params.get("user") as Id<"users"> | null;
  const [kind, setKind] = useState("all");
  const rows = useQuery(api.admin.mail, { userId: userId ?? undefined, limit: 300 });
  const person = useQuery(api.admin.user, userId ? { userId } : "skip");

  const kinds = [...new Set((rows ?? []).map((r) => r.kind))].sort();
  const shown = (rows ?? []).filter((r) => kind === "all" || r.kind === kind);

  return (
    <>
      <div className="fk-panel" data-pad="tight">
        <div className="fk-toolbar" style={{ flexWrap: "wrap" }}>
          <PillTabs
            ariaLabel="Kind"
            value={kind}
            onChange={setKind}
            tabs={[{ value: "all", label: "Every kind" }, ...kinds.map((k) => ({ value: k, label: k[0]!.toUpperCase() + k.slice(1) }))]}
          />
          <span className="fk-toolbar-spacer" />
          {userId && (
            <Button
              variant="secondary"
              size="sm"
              iconRight={<X size={15} strokeWidth={1.8} aria-hidden />}
              onClick={() => router.replace("/admin?section=mail", { scroll: false })}
            >
              Only {person?.email ?? "one person"}
            </Button>
          )}
          <span className="fk-admin-quiet">Last 30 days</span>
        </div>
      </div>

      {rows && shown.length === 0 ? (
        <section className="fk-panel">
          <EmptyState
            title="Nothing sent"
            description={userId ? "Formkit has not emailed them in the last 30 days." : "This fills up as forms collect answers."}
          />
        </section>
      ) : (
        <section className="fk-panel" data-pad="none">
          <table className="fk-admin-table" style={{ display: "table" }}>
            <thead>
              <tr>
                <th scope="col">When</th>
                <th scope="col">Kind</th>
                <th scope="col">Subject</th>
                <th scope="col">Delivery</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((m) => (
                <tr key={m._id} style={{ cursor: "default" }}>
                  <td style={{ whiteSpace: "nowrap" }}>{fullTime(m.at)}</td>
                  <td>{m.kind}</td>
                  <td>
                    {m.subject}
                    <span className="fk-admin-sub">
                      to {m.to}
                      {m.account && m.account !== m.to ? ` · account ${m.account}` : ""}
                    </span>
                  </td>
                  <td>
                    <Badge tone={m.state === "sent" ? "success" : "error"}>{m.state === "sent" ? "Delivered" : "Failed"}</Badge>
                    {m.state === "failed" && m.detail && <span className="fk-admin-sub">{m.detail}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </>
  );
}
