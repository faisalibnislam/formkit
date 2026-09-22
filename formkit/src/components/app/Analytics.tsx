"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { EmptyState, ProgressBar } from "@/components/ui";
import { Stat } from "./bits";

/**
 * Analytics. Every number is counted from stored data — there is no modelled
 * curve here, and a form nobody has opened says so.
 */
export function Analytics({ formId }: { formId?: Id<"forms"> }) {
  const data = useQuery(api.analytics.overview, { formId, days: 30 });
  if (!data) return null;

  const peak = Math.max(1, ...data.buckets.map((b) => b.count));
  const quiet = data.responses === 0 && data.views === 0;

  return (
    <>
      <div className="fk-grid" data-cols="stats">
        <Stat label="Opened" value={data.views} note="Last 30 days" />
        <Stat label="Started" value={data.starts} />
        <Stat label="Completed" value={data.completed} note={`${data.partial} partial`} />
        <Stat
          label="Finished of opened"
          value={`${data.finishRate}%`}
          note={
            data.medianSeconds !== null
              ? `Typically ${Math.round(data.medianSeconds / 60) || 1} min`
              : "No timings yet"
          }
        />
      </div>

      <section className="fk-panel">
        <h3>Responses a day</h3>
        <p className="fk-panel-lede">The last 30 days, one bar a day.</p>
        {quiet ? (
          <EmptyState
            title="Nothing to chart yet"
            description="Numbers appear once a form is collecting."
          />
        ) : (
          <>
            <div className="fk-bars">
              {data.buckets.map((b) => (
                <div
                  key={b.at}
                  className="fk-bar"
                  data-empty={b.count === 0 ? "true" : undefined}
                  style={{ height: `${Math.max(3, (b.count / peak) * 100)}%` }}
                  title={`${b.label}: ${b.count}`}
                />
              ))}
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginTop: 10,
                fontSize: 12.5,
                color: "var(--color-text-tertiary)",
              }}
            >
              <span>{data.buckets[0]?.label}</span>
              <span>{data.buckets[data.buckets.length - 1]?.label}</span>
            </div>
          </>
        )}
      </section>

      {formId ? (
        <section className="fk-panel">
          <h3>Where people stop</h3>
          <p className="fk-panel-lede">
            How many of everyone who answered got as far as each question.
          </p>
          {data.dropOff.length === 0 ? (
            <EmptyState title="No answers yet" description="This appears with the first response." />
          ) : (
            <div className="fk-funnel">
              {data.dropOff.map((q, i) => (
                <div key={i} className="fk-funnel-row">
                  <span
                    style={{
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      color: "var(--color-text-secondary)",
                    }}
                    title={q.title}
                  >
                    {q.title}
                  </span>
                  <ProgressBar value={q.share} />
                  <span style={{ textAlign: "right", color: "var(--color-text-tertiary)" }}>
                    {q.share}%
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      ) : (
        <section className="fk-panel" data-pad="none">
          <div style={{ padding: "22px 24px 14px" }}>
            <h3 style={{ margin: 0 }}>Form by form</h3>
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
                      {f.views} opened · {f.responses} responses · {f.completionRate}% completed
                    </span>
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
            <p style={{ margin: 0, fontSize: 14, color: "var(--color-text-tertiary)" }}>
              Nothing recorded yet.
            </p>
          ) : (
            <div className="fk-funnel">
              {data.devices.map((d) => (
                <div key={d.name} className="fk-funnel-row">
                  <span>{d.name}</span>
                  <ProgressBar value={(d.count / Math.max(1, data.responses)) * 100} />
                  <span style={{ textAlign: "right", color: "var(--color-text-tertiary)" }}>
                    {d.count}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="fk-panel">
          <h3>Where they came from</h3>
          <p className="fk-panel-lede">The page that sent them, when a browser passes one on.</p>
          {data.sources.length === 0 ? (
            <p style={{ margin: 0, fontSize: 14, color: "var(--color-text-tertiary)" }}>
              Nothing recorded yet.
            </p>
          ) : (
            <div className="fk-funnel">
              {data.sources.map((s) => (
                <div key={s.name} className="fk-funnel-row">
                  <span
                    style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                    title={s.name}
                  >
                    {s.name}
                  </span>
                  <ProgressBar value={(s.count / Math.max(1, data.responses)) * 100} />
                  <span style={{ textAlign: "right", color: "var(--color-text-tertiary)" }}>
                    {s.count}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </>
  );
}
