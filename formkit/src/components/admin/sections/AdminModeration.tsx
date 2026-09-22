"use client";

import { useMutation, useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Badge, Button, EmptyState } from "@/components/ui";
import { useToast } from "@/components/ui/Toast";
import { relativeTime } from "@/components/app/bits";

/** Reported forms. Locking closes a form; it never deletes anything. */
export function AdminModeration() {
  const toast = useToast();
  const reports = useQuery(api.admin.reports, {});
  const resolve = useMutation(api.admin.resolveReport);

  if (reports && reports.length === 0) {
    return (
      <section className="fk-panel">
        <EmptyState title="Nothing reported" description="Reports from customers appear here." />
      </section>
    );
  }

  return (
    <>
      {(reports ?? []).map((r) => (
        <section key={r._id} className="fk-panel">
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
            <h3 style={{ flex: 1, margin: 0 }}>{r.formTitle}</h3>
            <Badge
              tone={r.state === "open" ? "warning" : r.state === "locked" ? "error" : "neutral"}
            >
              {r.state === "open" ? "Open" : r.state === "locked" ? "Locked" : "Dismissed"}
            </Badge>
          </div>
          <p className="fk-panel-lede">
            {r.ownerName} · reported {relativeTime(r.reportedAt)}
          </p>
          <p style={{ margin: "0 0 16px", fontSize: 15, lineHeight: 1.6, maxWidth: "68ch" }}>
            {r.reason}
          </p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {r.state !== "locked" && (
              <Button
                variant="destructive"
                size="sm"
                onClick={async () => {
                  await resolve({ reportId: r._id, state: "locked" });
                  toast("Form locked", { detail: "It has stopped collecting. Nothing was deleted." });
                }}
              >
                Lock the form
              </Button>
            )}
            {r.state !== "dismissed" && (
              <Button
                variant="secondary"
                size="sm"
                onClick={async () => {
                  await resolve({ reportId: r._id, state: "dismissed" });
                  toast("Report dismissed");
                }}
              >
                Dismiss the report
              </Button>
            )}
            {r.state !== "open" && (
              <Button variant="ghost" size="sm" onClick={() => resolve({ reportId: r._id, state: "open" })}>
                Reopen
              </Button>
            )}
          </div>
        </section>
      ))}
    </>
  );
}
