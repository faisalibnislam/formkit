"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { Eye, LogOut } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { Badge, EmptyState } from "@/components/ui";
import { relativeTime } from "./bits";

/**
 * Staff looking at a customer's account, from the admin console. Read-only by
 * construction: this page only reads, it offers nothing that writes, and the
 * server refuses every mutation from a support view regardless.
 */
export function SupportBanner({ who }: { who: string }) {
  return (
    <div className="fk-support-banner" role="status">
      <Eye size={16} strokeWidth={1.8} aria-hidden />
      <span>
        Support view of <strong>{who}</strong> — read-only. Nothing here can be changed.
      </span>
      <Link href="/admin/users" className="fk-support-leave">
        <LogOut size={14} strokeWidth={1.8} aria-hidden />
        Leave support view
      </Link>
    </div>
  );
}

export function SupportView({ userId }: { userId: Id<"users"> }) {
  const data = useQuery(api.admin.supportView, { userId });

  if (data === undefined) return null;
  if (data === null) {
    return (
      <section className="fk-panel">
        <EmptyState title="That account no longer exists" description="It may have been deleted since you opened this." />
      </section>
    );
  }

  return (
    <section className="fk-panel" data-pad="none">
      <div style={{ padding: "22px 24px 8px" }}>
        <h3 style={{ margin: 0 }}>{data.who}</h3>
        <p className="fk-panel-lede" style={{ margin: "6px 0 0" }}>
          {data.email} · {data.forms.length} {data.forms.length === 1 ? "form" : "forms"}
        </p>
      </div>
      {data.forms.length === 0 ? (
        <div style={{ padding: "8px 24px 24px" }}>
          <EmptyState title="No forms yet" description="This account has not made a form." />
        </div>
      ) : (
        <div className="fk-rows" style={{ padding: "8px 12px 16px" }}>
          {data.forms.map((f) => (
            <div key={f._id} className="fk-row" style={{ cursor: "default" }}>
              <span className="fk-row-main">
                <span className="fk-row-title">{f.title}</span>
                <span className="fk-row-meta">
                  {f.responses} {f.responses === 1 ? "response" : "responses"} · changed {relativeTime(f.updatedAt)}
                </span>
              </span>
              <Badge tone={f.status === "published" ? "success" : f.status === "closed" ? "warning" : "draft"}>
                {f.status === "published" ? "Collecting" : f.status === "closed" ? "Closed" : f.status === "archived" ? "Archived" : "Draft"}
              </Badge>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
