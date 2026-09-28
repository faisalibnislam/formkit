"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import { useFlag } from "./useFlags";
import type { FunctionReturnType } from "convex/server";
import {
  CircleCheck,
  Eye,
  FileSpreadsheet,
  FileText,
  MousePointerClick,
  Percent,
  Timer,
} from "lucide-react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { Button, EmptyState, Input, Segmented, Select } from "@/components/ui";
import { useToast } from "@/components/ui/Toast";
import { BarChart, StatCard, TickBars } from "./ds";
import { downloadAnalytics, duration, signed, ymd } from "./analyticsExport";

/**
 * Analytics. Every number is counted from stored data inside the range picked
 * — there is no modelled curve here, and a form nobody has opened says so.
 * Each figure is compared with the same length of time just before it.
 */

type Data = FunctionReturnType<typeof api.analytics.overview>;
type Range = "7" | "30" | "90" | "custom";

const DAY = 24 * 60 * 60 * 1000;

function midnight(at: number) {
  const d = new Date(at);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function parseYmd(s: string) {
  const [y, m, d] = s.split("-").map(Number);
  return y && m && d ? new Date(y, m - 1, d).getTime() : NaN;
}



function rangeLabel(from: number, to: number) {
  const a = new Date(from);
  const b = new Date(to - 1);
  const month = (d: Date) => d.toLocaleDateString("en-GB", { month: "long" });
  if (a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth()) {
    return a.getDate() === b.getDate()
      ? `${a.getDate()} ${month(a)} ${a.getFullYear()}.`
      : `${a.getDate()}–${b.getDate()} ${month(a)} ${a.getFullYear()}.`;
  }
  const full = (d: Date) => `${d.getDate()} ${month(d)}${d.getFullYear() !== b.getFullYear() ? ` ${d.getFullYear()}` : ""}`;
  return `${full(a)} – ${full(b)} ${b.getFullYear()}.`;
}

/** The daily rows, gathered into as many bars as the panel reads well. */
function bars(daily: Data["daily"]) {
  const size = daily.length <= 14 ? 1 : daily.length <= 45 ? 3 : 7;
  const out: { label: string; value: number }[] = [];
  for (let i = 0; i < daily.length; i += size) {
    const slice = daily.slice(i, i + size);
    const at = slice[0]!.at;
    out.push({
      label:
        size === 1 && daily.length <= 7
          ? new Date(at).toLocaleDateString("en-US", { weekday: "short" })
          : new Date(at).toLocaleDateString("en-US", { day: "numeric", month: "short" }),
      value: slice.reduce((n, d) => n + d.responses, 0),
    });
  }
  // More than eight labels crowd each other; every other one says enough.
  return out.length > 8 ? out.map((b, i) => ({ ...b, label: i % 2 === 0 ? b.label : "" })) : out;
}

export function Analytics({ formId }: { formId?: Id<"forms"> }) {
  const toast = useToast();
  const record = useMutation(api.exports.record);
  const [range, setRange] = useState<Range>("30");
  const [picked, setPicked] = useState<string>("all");
  const [today] = useState(() => midnight(Date.now()));
  const [custom, setCustom] = useState(() => ({
    from: ymd(new Date(new Date(today).getFullYear(), new Date(today).getMonth(), 1).getTime()),
    to: ymd(today),
  }));
  const forms = useQuery(api.forms.list, formId ? "skip" : { filter: "all" });

  const scope = formId ?? (picked !== "all" ? (picked as Id<"forms">) : undefined);
  const span = (() => {
    if (range !== "custom") {
      const days = Number(range);
      return { from: today - (days - 1) * DAY, to: today + DAY };
    }
    const a = parseYmd(custom.from);
    const b = parseYmd(custom.to);
    if (Number.isNaN(a) || Number.isNaN(b)) return { from: today - 29 * DAY, to: today + DAY };
    const [lo, hi] = a <= b ? [a, b] : [b, a];
    return { from: Math.max(lo, hi - 365 * DAY), to: hi + DAY };
  })();
  const data = useQuery(api.analytics.overview, { formId: scope, from: span.from, to: span.to });

  const note =
    range === "7"
      ? "Last seven days, to today."
      : range === "30"
        ? "Last 30 days, to today."
        : range === "90"
          ? "Last 90 days, to today."
          : rangeLabel(span.from, span.to);

  const excel = useFlag("exports.xlsx");

  function exportAnalytics(format: "csv" | "xlsx") {
    if (!data) return;
    const title =
      scope && forms?.forms ? (forms.forms.find((f) => f._id === scope)?.title ?? "Form") : formId ? "This form" : "All forms";
    const filename = downloadAnalytics(data, title, format);
    void record({
      formId: scope,
      what: "analytics",
      format,
      filename,
      rows: data.daily.length,
      from: data.from,
      to: data.to,
    });
    toast(`${format === "xlsx" ? "Excel" : "CSV"} file downloaded`, { detail: `Analytics for ${note.replace(/\.$/, "").toLowerCase()}` });
  }

  const noForms = data && data.formCount === 0;
  const chart = data ? bars(data.daily) : [];
  const quiet = data ? data.views === 0 && data.responses === 0 : true;
  const neverStart = data && data.views ? Math.max(0, Math.round((1 - data.starts / data.views) * 100)) : null;
  const finish = data && data.starts ? Math.round((data.completed / data.starts) * 100) : null;
  const dropPeak = Math.max(1, ...(data?.dropOff ?? []).map((q) => q.share));

  return (
    <>
      <div className="fk-resp-toolbar">
        <Segmented
          ariaLabel="How far back"
          value={range}
          onChange={setRange}
          options={[
            { value: "7", label: "7 days" },
            { value: "30", label: "30 days" },
            { value: "90", label: "90 days" },
            { value: "custom", label: "Custom" },
          ]}
        />
        {range === "custom" && (
          <span className="fk-daterange">
            <Input
              type="date"
              aria-label="From"
              value={custom.from}
              max={custom.to || ymd(today)}
              onChange={(e) => setCustom((c) => ({ ...c, from: e.target.value }))}
            />
            <span aria-hidden>–</span>
            <Input
              type="date"
              aria-label="To"
              value={custom.to}
              min={custom.from}
              max={ymd(today)}
              onChange={(e) => setCustom((c) => ({ ...c, to: e.target.value }))}
            />
          </span>
        )}
        <span className="fk-range-note">{note}</span>
        {!formId && (
          <Select
            size="sm"
            value={picked}
            onChange={setPicked}
            ariaLabel="Which form"
            options={[
              { value: "all", label: "All forms" },
              ...(forms?.forms ?? []).map((f) => ({ value: f._id, label: f.title })),
            ]}
          />
        )}
        <span className="fk-section-spacer" />
        {excel && (
          <Button
            variant="secondary"
            disabled={!data || !!noForms}
            onClick={() => exportAnalytics("xlsx")}
            iconLeft={<FileSpreadsheet size={16} strokeWidth={1.8} aria-hidden />}
          >
            Export Excel
          </Button>
        )}
        <Button
          variant="secondary"
          disabled={!data || !!noForms}
          onClick={() => exportAnalytics("csv")}
          iconLeft={<FileText size={16} strokeWidth={1.8} aria-hidden />}
        >
          Export CSV
        </Button>
      </div>

      <div className="fk-grid" data-cols="stats-sm">
        <StatCard
          icon={<Eye size={16} strokeWidth={1.9} aria-hidden />}
          label="Views"
          value={noForms ? "0" : (data?.views ?? 0).toLocaleString("en-US")}
          delta={signed(data?.change.views)}
          deltaTone={(data?.change.views ?? 0) >= 0 ? "up" : "down"}
        />
        <StatCard
          icon={<MousePointerClick size={16} strokeWidth={1.9} aria-hidden />}
          label="Started"
          value={noForms ? "0" : (data?.starts ?? 0).toLocaleString("en-US")}
          delta={signed(data?.change.starts)}
          deltaTone={(data?.change.starts ?? 0) >= 0 ? "up" : "down"}
        />
        <StatCard
          icon={<CircleCheck size={16} strokeWidth={1.9} aria-hidden />}
          label="Completed"
          value={noForms ? "0" : (data?.completed ?? 0).toLocaleString("en-US")}
          delta={signed(data?.change.completed)}
          deltaTone={(data?.change.completed ?? 0) >= 0 ? "up" : "down"}
          tone="sky"
        />
        <StatCard
          icon={<Percent size={16} strokeWidth={1.9} aria-hidden />}
          label="Completion rate"
          value={data?.completionRate === null || data?.completionRate === undefined ? "—" : `${data.completionRate}%`}
          delta={signed(data?.change.completionRate, "pts")}
          deltaTone={(data?.change.completionRate ?? 0) >= 0 ? "up" : "down"}
          tone="ink"
        />
        <StatCard
          icon={<Timer size={16} strokeWidth={1.9} aria-hidden />}
          label="Average time"
          value={duration(data?.medianSeconds ?? null)}
          delta={signed(data?.change.medianSeconds, "s")}
          deltaTone={(data?.change.medianSeconds ?? 0) >= 0 ? "up" : "down"}
        />
      </div>

      {noForms ? (
        <section className="fk-panel">
          <EmptyState
            title="Nothing to measure yet."
            description="Views, drop-off and completion appear here once a form is out in the world."
          />
        </section>
      ) : (
        data && (
          <>
            <div className="fk-grid" data-cols="two" style={{ alignItems: "start" }}>
              <section className="fk-panel">
                <h3>Responses over time</h3>
                {quiet ? (
                  <EmptyState title="Nothing in this range" description="Try a longer range, or share the form." />
                ) : (
                  <BarChart
                    height={210}
                    bars={chart.map((b, i) => ({
                      label: b.label,
                      value: b.value,
                      tone: i === chart.length - 1 ? "marker" : "positive",
                    }))}
                  />
                )}
              </section>

              <section className="fk-panel">
                <h3>Completion funnel</h3>
                {data.views === 0 && data.responses === 0 ? (
                  <EmptyState title="Nobody has opened it yet" description="The funnel fills as people arrive." />
                ) : (
                  <>
                    <div className="fk-funnel-steps">
                      {[
                        { name: "Views", count: data.views },
                        { name: "Started", count: data.starts },
                        { name: "Completed", count: data.completed },
                      ].map((step) => {
                        const top = Math.max(1, data.views, data.starts, data.completed);
                        const share = Math.round((step.count / top) * 1000) / 10;
                        return (
                          <div key={step.name} className="fk-funnel-step">
                            <div className="fk-funnel-step-head">
                              <strong>{step.count.toLocaleString("en-US")}</strong>
                              <span>{step.name}</span>
                            </div>
                            <TickBars
                              value={share}
                              tone={step.name === "Completed" ? "info" : "positive"}
                              footRight={`${share}%`}
                            />
                          </div>
                        );
                      })}
                    </div>
                    <p className="fk-panel-lede" style={{ margin: "20px 0 0" }}>
                      {neverStart !== null
                        ? `${neverStart}% of people who open the form never start it.`
                        : "Views are counted from the moment a form is published."}
                      {finish !== null && ` Of those who start, ${Math.min(100, finish)}% send it.`}
                    </p>
                  </>
                )}
              </section>
            </div>

            <div className="fk-grid" data-cols="two" style={{ alignItems: "start" }}>
              {scope ? (
                <section className="fk-panel">
                  <h3>Question drop-off</h3>
                  <p className="fk-panel-lede">Share of people who leave on each question.</p>
                  {data.dropOff.length === 0 ? (
                    <p className="fk-quiet">This form has no questions yet.</p>
                  ) : (
                    <div className="fk-droprows">
                      {data.dropOff.map((q, i) => (
                        <div key={i} className="fk-droprow">
                          <span className="fk-droprow-label">
                            {String(i + 1).padStart(2, "0")} {q.title}
                          </span>
                          <span className="fk-droprow-meter">
                            <TickBars
                              value={(q.share / dropPeak) * 100}
                              ticks={34}
                              height={18}
                              tone={q.share >= 15 ? "negative" : "positive"}
                            />
                          </span>
                          <span className="fk-droprow-pct">{q.share}%</span>
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
                  <div className="fk-rows">
                    {data.forms.map((f) => (
                      <Link key={f._id} href={`/app/forms/${f._id}?tab=analytics`} className="fk-row">
                        <span className="fk-row-main">
                          <span className="fk-row-title">{f.title}</span>
                          <span className="fk-row-meta">
                            {f.inRange.toLocaleString("en-US")} in this range · {f.responses.toLocaleString("en-US")} in
                            all · {f.completionRate}% completed
                          </span>
                        </span>
                        <span style={{ flex: "0 0 160px", maxWidth: 160 }}>
                          <TickBars value={f.completionRate} ticks={32} height={18} />
                        </span>
                      </Link>
                    ))}
                  </div>
                </section>
              )}

              <section>
                <h3 className="fk-outside-title">Where people come from</h3>
                <div className="fk-panel" data-pad="none">
                  {data.sources.length === 0 ? (
                    <div style={{ padding: 24 }}>
                      <p className="fk-quiet" style={{ margin: 0 }}>
                        Nothing recorded in this range.
                      </p>
                    </div>
                  ) : (
                    <div className="fk-table-wrap">
                      <table className="fk-table" data-static="true">
                        <thead>
                          <tr>
                            <th scope="col">Source</th>
                            <th scope="col" style={{ textAlign: "right" }}>
                              Views
                            </th>
                            <th scope="col" style={{ textAlign: "right" }}>
                              Completion
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {data.sources.map((s) => (
                            <tr key={s.name}>
                              <td className="fk-table-name" style={{ whiteSpace: "normal" }}>
                                {s.name}
                              </td>
                              <td className="fk-table-quiet" style={{ textAlign: "right" }}>
                                {s.views.toLocaleString("en-US")}
                              </td>
                              <td style={{ textAlign: "right" }}>
                                {s.completion === null ? `${s.completed} sent` : `${Math.min(100, s.completion)}%`}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </section>
            </div>
          </>
        )
      )}
    </>
  );
}
