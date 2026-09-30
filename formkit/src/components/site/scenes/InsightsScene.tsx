"use client";

import { useRef, useState } from "react";
import { FileText, Sparkles } from "lucide-react";
import { Chips, SceneFrame, useInView, useReducedMotion, useStep, type SceneProps } from "./shared";

/** What a month of responses says, read by the AI: sentiment, topics, who to call. */

const DATA = {
  "7": {
    total: 38,
    sentiment: [61, 29, 10],
    urgent: 4,
    topics: [
      ["Pricing", 14, 71],
      ["Timeline", 11, 64],
      ["New website", 9, 83],
      ["Support", 4, 40],
    ],
  },
  "30": {
    total: 142,
    sentiment: [68, 24, 8],
    urgent: 11,
    topics: [
      ["New website", 48, 81],
      ["Pricing", 39, 69],
      ["Timeline", 31, 62],
      ["Branding", 17, 77],
    ],
  },
} as const;

const PEOPLE = [
  { name: "Priya Shah", what: "Website with online orders", score: 82 },
  { name: "Tom Becker", what: "Rebrand across 12 shops", score: 91 },
  { name: "Ana Ruiz", what: "Unhappy with a late delivery", score: 34, reply: true },
];

const REPORT =
  "Most people want a new website, and they are the most promising: an average lead score of 81. Pricing questions doubled this month; a clear starting price on the site would answer most of them. Three people are unhappy about timing and are worth a personal reply.";

export function InsightsScene({ compact }: SceneProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const seen = useInView(ref);
  const still = useReducedMotion();
  const [range, setRange] = useState<"7" | "30">("30");
  const [report, setReport] = useState<"off" | "writing" | "done">("off");
  const [chars, setChars] = useState(0);
  const on = seen && !still;
  const d = DATA[range];
  const max = Math.max(...d.topics.map((t) => t[1]));
  const grown = seen || still;

  useStep(on && !!compact, 3600, () => setRange(range === "30" ? "7" : "30"), [range]);
  useStep(on && report === "writing", 16, () => {
    if (chars < REPORT.length) setChars(Math.min(REPORT.length, chars + 4));
    else setReport("done");
  }, [chars, report]);

  return (
    <SceneFrame
      innerRef={ref}
      compact={compact}
      title="Enquiries · AI insights"
      label="AI insights: the share of positive responses, the topics people raise with their average lead score, and the people worth a reply."
      right={
        !compact && (
          <Chips
            label="Period"
            value={range}
            onChange={setRange}
            options={[
              { value: "7", label: "7 days" },
              { value: "30", label: "30 days" },
            ]}
          />
        )
      }
    >
      <div className="fk-in" data-grown={grown || undefined}>
        <div className="fk-in-tiles">
          <div>
            <span>Responses</span>
            <b>{d.total}</b>
          </div>
          <div>
            <span>Positive</span>
            <b>{d.sentiment[0]}%</b>
          </div>
          <div>
            <span>Urgent</span>
            <b>{d.urgent}</b>
          </div>
        </div>

        <div className="fk-in-sent" aria-hidden>
          <i style={{ flexBasis: grown ? `${d.sentiment[0]}%` : 0 }} data-tone="pos" />
          <i style={{ flexBasis: grown ? `${d.sentiment[1]}%` : 0 }} data-tone="neu" />
          <i style={{ flexBasis: grown ? `${d.sentiment[2]}%` : 0 }} data-tone="neg" />
        </div>
        <div className="fk-in-legend" aria-hidden>
          <span data-tone="pos">Positive</span>
          <span data-tone="neu">Neutral</span>
          <span data-tone="neg">Negative</span>
        </div>

        <div className="fk-in-cols">
          <div>
            <span className="fk-in-h">Topics · average lead score</span>
            <ul className="fk-in-topics">
              {d.topics.map(([name, n, score]) => (
                <li key={name}>
                  <span className="fk-in-tname">{name}</span>
                  <span className="fk-in-bar">
                    <i style={{ width: grown ? `${(n / max) * 100}%` : 0 }} />
                  </span>
                  <span className="fk-in-n">{n}</span>
                  <span className="fk-in-score" data-hi={score >= 75 || undefined}>
                    {score}
                  </span>
                </li>
              ))}
            </ul>
          </div>
          {!compact && (
            <div>
              <span className="fk-in-h">Most promising, and worth a reply</span>
              <ul className="fk-in-people">
                {PEOPLE.map((p) => (
                  <li key={p.name}>
                    <b>{p.name}</b>
                    <span>{p.what}</span>
                    <em data-reply={p.reply || undefined}>{p.reply ? "Reply in person" : p.score}</em>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {!compact && (
          <div className="fk-in-report">
            {report === "off" ? (
              <button
                type="button"
                className="fk-sc-btn"
                onClick={() => {
                  setChars(still ? REPORT.length : 0);
                  setReport(still ? "done" : "writing");
                }}
              >
                <FileText size={14} strokeWidth={2} aria-hidden /> Write a report
              </button>
            ) : (
              <p>
                <Sparkles size={14} strokeWidth={2} aria-hidden />
                {REPORT.slice(0, chars)}
                {report === "writing" && <i className="fk-ai-caret" aria-hidden />}
              </p>
            )}
          </div>
        )}
      </div>
    </SceneFrame>
  );
}
