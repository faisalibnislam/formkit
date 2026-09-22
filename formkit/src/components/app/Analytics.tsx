"use client";

import { useState } from "react";
import Link from "next/link";
import { useConvex, useQuery } from "convex/react";
import { CircleCheck, Clock, Eye, FileDown, MousePointerClick, Percent } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { Button, EmptyState } from "@/components/ui";
import { useToast } from "@/components/ui/Toast";
import { BarChart, StatCard, TickBars } from "./ds";

/**
 * Analytics. Every number is counted from stored data — there is no modelled
 * curve here, and a form nobody has opened says so.
 *
 * Only the figures that carry a timestamp show a change against the window
 * before: views and starts are lifetime counters, so there is nothing earlier
 * to compare them with and no delta is drawn rather than one invented.
 */

const RANGES = [7, 30, 90] as const;

function signed(value: number | null, suffix = "%") {
  if (value === null) return undefined;
  return `${value > 0 ? "+" : ""}${value}${suffix}`;
}

function duration(seconds: number | null) {
  if (seconds === null) return "—";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m ? `${m}m ${String(s).padStart(2, "0")}s` : `${s}s`;
}

/** The daily buckets, gathered into the weeks the chart actually shows. */
function weekly(buckets: { at: number; count: number }[]) {
  const weeks: { label: string; value: number }[] = [];
  for (let i = 0; i < buckets.length; i += 7) {
    const slice = buckets.slice(i, i + 7);
    weeks.push({
      label: `W${weeks.length + 1}`,
      value: slice.reduce((n, b) => n + b.count, 0),
    });
  }
  return weeks;
}

