"use client";

import { useRef, useState } from "react";
import { Sparkles } from "lucide-react";
import { SceneFrame, useInView, useReducedMotion, useStep } from "@/components/site/scenes/shared";

/**
 * "Forms that think", as one window: a written answer comes in, the AI reads
 * it and marks what matters, decides whether this is a good fit, and sends
 * the person down their branch to the ending that suits them. What it picked
 * out is kept for later questions. Then the next person.
 */

type Part = [string, boolean];

const ENDINGS = [
  { id: "call", label: "Book a call", start: 11 },
  { id: "later", label: "Stay in touch", start: 7 },
  { id: "rates", label: "Starter rates", start: 5 },
];
const X = [96, 280, 464];
const BRANCH = [
  "M280 78 C280 128 96 112 96 162",
  "M280 78 L280 162",
  "M280 78 C280 128 464 112 464 162",
];

const PEOPLE: {
  id: string;
  name: string;
  parts: Part[];
  verdict: string;
  end: number;
  facts: [string, string][];
}[] = [
  {
    id: "PS",
    name: "Priya Shah",
    parts: [
      ["We're rebranding all ", false],
      ["twelve shops", true],
      [" ", false],
      ["next spring", true],
      [". Budget is about ", false],
      ["$20k", true],
      [".", false],
    ],
    verdict: "Good fit",
    end: 0,
    facts: [
      ["Budget", "$20,000"],
      ["When", "Next spring"],
    ],
  },
  {
    id: "AO",
    name: "Aisha Okafor",
    parts: [
      ["Still ", false],
      ["exploring", true],
      [". Maybe a new site ", false],
      ["later this year", true],
      [", around ", false],
      ["$8k", true],
      [".", false],
    ],
    verdict: "Not yet",
    end: 1,
    facts: [
      ["Budget", "$8,000"],
      ["When", "Later this year"],
    ],
  },
  {
    id: "LB",
    name: "Leo Brandt",
    parts: [
      ["Just need a ", false],
      ["quick logo", true],
      [", ", false],
      ["as cheap as possible", true],
      [", by ", false],
      ["Friday", true],
      [".", false],
    ],
    verdict: "Not a fit",
    end: 2,
    facts: [
      ["Budget", "Not given"],
      ["When", "This week"],
    ],
  },
];

/** 0 typing, 1 reading, 2 deciding, 3 on the way, 4 arrived. */
const PHASE_MS = [0, 0, 1000, 1100, 2300];

