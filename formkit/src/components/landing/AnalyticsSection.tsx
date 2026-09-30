"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  ChartPie,
  CircleCheck,
  Eye,
  FileSpreadsheet,
  FileText,
  MousePointerClick,
  Timer,
} from "lucide-react";
import { useInView, useReducedMotion } from "@/components/site/scenes/shared";

/**
 * The analytics screen, rebuilt from the app's own: views, starts,
 * completions, the rate and the time it takes, responses over time and the
 * completion funnel. Pick a range and everything moves to it.
 */

type Range = "7" | "30" | "90";

const DATA: Record<
  Range,
  { views: number; started: number; completed: number; secs: number; deltas: string[]; bars: number[]; labels: string[] }
> = {
  "7": {
    views: 4102,
    started: 2789,
    completed: 1968,
    secs: 248,
    deltas: ["+5%", "+6%", "+9%", "+2pts", "−12s"],
    bars: [262, 288, 276, 327, 309, 232, 274],
    labels: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
  },
  "30": {
    views: 12483,
    started: 8291,
    completed: 5821,
    secs: 252,
    deltas: ["+8%", "+11%", "+14%", "+4pts", "−31s"],
    bars: [301, 322, 356, 341, 378, 365, 402, 388, 421, 409, 436, 425, 451, 440, 387],
    labels: ["1", "3", "5", "7", "9", "11", "13", "15", "17", "19", "21", "23", "25", "27", "29"],
  },
  "90": {
    views: 35960,
    started: 23410,
    completed: 16188,
    secs: 266,
    deltas: ["+21%", "+24%", "+27%", "+3pts", "−48s"],
    bars: [1024, 1098, 1166, 1131, 1254, 1302, 1379, 1351, 1428, 1487, 1523, 1045],
    labels: ["W1", "W2", "W3", "W4", "W5", "W6", "W7", "W8", "W9", "W10", "W11", "W12"],
  },
};

const RANGES: { id: Range; label: string }[] = [
  { id: "7", label: "7 days" },
  { id: "30", label: "30 days" },
  { id: "90", label: "90 days" },
];

