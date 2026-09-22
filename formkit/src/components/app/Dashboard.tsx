"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import { ArrowRight, FileText, Inbox, LayoutTemplate } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import { Badge, Button, EmptyState } from "@/components/ui";
import { Stat, relativeTime } from "./bits";

/**
 * The dashboard answers one question: what is happening with my forms.
 *
 * Nothing here is invented — every number comes from the account's own data, and
 * an account with nothing in it says so rather than showing a demo.
 */
export function Dashboard() {
  const forms = useQuery(api.forms.list, { filter: "all" });
  const responses = useQuery(api.responses.list, { completeness: "all" });
  const sweep = useMutation(api.forms.sweepClosing);

  // A closing rule that has elapsed takes effect where the owner reads their
  // forms, rather than on a timer nobody can see.
  useEffect(() => {
    void sweep({});
  }, [sweep]);

  const list = forms?.forms ?? [];
  const stats = responses?.stats;
  const recent = (responses?.responses ?? []).slice(0, 6);
  const live = list.filter((f) => f.status === "published");

  if (forms && list.length === 0) {
    return (
      <div className="fk-panel">
        <EmptyState
          title="No forms yet"
          description="Create one from scratch, or start from a template and change what you like."
          action={
            <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
              <Link href="/app/templates">
                <Button iconLeft={<LayoutTemplate size={16} strokeWidth={1.8} aria-hidden />}>
                  Browse templates
                </Button>
              </Link>
            </div>
          }
        />
      </div>
    );
  }

  return (
    <>
      <div className="fk-grid" data-cols="stats">
        <Stat label="Collecting now" value={live.length} note={`of ${list.length} forms`} />
        <Stat label="Responses" value={stats?.total ?? 0} note={`${stats?.week ?? 0} in the last week`} />
        <Stat label="Unread" value={stats?.unread ?? 0} note="Waiting for you" />
        <Stat
          label="Partial"
          value={stats?.partial ?? 0}
          note="Started but not finished"
        />
      </div>

      <div className="fk-grid" data-cols="two">
        <section className="fk-panel" data-pad="none">
          <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "22px 24px 14px" }}>
            <h2 style={{ flex: 1, margin: 0 }}>Your forms</h2>
            <Link href="/app/forms">
              <Button variant="ghost" size="sm" iconRight={<ArrowRight size={15} strokeWidth={1.8} aria-hidden />}>
                All forms
              </Button>
            </Link>
          </div>
          <div className="fk-rows">
            {list.slice(0, 6).map((f) => (
              <Link key={f._id} href={`/app/forms/${f._id}`} className="fk-row">
                <FileText size={17} strokeWidth={1.8} aria-hidden />
                <span className="fk-row-main">
                  <span className="fk-row-title">{f.title}</span>
                  <span className="fk-row-meta">
                    {f.questions} questions · {f.responses} responses · edited {relativeTime(f.updatedAt)}
                  </span>
                </span>
                <span className="fk-row-side">
                  <Badge
                    tone={
                      f.status === "published" ? "success" : f.status === "closed" ? "neutral" : "draft"
                    }
                  >
                    {f.status === "published" ? "Collecting" : f.status === "closed" ? "Closed" : "Draft"}
                  </Badge>
                </span>
              </Link>
            ))}
          </div>
        </section>

        <section className="fk-panel" data-pad="none">
          <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "22px 24px 14px" }}>
            <h2 style={{ flex: 1, margin: 0 }}>Latest answers</h2>
            <Link href="/app/responses">
              <Button variant="ghost" size="sm" iconRight={<ArrowRight size={15} strokeWidth={1.8} aria-hidden />}>
                Inbox
              </Button>
            </Link>
          </div>
          {recent.length === 0 ? (
            <div style={{ padding: "0 24px 24px" }}>
              <EmptyState
                title="Nothing in yet"
                description="Answers land here the moment someone submits."
              />
            </div>
          ) : (
            <div className="fk-rows">
              {recent.map((r) => (
                <Link
                  key={r._id}
                  href={`/app/forms/${r.formId}?tab=responses&open=${r._id}`}
                  className="fk-row"
                >
                  <Inbox size={17} strokeWidth={1.8} aria-hidden />
                  <span className="fk-row-main">
                    <span className="fk-row-title">
                      {r.respondentName ?? r.respondentEmail ?? "Someone"}
                    </span>
                    <span className="fk-row-meta">
                      {relativeTime(r.submittedAt)} ·{" "}
                      {r.partial
                        ? `${r.answeredCount} of ${r.totalCount} answered`
                        : `${r.answeredCount} answers`}
                    </span>
                  </span>
                  <span className="fk-row-side">
                    {r.partial && <Badge tone="warning">Partial</Badge>}
                    {r.status === "new" && <Badge tone="info">New</Badge>}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </>
  );
}