export function ThinkScene() {
  const ref = useRef<HTMLDivElement | null>(null);
  const seen = useInView(ref, 0.3);
  const still = useReducedMotion();
  const [at, setAt] = useState(0);
  const [phase, setPhase] = useState(0);
  const [typed, setTyped] = useState(0);
  const [read, setRead] = useState(0);
  const [held, setHeld] = useState(false);
  const [counts, setCounts] = useState(ENDINGS.map((e) => e.start));

  const p = PEOPLE[at]!;
  const text = p.parts.map(([t]) => t).join("");
  const keys = p.parts.filter(([, k]) => k).length;
  const shown = still ? 4 : phase;
  const chars = still || phase > 0 ? text.length : typed;
  const marks = still || phase > 1 ? keys : read;
  const on = seen && !still;

  const next = (i: number) => {
    setAt(i);
    setPhase(0);
    setTyped(0);
    setRead(0);
  };

  useStep(on && phase === 0, 18, () => {
    if (typed >= text.length) setPhase(1);
    else setTyped(Math.min(text.length, typed + 2));
  }, [typed, at]);
  useStep(on && phase === 1, 420, () => {
    if (read >= keys) setPhase(2);
    else setRead(read + 1);
  }, [read, at]);
  useStep(on && phase >= 2 && phase < 4, PHASE_MS[phase]!, () => {
    if (phase === 3) setCounts(counts.map((n, i) => (i === p.end ? n + 1 : n)));
    setPhase(phase + 1);
  }, [phase, at]);
  useStep(on && phase === 4 && !held, PHASE_MS[4]!, () => next((at + 1) % PEOPLE.length), [phase, at, held]);

  // The answer, cut to what has been typed, with the AI's marks on it.
  const body = p.parts.map(([t, key], i) => {
    const before = p.parts.slice(0, i);
    const part = t.slice(0, Math.max(0, chars - before.reduce((n, [x]) => n + x.length, 0)));
    if (!key) return <span key={i}>{part}</span>;
    const nth = before.filter(([, x]) => x).length + 1;
    return (
      <mark key={i} data-on={nth <= marks || undefined}>
        {part}
      </mark>
    );
  });

  return (
    <div ref={ref} className="fk-tk">
      <SceneFrame
        title="Project enquiry · AI logic"
        label="The AI reads a written answer, decides if it is a good fit and sends the person to the right ending"
        right={
          <span className="fk-tk-people" role="group" aria-label="Pick an answer">
            {PEOPLE.map((x, i) => (
              <button
                key={x.id}
                type="button"
                aria-pressed={i === at}
                aria-label={x.name}
                onClick={() => {
                  setHeld(true);
                  next(i);
                }}
              >
                {x.id}
              </button>
            ))}
          </span>
        }
      >
        <div className="fk-tk-body">
          <div className="fk-tk-answer" data-reading={shown === 1 || undefined} key={p.id}>
            <span className="fk-tk-who">
              <span className="fk-tk-av">{p.id}</span>
              <b>{p.name}</b>
              <small>Tell us about the project</small>
            </span>
            <p>
              {body}
              {shown === 0 && <i className="fk-rs-caret" />}
            </p>
            <span className="fk-tk-scan" aria-hidden />
          </div>

          <div className="fk-tk-flow">
            <svg viewBox="0 0 560 216" aria-hidden>
              <defs>
                <radialGradient id="fk-tk-orb" cx="50%" cy="40%" r="60%">
                  <stop offset="0%" stopColor="#cfe3f5" />
                  <stop offset="55%" stopColor="#5f9bd4" />
                  <stop offset="100%" stopColor="#2f6aa6" />
                </radialGradient>
              </defs>
              <path d="M280 0 L280 26" className="fk-tk-in" data-on={shown >= 1 || undefined} />
              {BRANCH.map((d, i) => (
                <path
                  key={d}
                  d={d}
                  className="fk-tk-branch"
                  data-on={(shown >= 3 && i === p.end) || undefined}
                  data-dim={(shown >= 3 && i !== p.end) || undefined}
                />
              ))}
              {shown === 3 && !still && (
                <g key={`walk-${at}`} className="fk-tk-walker">
                  <circle r="11" />
                  <text dy="3.5">{p.id}</text>
                  <animateMotion dur="1s" fill="freeze" path={BRANCH[p.end]} calcMode="spline" keyTimes="0;1" keySplines="0.45 0 0.2 1" />
                </g>
              )}
              <g className="fk-tk-orb" data-state={shown === 2 ? "think" : shown >= 3 ? "done" : shown === 1 ? "read" : "idle"}>
                <circle cx="280" cy="52" r="34" className="fk-tk-ring" />
                <circle cx="280" cy="52" r="26" fill="url(#fk-tk-orb)" />
                <path
                  d="M280 40 L283 49 L292 52 L283 55 L280 64 L277 55 L268 52 L277 49 Z"
                  fill="#ffffff"
                />
              </g>
              <text x="322" y="40" className="fk-tk-ask">
                AI decides
              </text>
              <text x="322" y="58" className="fk-tk-q">
                Is this a good fit?
              </text>
              {shown >= 2 && (
                <g key={`v-${at}`} className="fk-tk-verdict" data-end={p.end}>
                  <rect x="322" y="66" width={p.verdict.length * 9 + 24} height="22" rx="11" />
                  <text x={332} y="81">
                    {p.verdict}
                  </text>
                </g>
              )}
              {ENDINGS.map((e, i) => (
                <g
                  key={e.id}
                  className="fk-tk-end"
                  data-on={(shown === 4 && i === p.end) || undefined}
                >
                  <rect x={X[i]! - 82} y="162" width="164" height="50" rx="14" />
                  <text x={X[i]} y="183" className="fk-tk-end-name">
                    {e.label}
                  </text>
                  <text x={X[i]} y="200" className="fk-tk-end-n" key={counts[i]}>
                    {counts[i]} people
                  </text>
                </g>
              ))}
            </svg>
          </div>

          <div className="fk-tk-facts" data-on={shown === 4 || undefined}>
            <span className="fk-tk-facts-label">
              <Sparkles size={13} strokeWidth={2} aria-hidden /> Kept for later
            </span>
            {p.facts.map(([label, value], i) => (
              <span key={`${p.id}-${label}`} className="fk-tk-fact" style={{ ["--i" as string]: i }}>
                {label} <b>{value}</b>
              </span>
            ))}
          </div>
        </div>
      </SceneFrame>
    </div>
  );
}
