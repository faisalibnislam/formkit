"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import {
  ArrowRight,
  CircleCheck,
  FileText,
  Inbox,
  LayoutTemplate,
  Radio,
} from "lucide-react";
import { api } from "../../../convex/_generated/api";
import { Badge, Button, EmptyState } from "@/components/ui";
import {
  FormCard,
  MetricCard,
  SectionHead,
  Sparkbars,
  TickBars,
} from "./ds";
import { relativeTime } from "./bits";

/**
 * The dashboard answers one question: what is happening with my forms.
 *
 * Nothing here is invented — every number comes from the account's own data, and
 * an account with nothing in it says so rather than showing a demo.
 */

/** The plate colour a form's card carries, read from where the form stands. */
function accentFor(status: string) {
  if (status === "published") return "var(--blue-300)";
  if (status === "draft") return "var(--yellow-200)";
  return "var(--mint-200)";
}

function statusBadge(status: string) {
  if (status === "published") return <Badge tone="success">Collecting</Badge>;
  if (status === "closed") return <Badge tone="neutral">Closed</Badge>;
  return <Badge tone="draft">Draft</Badge>;
}

export function Dashboard() {
  const forms = useQuery(api.forms.list, { filter: "all" });
  const responses = useQuery(api.responses.list, { completeness: "all" });
  const analytics = useQuery(api.analytics.overview, {});
  const sweep = useMutation(api.forms.sweepClosing);

  // A closing rule that has elapsed takes effect where the owner reads their
  // forms, rather than on a timer nobody can see.
  useEffect(() => {
    void sweep({});
  }, [sweep]);

  const list = forms?.forms ?? [];
  const counts = forms?.counts;
  const stats = responses?.stats;
  const recentAnswers = (responses?.responses ?? []).slice(0, 6);

  if (forms && list.length === 0) {
    return (
      <div className="fk-panel">
        <EmptyState
          title="No forms yet"
          description="Create one from scratch, or start from a template and change what you like."
          action={
            <Link href="/app/templates">
              <Button iconLeft={<LayoutTemplate size={16} strokeWidth={1.8} aria-hidden />}>
                Browse templates
              </Button>
            </Link>
          }
        />
      </div>
    );
  }

  const total = counts?.all ?? 0;
  const live = counts?.published ?? 0;
  const restingForms = total - live;
  const paused = counts?.closed ?? 0;
  const completed = stats?.completed ?? 0;
  const abandoned = stats?.partial ?? 0;
  const completionRate = analytics?.completionRate ?? 0;
  const lastAnswer = recentAnswers[0];

  return (
    <>
      <div className="fk-grid" data-cols="stats">
        <MetricCard
          icon={<FileText size={19} strokeWidth={1.9} aria-hidden />}
          title="Total forms"
          eyebrow="All yours"
          value={total}
          href="/app/forms"
          expandLabel="Open all forms"
          chart={
            <TickBars
              value={total ? (live / total) * 100 : 0}
              labelLeft="Live"
              labelRight="Draft & closed"
              footLeft={String(live)}
              footRight={String(restingForms)}
            />
          }
        />

        <MetricCard
          icon={<Radio size={19} strokeWidth={1.9} aria-hidden />}
          title="Active forms"
          eyebrow="Collecting right now"
          value={live}
          valueTone={live ? "up" : undefined}
          href="/app/forms"
          expandLabel="Open the forms that are collecting"
          chart={
            <TickBars
              value={live + paused ? (live / (live + paused)) * 100 : 0}
              labelLeft="Collecting"
              labelRight="Paused"
              footLeft={String(live)}
              footRight={String(paused)}
            />
          }
        />

        <MetricCard
          icon={<Inbox size={19} strokeWidth={1.9} aria-hidden />}
          title="Total responses"
          eyebrow={lastAnswer ? `Last one ${relativeTime(lastAnswer.submittedAt)}` : "Nothing in yet"}
          value={(stats?.total ?? 0).toLocaleString()}
          valueTone={stats?.week ? "up" : undefined}
          href="/app/responses"
          expandLabel="Open the inbox"
          chart={<Sparkbars values={(analytics?.buckets ?? []).map((b) => b.count)} />}
        />

        <MetricCard
          icon={<CircleCheck size={19} strokeWidth={1.9} aria-hidden />}
          title="Completion rate"
          eyebrow="Last 30 days"
          value={`${completionRate}%`}
          valueTone={completionRate >= 50 ? "up" : "down"}
          href="/app/analytics"
          expandLabel="Open analytics"
          chart={
            <TickBars
              value={completionRate}
              labelLeft="Finished"
              labelRight="Abandoned"
              footLeft={completed.toLocaleString()}
              footRight={abandoned.toLocaleString()}
            />
          }
        />
      </div>

      <section>
        <SectionHead
          title="Recent forms"
          count={total}
          action={
            <Link href="/app/forms">
              <Button variant="ghost" size="sm" iconRight={<ArrowRight size={15} strokeWidth={1.8} aria-hidden />}>
                All forms
              </Button>
            </Link>
          }
        />
        <div className="fk-grid" data-cols="cards">
          {list.slice(0, 4).map((f) => (
            <FormCard
              key={f._id}
              href={`/app/forms/${f._id}`}
              title={f.title}
              description={f.description}
              status={statusBadge(f.status)}
              responses={f.responses}
              fields={f.questions}
              updated={`edited ${relativeTime(f.updatedAt)}`}
              accent={accentFor(f.status)}
            />
          ))}
        </div>
      </section>

      <section className="fk-panel" data-pad="none">
        <div className="fk-panel-head">
          <h2>Latest answers</h2>
          <span className="fk-section-spacer" />
          <Link href="/app/responses">
            <Button variant="ghost" size="sm" iconRight={<ArrowRight size={15} strokeWidth={1.8} aria-hidden />}>
              Inbox
            </Button>
          </Link>
        </div>
        {recentAnswers.length === 0 ? (
          <div style={{ padding: "0 24px 24px" }}>
            <EmptyState
              title="Nothing in yet"
              description="Answers land here the moment someone submits."
            />
          </div>
        ) : (
          <div className="fk-rows">
            {recentAnswers.map((r) => (
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
    </>
  );
}
