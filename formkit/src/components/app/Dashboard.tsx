"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import {
  ArrowRight,
  CircleCheck,
  FilePlus2,
  FileText,
  Inbox,
  Layers,
  LayoutTemplate,
  Palette,
  Plus,
  Radio,
  Send,
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
import { CreateFormDialog } from "./CreateFormDialog";
import { TemplateIcon } from "./TemplateIcon";
import { useToast } from "@/components/ui/Toast";

const START_STEPS = [
  { icon: Layers, title: "Build it", body: "Drag questions in, split them across pages, set what is required." },
  { icon: Palette, title: "Brand it", body: "Your colours, type and logo, applied to every page." },
  { icon: Send, title: "Send it", body: "Publish to a link, embed it, or hand over a QR code." },
];

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
  const router = useRouter();
  const toast = useToast();
  const [creating, setCreating] = useState(false);
  const templates = useQuery(api.templates.list, {});
  const create = useMutation(api.forms.create);
  const forms = useQuery(api.forms.list, { filter: "all" });
  const responses = useQuery(api.responses.list, {});
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
  const recentAnswers = (responses?.responses ?? []).filter((r) => !r.preview).slice(0, 6);

  const empty = !!forms && list.length === 0;

  async function startFrom(slug: string, name: string) {
    try {
      const formId = await create({ templateSlug: slug });
      toast("Form created", { detail: `From ${name}` });
      router.push(`/app/forms/${formId}`);
    } catch (e) {
      toast("Formkit could not create the form", {
        detail: e instanceof Error ? e.message : undefined,
        tone: "error",
      });
    }
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
      {empty && (
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <section className="fk-panel fk-firstrun">
            <span className="fk-firstrun-mark">
              <FilePlus2 size={30} strokeWidth={1.7} aria-hidden />
            </span>
            <h2>No forms yet.</h2>
            <p>Let&rsquo;s make something people actually want to fill out.</p>
            <div style={{ display: "flex", justifyContent: "center", gap: 10, marginTop: 26, flexWrap: "wrap" }}>
              <Button iconLeft={<Plus size={16} strokeWidth={1.8} aria-hidden />} onClick={() => setCreating(true)}>
                Create your first form
              </Button>
              <Link href="/app/templates">
                <Button variant="secondary" iconLeft={<LayoutTemplate size={16} strokeWidth={1.8} aria-hidden />}>
                  Start from a template
                </Button>
              </Link>
            </div>
          </section>
          <div className="fk-grid" data-cols="three">
            {START_STEPS.map((st) => (
              <section key={st.title} className="fk-panel fk-startstep">
                <span className="fk-startstep-mark">
                  <st.icon size={18} strokeWidth={1.8} aria-hidden />
                </span>
                <h3>{st.title}</h3>
                <p>{st.body}</p>
              </section>
            ))}
          </div>
        </div>
      )}

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
          chart={<Sparkbars values={(analytics?.daily ?? []).map((d) => d.responses)} />}
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
          {empty && (
            <div className="fk-panel fk-emptycard">
              <span className="fk-startstep-mark">
                <FileText size={18} strokeWidth={1.8} aria-hidden />
              </span>
              <span style={{ fontSize: 15.5, fontWeight: 500 }}>Nothing here yet</span>
              <span className="fk-proprow-hint" style={{ fontSize: 14, margin: 0 }}>
                Your forms will appear here. Create one, or start from a template.
              </span>
              <div>
                <Button size="sm" iconLeft={<Plus size={15} strokeWidth={1.8} aria-hidden />} onClick={() => setCreating(true)}>
                  Create form
                </Button>
              </div>
            </div>
          )}
          {list.slice(0, 3).map((f) => (
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

      <div className="fk-grid" data-cols="split">
      <section className="fk-panel" data-pad="none">
        <div className="fk-panel-head">
          <h2>Recent responses</h2>
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
              title="No responses yet"
              description="Responses show up here the moment someone submits your first form."
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

      <section className="fk-panel" data-pad="none">
        <div className="fk-panel-head">
          <h2>Quick templates</h2>
          <span className="fk-section-spacer" />
          <Link href="/app/templates">
            <Button variant="ghost" size="sm" iconRight={<ArrowRight size={15} strokeWidth={1.8} aria-hidden />}>
              Library
            </Button>
          </Link>
        </div>
        <div style={{ padding: "0 14px 14px" }}>
          {(templates ?? [])
            .filter((t) => !t.mine)
            .slice(0, 5)
            .map((t) => (
              <button key={t.slug} type="button" className="fk-quicktpl" onClick={() => startFrom(t.slug, t.name)}>
                <span className="fk-quicktpl-mark" style={{ background: t.accent }}>
                  <TemplateIcon name={t.icon} size={17} />
                </span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: "block", fontSize: 15, fontWeight: 500 }}>{t.name}</span>
                  <span className="fk-proprow-hint" style={{ display: "block", fontSize: 13.5, margin: "2px 0 0" }}>
                    {t.questions} questions · {t.topic}
                  </span>
                </span>
                <Plus size={17} strokeWidth={1.8} aria-hidden />
              </button>
            ))}
        </div>
      </section>
      </div>

      {creating && <CreateFormDialog onClose={() => setCreating(false)} />}
    </>
  );
}