export function Analytics({ formId }: { formId?: Id<"forms"> }) {
  const toast = useToast();
  const convex = useConvex();
  const [days, setDays] = useState<number>(30);
  const data = useQuery(api.analytics.overview, { formId, days });

  if (!data) return null;

  const quiet = data.responses === 0 && data.views === 0;
  /* `change` and `window` arrived with this screen. Reading them defensively
     means a deployment whose functions have not been pushed yet shows the
     figures without deltas rather than a blank page. */
  const change = data.change ?? { responses: null, completed: null, completionRate: null };
  const windowed = data.window ?? { responses: data.responses, completed: data.completed };
  const bars = weekly(data.buckets);
  const lastBar = bars.length - 1;

  async function download(kind: "csv" | "excel") {
    if (!formId) {
      toast("Pick a form first", { detail: "Exports come from one form at a time." });
      return;
    }
    const sheet = await convex.query(api.responses.forExport, { formId });
    const sep = kind === "excel" ? "\t" : ",";
    const cell = (v: string) =>
      kind === "excel"
        ? v.replace(/[\t\r\n]/g, " ")
        : /[",\r\n]/.test(v)
          ? `"${v.replace(/"/g, '""')}"`
          : v;
    const text = [sheet.columns, ...sheet.rows].map((r) => r.map(cell).join(sep)).join("\r\n");
    const blob = new Blob([kind === "csv" ? "﻿" + text : text], {
      type: kind === "csv" ? "text/csv;charset=utf-8" : "text/tab-separated-values;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${sheet.filename}.${kind === "csv" ? "csv" : "xls"}`;
    a.click();
    URL.revokeObjectURL(url);
    toast(`${sheet.rows.length} ${sheet.rows.length === 1 ? "response" : "responses"} exported`);
  }

  return (
    <>
      <div className="fk-range-row">
        <div className="fk-segmented" role="group" aria-label="How far back">
          {RANGES.map((r) => (
            <button key={r} type="button" aria-pressed={days === r} onClick={() => setDays(r)}>
              {r} days
            </button>
          ))}
        </div>
        <span className="fk-range-note">Last {days} days, to today.</span>
        <span className="fk-section-spacer" />
        {formId && (
          <>
            <Button
              variant="secondary"
              onClick={() => download("excel")}
              iconLeft={<FileDown size={16} strokeWidth={1.8} aria-hidden />}
            >
              Export Excel
            </Button>
            <Button
              variant="secondary"
              onClick={() => download("csv")}
              iconLeft={<FileDown size={16} strokeWidth={1.8} aria-hidden />}
            >
              Export CSV
            </Button>
          </>
        )}
      </div>

      <div className="fk-grid" data-cols="stats-sm">
        <StatCard
          icon={<Eye size={16} strokeWidth={1.9} aria-hidden />}
          label="Views"
          value={data.views.toLocaleString()}
          caption="Since the form went live"
        />
        <StatCard
          icon={<MousePointerClick size={16} strokeWidth={1.9} aria-hidden />}
          label="Started"
          value={data.starts.toLocaleString()}
          caption="Since the form went live"
        />
        <StatCard
          icon={<CircleCheck size={16} strokeWidth={1.9} aria-hidden />}
          label="Completed"
          value={windowed.completed.toLocaleString()}
          delta={signed(change.completed)}
          deltaTone={(change.completed ?? 0) >= 0 ? "up" : "down"}
          tone="sky"
        />
        <StatCard
          icon={<Percent size={16} strokeWidth={1.9} aria-hidden />}
          label="Completion rate"
          value={`${data.completionRate}%`}
          delta={signed(change.completionRate, "pts")}
          deltaTone={(change.completionRate ?? 0) >= 0 ? "up" : "down"}
          tone="ink"
        />
        <StatCard
          icon={<Clock size={16} strokeWidth={1.9} aria-hidden />}
          label="Average time"
          value={duration(data.medianSeconds)}
          caption="The middle of everyone who finished"
        />
      </div>

      <div className="fk-grid" data-cols="two">
        <section className="fk-panel">
          <h3>Responses over time</h3>
          {quiet ? (
            <EmptyState
              title="Nothing to chart yet"
              description="Numbers appear once a form is collecting."
            />
          ) : (
            <BarChart
              bars={bars.map((b, i) => ({
                label: b.label,
                value: b.value,
                tone: i === lastBar ? "marker" : "positive",
              }))}
            />
          )}
        </section>

        <section className="fk-panel">
          <h3>Completion funnel</h3>
          <p className="fk-panel-lede">
            Of everyone who opened the form, how far they got.
          </p>
          {data.views === 0 ? (
            <EmptyState title="Nobody has opened it yet" description="The funnel fills as people arrive." />
          ) : (
            <div className="fk-funnel-steps">
              {[
                { name: "Views", count: data.views },
                { name: "Started", count: data.starts },
                { name: "Completed", count: data.completed },
              ].map((step) => {
                const share = Math.round((step.count / Math.max(1, data.views)) * 1000) / 10;
                return (
                  <div key={step.name} className="fk-funnel-step">
                    <div className="fk-funnel-step-head">
                      <strong>{share}%</strong>
                      <span>{step.name}</span>
                    </div>
                    <TickBars
                      value={share}
                      tone={share >= 66 ? "positive" : share >= 33 ? "neutral" : "negative"}
                      footLeft={step.count.toLocaleString()}
                      footRight={`${share}%`}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {formId ? (
        <section className="fk-panel">
          <h3>Where people stop</h3>
          <p className="fk-panel-lede">
            How many of everyone who answered got as far as each question.
          </p>
          {data.dropOff.length === 0 ? (
            <EmptyState title="No answers yet" description="This appears with the first response." />
          ) : (
            <div className="fk-funnel-steps">
              {data.dropOff.map((q, i) => (
                <div key={i} className="fk-funnel-step">
                  <div className="fk-funnel-step-head">
                    <strong>{q.share}%</strong>
                    <span title={q.title}>{q.title}</span>
                  </div>
                  <TickBars
                    value={q.share}
                    tone={q.share >= 66 ? "positive" : q.share >= 33 ? "neutral" : "negative"}
                    footLeft={`${q.reached} reached it`}
                  />
                </div>
              ))}
            </div>
          )}
        </section>
      ) : (
        <section className="fk-panel" data-pad="none">
          <div className="fk-panel-head">
            <h2>Form by form</h2>
          </div>
          {data.forms.length === 0 ? (
            <div style={{ padding: "0 24px 24px" }}>
              <EmptyState title="No forms yet" description="Create one and its numbers appear here." />
            </div>
          ) : (
            <div className="fk-rows">
              {data.forms.map((f) => (
                <Link key={f._id} href={`/app/forms/${f._id}?tab=analytics`} className="fk-row">
                  <span className="fk-row-main">
                    <span className="fk-row-title">{f.title}</span>
                    <span className="fk-row-meta">
                      {f.views.toLocaleString()} opened · {f.responses.toLocaleString()} responses ·{" "}
                      {f.completionRate}% completed
                    </span>
                  </span>
                  <span style={{ flex: "0 0 180px", maxWidth: 180 }}>
                    <TickBars value={f.completionRate} ticks={36} height={18} />
                  </span>
                </Link>
              ))}
            </div>
          )}
        </section>
      )}

      <div className="fk-grid" data-cols="two">
        <section className="fk-panel">
          <h3>Devices</h3>
          <p className="fk-panel-lede">What people answered on.</p>
          {data.devices.length === 0 ? (
            <p className="fk-quiet">Nothing recorded yet.</p>
          ) : (
            <div className="fk-funnel-steps">
              {data.devices.map((d) => (
                <div key={d.name} className="fk-funnel-step">
                  <div className="fk-funnel-step-head">
                    <strong>{d.count.toLocaleString()}</strong>
                    <span>{d.name}</span>
                  </div>
                  <TickBars
                    value={(d.count / Math.max(1, data.responses)) * 100}
                    tone="info"
                    ticks={48}
                    height={18}
                  />
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="fk-panel">
          <h3>Where they came from</h3>
          <p className="fk-panel-lede">The page that sent them, when a browser passes one on.</p>
          {data.sources.length === 0 ? (
            <p className="fk-quiet">Nothing recorded yet.</p>
          ) : (
            <div className="fk-funnel-steps">
              {data.sources.map((s) => (
                <div key={s.name} className="fk-funnel-step">
                  <div className="fk-funnel-step-head">
                    <strong>{s.count.toLocaleString()}</strong>
                    <span title={s.name}>{s.name}</span>
                  </div>
                  <TickBars
                    value={(s.count / Math.max(1, data.responses)) * 100}
                    tone="info"
                    ticks={48}
                    height={18}
                  />
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </>
  );
}
