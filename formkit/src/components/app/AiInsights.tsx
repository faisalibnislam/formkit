"use client";

import { useState } from "react";
import Link from "next/link";
import { useAction, useQuery } from "convex/react";
import { AlertTriangle, Flame, Gauge, MailCheck, Smile, Sparkles, ThumbsUp } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { Button } from "@/components/ui";
import { useToast } from "@/components/ui/Toast";
import { LockedNote } from "@/components/plan/UpgradeSheet";
import { upgradeOnPlanError } from "@/components/plan/usePlan";
import { BarChart, StatCard, TickBars } from "./ds";
import { errorText } from "./settings/bits";
import { relativeTime } from "./bits";

/**
 * Business: what the AI read across a form's responses — for forms with AI
 * replies. How people feel, what they want, which topics come up and how
 * promising each is, who to follow up, and how the replies landed; with a
 * written report on demand.
 */

const SENTIMENT = [
  { key: "positive", label: "Positive", color: "var(--color-chart-positive)" },
  { key: "neutral", label: "Neutral", color: "var(--neutral-300)" },
  { key: "negative", label: "Negative", color: "var(--color-chart-negative)" },
] as const;

const pct = (n: number, of: number) => (of ? Math.round((n / of) * 100) : 0);

export function AiInsights({ formId, from, to }: { formId: Id<"forms">; from: number; to: number }) {
  const toast = useToast();
  const data = useQuery(api.insights.overview, { formId, from, to });
  const report = useAction(api.insights.report);
  const [writing, setWriting] = useState(false);

  if (!data) return null;
  if (data.locked) {
    return (
      <section className="fk-panel">
        <h3>AI insights</h3>
        <LockedNote feature="ai.insights">
          How people feel, what they want and which responses are worth a call — read by AI from every response.
        </LockedNote>
      </section>
    );
  }

  const n = data.read;
  const s = Object.fromEntries(data.sentiment.map((x) => [x.key, x.count])) as Record<string, number>;
  const u = Object.fromEntries(data.urgency.map((x) => [x.key, x.count])) as Record<string, number>;
  const topicPeak = Math.max(1, ...data.topics.map((t) => t.count));
  const rated = data.replies.helpful + data.replies.unhelpful;

  async function write() {
    setWriting(true);
    try {
      await report({ formId });
      toast("Report written");
    } catch (e) {
      if (!upgradeOnPlanError(e)) toast(errorText(e, "The report could not be written. Try again in a minute."));
    } finally {
      setWriting(false);
    }
  }

  const bars = (() => {
    // Weekly once the range is long, so the bars stay readable.
    const step = data.daily.length > 45 ? 7 : 1;
    const out: { label: string; value: number; tone: "positive" | "marker" }[] = [];
    const every = Math.ceil(data.daily.length / step / 8);
    for (let i = 0; i < data.daily.length; i += step) {
      const chunk = data.daily.slice(i, i + step);
      const d = new Date(chunk[0]!.at);
      const count = chunk.reduce((a, c) => a + c.count, 0);
      const neg = chunk.reduce((a, c) => a + c.negative, 0);
      out.push({
        // Every few bars carry a date, so the labels never run into each other.
        label: (i / step) % every === 0 ? d.toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "",
        value: count,
        tone: count && neg / count >= 0.4 ? "marker" : "positive",
      });
    }
    return out;
  })();

  return (
    <div className="fk-insights">
      <div className="fk-insights-head">
        <div>
          <h2 style={{ display: "flex", alignItems: "center", gap: 10, margin: 0 }}>
            <Sparkles size={20} strokeWidth={1.8} aria-hidden style={{ display: "inline-block" }} />
            AI insights
          </h2>
          <p className="fk-panel-lede" style={{ margin: "6px 0 0" }}>
            Read by AI from {n.toLocaleString("en-US")} of {data.total.toLocaleString("en-US")} responses in this range, as
            it wrote each reply.
          </p>
        </div>
      </div>

      {n === 0 ? (
        <section className="fk-panel">
          <p className="fk-quiet" style={{ margin: 0 }}>
            Nothing read yet in this range. Insights appear as responses get their AI replies.
          </p>
        </section>
      ) : (
        <>
          <div className="fk-grid" data-cols="stats-sm">
            <StatCard
              icon={<Smile size={16} strokeWidth={1.9} aria-hidden />}
              label="Positive"
              value={`${pct(s.positive ?? 0, n)}%`}
              caption={`${s.negative ?? 0} negative`}
            />
            <StatCard
              icon={<Gauge size={16} strokeWidth={1.9} aria-hidden />}
              label="Average lead score"
              value={data.averageScore ?? "—"}
              caption="Out of 100, by your goal"
            />
            <StatCard
              icon={<Flame size={16} strokeWidth={1.9} aria-hidden />}
              label="Urgent"
              value={(u.high ?? 0).toLocaleString("en-US")}
              caption={`${data.followUp.length} to follow up`}
            />
            <StatCard
              icon={<ThumbsUp size={16} strokeWidth={1.9} aria-hidden />}
              label="Replies found helpful"
              value={rated ? `${pct(data.replies.helpful, rated)}%` : "—"}
              caption={rated ? `${rated} rated` : "Nobody has rated one yet"}
            />
          </div>

          <div className="fk-grid" data-cols="two" style={{ alignItems: "start" }}>
            <section className="fk-panel">
              <h3>How people feel</h3>
              <div className="fk-sentbar" role="img" aria-label={SENTIMENT.map((x) => `${x.label} ${pct(s[x.key] ?? 0, n)}%`).join(", ")}>
                {SENTIMENT.map((x) =>
                  s[x.key] ? <span key={x.key} style={{ width: `${pct(s[x.key]!, n)}%`, background: x.color }} /> : null,
                )}
              </div>
              <div className="fk-sentlegend">
                {SENTIMENT.map((x) => (
                  <span key={x.key}>
                    <i style={{ background: x.color }} aria-hidden />
                    {x.label} <strong>{pct(s[x.key] ?? 0, n)}%</strong>
                  </span>
                ))}
              </div>
              <h3 style={{ marginTop: 24 }}>Read each day</h3>
              <p className="fk-panel-lede">Yellow marks a day when 40% or more felt negative.</p>
              <BarChart height={170} bars={bars} />
            </section>

            <section className="fk-panel">
              <h3>What comes up</h3>
              <p className="fk-panel-lede">Topics the AI noted, how often, and the average lead score of each.</p>
              <div className="fk-droprows">
                {data.topics.map((t) => (
                  <div key={t.name} className="fk-droprow">
                    <span className="fk-droprow-label">{t.name}</span>
                    <span className="fk-droprow-meter">
                      <TickBars
                        value={(t.count / topicPeak) * 100}
                        ticks={30}
                        height={18}
                        tone={t.negative > t.positive ? "negative" : "positive"}
                      />
                    </span>
                    <span className="fk-droprow-pct" title={t.averageScore === null ? undefined : `Average score ${t.averageScore}`}>
                      {t.count}
                      {t.averageScore !== null && <em> · {t.averageScore}</em>}
                    </span>
                  </div>
                ))}
              </div>
              {data.intents.length > 0 && (
                <>
                  <h3 style={{ marginTop: 22 }}>What they want</h3>
                  <div className="fk-insight-chips">
                    {data.intents.map((i) => (
                      <span key={i.name} className="fk-insight-chip">
                        {i.name} <strong style={{ fontWeight: 500 }}>{i.count}</strong>
                      </span>
                    ))}
                  </div>
                </>
              )}
            </section>
          </div>

          <div className="fk-grid" data-cols="two" style={{ alignItems: "start" }}>
            <section className="fk-panel" data-pad="none">
              <div className="fk-panel-head">
                <h2>Most promising</h2>
              </div>
              <PeopleRows formId={formId} people={data.leads} empty="No scores in this range yet." />
              <div style={{ padding: "4px 24px 22px" }}>
                <div className="fk-proprow-hint" style={{ marginBottom: 8 }}>
                  Lead scores
                </div>
                <BarChart height={120} bars={data.scores.map((b) => ({ label: b.label, value: b.count }))} />
              </div>
            </section>
            <section className="fk-panel" data-pad="none">
              <div className="fk-panel-head">
                <h2>Worth a personal reply</h2>
              </div>
              <PeopleRows
                formId={formId}
                people={data.followUp}
                empty="Nothing urgent, and nothing the AI flagged for a person."
                flag
              />
              <div className="fk-insights-replies">
                <span>
                  <MailCheck size={14} strokeWidth={1.8} aria-hidden /> {data.replies.written} replies written ·{" "}
                  {data.replies.emailed} emailed
                </span>
                {(data.replies.failed > 0 || data.replies.skipped > 0) && (
                  <span>
                    {data.replies.failed > 0 && `${data.replies.failed} failed`}
                    {data.replies.failed > 0 && data.replies.skipped > 0 && " · "}
                    {data.replies.skipped > 0 && `${data.replies.skipped} skipped — out of replies`}
                  </span>
                )}
              </div>
            </section>
          </div>

          <section className="fk-panel fk-report">
            <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: 220 }}>
                <h3 style={{ margin: "0 0 6px" }}>The AI’s report</h3>
                <p className="fk-panel-lede" style={{ margin: 0 }}>
                  {data.report
                    ? `Read across ${data.report.count} responses, ${relativeTime(data.report.at)}.`
                    : "Reads across your latest responses and says what stands out: themes, opportunities, risks and what to do next."}
                </p>
              </div>
              <Button
                variant="secondary"
                disabled={writing}
                iconLeft={<Sparkles size={15} strokeWidth={1.8} aria-hidden />}
                onClick={() => void write()}
              >
                {writing ? "Reading…" : data.report ? "Write a new one" : "Write a report"}
              </Button>
            </div>
            {data.report && (
              <div className="fk-report-body">
                <p className="fk-report-headline">{data.report.headline}</p>
                {data.report.themes.length > 0 && (
                  <div className="fk-report-themes">
                    {data.report.themes.map((t, i) => (
                      <div key={i} className="fk-report-theme">
                        <div className="fk-report-theme-head">
                          <strong>{t.title}</strong>
                          {typeof t.share === "number" && <span>about {t.share}%</span>}
                        </div>
                        <p>{t.detail}</p>
                      </div>
                    ))}
                  </div>
                )}
                <div className="fk-report-cols">
                  <ReportList title="Opportunities" items={data.report.opportunities} />
                  <ReportList title="Worth watching" items={data.report.risks} />
                  <ReportList title="What to do next" items={data.report.suggestions} />
                </div>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function ReportList({ title, items }: { title: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <div>
      <div className="fk-resp-group-title">{title}</div>
      <ul>
        {items.map((x, i) => (
          <li key={i}>{x}</li>
        ))}
      </ul>
    </div>
  );
}

type Person = {
  _id: Id<"responses">;
  name: string;
  at: number;
  score: number | null;
  intent: string | null;
  urgency: "low" | "medium" | "high" | null;
  sentiment: "positive" | "neutral" | "negative" | null;
  summary: string | null;
};

function PeopleRows({ formId, people, empty, flag }: { formId: Id<"forms">; people: Person[]; empty: string; flag?: boolean }) {
  if (!people.length) {
    return (
      <p className="fk-quiet" style={{ padding: "0 24px 18px", margin: 0 }}>
        {empty}
      </p>
    );
  }
  return (
    <div className="fk-rows">
      {people.map((p) => (
        <Link key={p._id} href={`/app/forms/${formId}?tab=responses&open=${p._id}`} className="fk-row">
          <span className="fk-row-main">
            <span className="fk-row-title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {flag && p.urgency === "high" && (
                <AlertTriangle size={14} strokeWidth={1.8} aria-hidden style={{ display: "inline-block", color: "var(--red-600)" }} />
              )}
              {p.name}
            </span>
            <span className="fk-row-meta">{p.summary ?? p.intent ?? relativeTime(p.at)}</span>
          </span>
          {p.score !== null && <span className="fk-lead-score">{p.score}</span>}
        </Link>
      ))}
    </div>
  );
}