/** A number that slides to its new value instead of jumping. */
function useTween(target: number, on: boolean, ms = 900) {
  const [shown, setShown] = useState(0);
  const from = useRef(0);
  useEffect(() => {
    if (!on) return;
    const start = performance.now();
    const a = from.current;
    let raf = 0;
    const tick = (t: number) => {
      const k = Math.min(1, (t - start) / ms);
      const v = a + (target - a) * (1 - Math.pow(1 - k, 3));
      from.current = v;
      setShown(v);
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, on, ms]);
  return shown;
}

function Count({ value, on, format }: { value: number; on: boolean; format: (n: number) => string }) {
  return <>{format(useTween(value, on))}</>;
}

const whole = (n: number) => Math.round(n).toLocaleString("en-US");
const TICKS = 44;

export function AnalyticsSection() {
  const ref = useRef<HTMLDivElement | null>(null);
  const seen = useInView(ref, 0.2);
  const still = useReducedMotion();
  const [range, setRange] = useState<Range>("30");
  const [shownOnce, setShownOnce] = useState(false);
  const on = still || seen || shownOnce;
  const d = DATA[range];

  useEffect(() => {
    if (!seen || shownOnce) return;
    const raf = requestAnimationFrame(() => setShownOnce(true));
    return () => cancelAnimationFrame(raf);
  }, [seen, shownOnce]);

  const rate = (d.completed / d.started) * 100;
  const stats = [
    { label: "Views", icon: Eye, value: d.views, format: whole },
    { label: "Started", icon: MousePointerClick, value: d.started, format: whole },
    { label: "Completed", icon: CircleCheck, value: d.completed, format: whole, tone: "blue" },
    { label: "Completion rate", icon: ChartPie, value: rate, format: (n: number) => `${n.toFixed(1)}%`, tone: "dark" },
    {
      label: "Average time",
      icon: Timer,
      value: d.secs,
      format: (n: number) => `${Math.floor(n / 60)}m ${String(Math.round(n % 60)).padStart(2, "0")}s`,
      down: true,
    },
  ];
  const funnel = [
    { label: "Views", n: d.views, fill: "var(--green-400)" },
    { label: "Started", n: d.started, fill: "var(--yellow-400)" },
    { label: "Completed", n: d.completed, fill: "var(--blue-500)" },
  ];
  const peak = Math.max(...d.bars);
  const neverStart = Math.round((1 - d.started / d.views) * 100);

  return (
    <section id="analytics" className="fk-an" aria-labelledby="an-title">
      <div className="fk-an-head">
        <span className="fk-more-kicker">Analytics</span>
        <h2 id="an-title" className="fk-lp-h2">
          See where people give up, not just who finished.
        </h2>
        <p className="fk-lp-lede">
          How many looked, how many started, how many finished, how long it took, and the
          question they quit on. On every plan.
        </p>
      </div>

      <div ref={ref} className="fk-an-board" data-in={on || undefined}>
        <div className="fk-an-bar">
          <div className="fk-an-ranges" role="radiogroup" aria-label="Date range">
            {RANGES.map((r) => (
              <button key={r.id} type="button" role="radio" aria-checked={r.id === range} onClick={() => setRange(r.id)}>
                {r.label}
              </button>
            ))}
          </div>
          <span className="fk-an-note">Last {range} days, to today.</span>
          <span className="fk-an-spacer" />
          <span className="fk-an-export">
            <FileSpreadsheet size={15} strokeWidth={1.8} aria-hidden /> Export Excel <em>Pro</em>
          </span>
          <span className="fk-an-export">
            <FileText size={15} strokeWidth={1.8} aria-hidden /> Export CSV
          </span>
        </div>

        <div className="fk-an-stats">
          {stats.map((s, i) => (
            <div key={s.label} className="fk-an-stat" data-tone={s.tone}>
              <span className="fk-an-stat-label">
                <s.icon size={15} strokeWidth={1.8} aria-hidden /> {s.label}
              </span>
              <span className="fk-an-stat-row">
                <b>
                  <Count value={s.value} on={on} format={s.format} />
                </b>
                <i data-down={s.down || undefined} aria-hidden>
                  {s.down ? <ArrowDownRight size={13} strokeWidth={2} /> : <ArrowUpRight size={13} strokeWidth={2} />}
                </i>
                <small>{d.deltas[i]}</small>
              </span>
            </div>
          ))}
        </div>

        <div className="fk-an-charts">
          <div className="fk-an-card">
            <b className="fk-an-card-title">Responses over time</b>
            <div className="fk-an-cols" key={range}>
              {d.bars.map((v, i) => (
                <span key={i} className="fk-an-col">
                  <small>{v}</small>
                  <i
                    data-last={i === d.bars.length - 1 || undefined}
                    style={{ height: on ? `${Math.round((v / peak) * 100)}%` : 0, transitionDelay: `${i * 30}ms` }}
                  />
                  <em>{d.labels[i]}</em>
                </span>
              ))}
            </div>
          </div>

          <div className="fk-an-card">
            <b className="fk-an-card-title">Completion funnel</b>
            <div className="fk-an-funnel">
              {funnel.map((f) => {
                const pct = Math.round((f.n / d.views) * 100);
                const filled = Math.round((f.n / d.views) * TICKS);
                return (
                  <div key={f.label}>
                    <span className="fk-an-fhead">
                      <b>{pct}%</b> {f.label}
                    </span>
                    <span className="fk-an-ticks" aria-hidden>
                      {Array.from({ length: TICKS }, (_, i) => (
                        <i
                          key={i}
                          style={{
                            background: on && i < filled ? f.fill : undefined,
                            transitionDelay: `${i * 12}ms`,
                          }}
                        />
                      ))}
                    </span>
                    <span className="fk-an-ffoot">
                      <span>{whole(f.n)}</span>
                      <span>{pct}%</span>
                    </span>
                  </div>
                );
              })}
            </div>
            <p className="fk-an-insight">
              {neverStart}% of people who open this form never start it. The funnel shows it
              before anyone has to guess.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
