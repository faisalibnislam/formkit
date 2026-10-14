"use client";

import { useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { TickBars } from "./ds";

type Summary = FunctionReturnType<typeof api.analytics.summary>;
type Question = Summary["questions"][number];

const pct = (n: number, of: number) => (of ? Math.round((n / of) * 100) : 0);
const fmt = (n: number) => n.toLocaleString("en-US");

/**
 * The answers to a form, question by question: how choices split, the
 * spread of ratings and scales (with NPS), number and date ranges, and the
 * latest written answers. Contact details are counted, not listed.
 */
export function QuestionSummary({ formId, from, to }: { formId: Id<"forms">; from: number; to: number }) {
  const data = useQuery(api.analytics.summary, { formId, from, to });
  if (!data) return null;
  return (
    <section className="fk-panel">
      <h3>Answers, question by question</h3>
      <p className="fk-panel-lede">
        {data.total === 0
          ? "No finished responses in this range yet."
          : `From ${fmt(data.total)} finished ${data.total === 1 ? "response" : "responses"} in this range${data.capped ? ", the latest ones" : ""}.`}
      </p>
      {data.total > 0 && (
        <div className="fk-summary">
          {data.questions.map((q, i) => (
            <article key={q.blockId} className="fk-summary-q" aria-labelledby={`sum-${q.blockId}`}>
              <h4 id={`sum-${q.blockId}`}>
                <span className="fk-summary-n">{String(i + 1).padStart(2, "0")}</span> {q.title}
              </h4>
              <p className="fk-summary-meta">
                {fmt(q.answered)} answered{data.total ? ` · ${pct(q.answered, data.total)}%` : ""}
              </p>
              <Body q={q} />
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function Body({ q }: { q: Question }) {
  switch (q.kind) {
    case "choice": {
      const of = q.multi ? q.answered : q.options.reduce((n, o) => n + o.count, 0);
      const peak = Math.max(1, ...q.options.map((o) => o.count));
      return (
        <div className="fk-droprows">
          {q.options.map((o) => (
            <div key={o.label} className="fk-droprow">
              <span className="fk-droprow-label">{o.label}</span>
              <span className="fk-droprow-meter">
                <TickBars value={(o.count / peak) * 100} ticks={30} height={16} tone="info" />
              </span>
              <span className="fk-droprow-pct">
                {pct(o.count, of)}% <span className="fk-quiet">({fmt(o.count)})</span>
              </span>
            </div>
          ))}
          {q.multi && <p className="fk-quiet" style={{ margin: "6px 0 0" }}>People could pick more than one.</p>}
        </div>
      );
    }
    case "scale": {
      const peak = Math.max(1, ...q.counts);
      return (
        <>
          {q.nps ? (
            <p className="fk-summary-big">
              NPS <strong>{q.nps.score > 0 ? `+${q.nps.score}` : q.nps.score}</strong>
              <span className="fk-quiet">
                {" "}
                · {fmt(q.nps.promoters)} promoters, {fmt(q.nps.passives)} passives, {fmt(q.nps.detractors)} detractors
              </span>
            </p>
          ) : (
            q.average !== null && (
              <p className="fk-summary-big">
                Average <strong>{q.average}</strong> <span className="fk-quiet">out of {q.to}</span>
              </p>
            )
          )}
          <div className="fk-summary-spread" role="img" aria-label={q.counts.map((c, i) => `${q.from + i}: ${c}`).join(", ")}>
            {q.counts.map((c, i) => (
              <div key={i} className="fk-summary-col">
                <span className="fk-summary-bar" style={{ height: `${Math.max(4, (c / peak) * 100)}%` }} data-empty={c === 0 ? "true" : undefined} />
                <span className="fk-summary-tick">{q.from + i}</span>
              </div>
            ))}
          </div>
        </>
      );
    }
    case "number":
      return q.average === null ? null : (
        <p className="fk-summary-big">
          Average <strong>{fmt(q.average)}</strong>
          <span className="fk-quiet">
            {" "}
            · median {fmt(q.median ?? 0)} · from {fmt(q.min ?? 0)} to {fmt(q.max ?? 0)}
          </span>
        </p>
      );
    case "date":
      return q.earliest ? (
        <p className="fk-summary-big">
          From <strong>{q.earliest}</strong> to <strong>{q.latest}</strong>
        </p>
      ) : null;
    case "text":
      return q.latest.length ? (
        <ul className="fk-summary-latest">
          {q.latest.map((t, i) => (
            <li key={i}>{t}</li>
          ))}
        </ul>
      ) : null;
    case "matrix": {
      const cols = { gridTemplateColumns: `minmax(120px, 1.6fr) repeat(${q.columns.length}, minmax(56px, 1fr))` };
      return (
        <div className="fk-summary-matrix" role="table" aria-label={`Answers to ${q.title}, row by row`}>
          <div role="row" className="fk-summary-matrix-head" style={cols}>
            <span role="columnheader" />
            {q.columns.map((c) => (
              <span key={c} role="columnheader">
                {c}
              </span>
            ))}
          </div>
          {q.rows.map((r) => {
            const total = r.counts.reduce((a, b) => a + b, 0);
            return (
              <div key={r.label} role="row" style={cols}>
                <span role="rowheader">{r.label}</span>
                {r.counts.map((n, i) => (
                  <span key={i} role="cell" style={{ background: `rgba(46, 120, 187, ${total ? (n / total) * 0.55 : 0})` }}>
                    {total ? `${pct(n, total)}%` : "-"}
                  </span>
                ))}
              </div>
            );
          })}
        </div>
      );
    }
    case "ranking":
      return (
        <ol className="fk-summary-latest">
          {q.options.map((o) => (
            <li key={o.label}>
              {o.label} <span className="fk-quiet">{o.average === null ? "" : `· average place ${o.average}`}</span>
            </li>
          ))}
        </ol>
      );
    default:
      return null;
  }
}
