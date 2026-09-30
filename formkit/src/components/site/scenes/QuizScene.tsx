"use client";

import { useRef, useState } from "react";
import { Check, RotateCcw, Timer, X } from "lucide-react";
import { SceneFrame, useInView, useReducedMotion, useStep, type SceneProps } from "./shared";

/** Answer three questions against the clock; each is marked as you go. */

const QS = [
  { q: "Which planet is closest to the sun?", opts: ["Venus", "Mercury", "Mars"], right: 1 },
  { q: "How many sides does a hexagon have?", opts: ["Five", "Six", "Eight"], right: 1 },
  { q: "What is the chemical symbol for gold?", opts: ["Ag", "Gd", "Au"], right: 2 },
];
const PASS = 60;
const LIMIT = 45;
/** What the index card answers by itself: two right, one wrong. */
const AUTO = [1, 0, 2];

export function QuizScene({ compact }: SceneProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const seen = useInView(ref);
  const still = useReducedMotion();
  const [at, setAt] = useState(0);
  const [picks, setPicks] = useState<number[]>([]);
  const [left, setLeft] = useState(LIMIT);
  const on = seen && !still;
  const finished = picks.length === QS.length;
  const marked = picks.length > at;

  // The clock only runs while a question is open.
  useStep(on && !finished && left > 0, 1000, () => setLeft(left - 1), [left]);
  // At zero the quiz is sent as it stands, like the real one.
  useStep(on && !finished && left === 0, 400, () => setPicks([...picks, ...QS.slice(picks.length).map(() => -1)]), [left]);
  // After a mark shows, move to the next question.
  useStep(on && marked && !finished, 950, () => setAt(at + 1), [at, marked]);
  // On the index, answer by itself and start over.
  useStep(on && !!compact && !marked && !finished, 1400, () => choose(AUTO[at]!), [at, marked]);
  useStep(on && !!compact && finished, 3400, () => reset(), [finished]);

  function choose(i: number) {
    if (marked || finished) return;
    setPicks([...picks, i]);
  }
  function reset() {
    setAt(0);
    setPicks([]);
    setLeft(LIMIT);
  }

  const shownPicks = still ? AUTO : picks;
  const score = shownPicks.filter((p, i) => p === QS[i]!.right).length;
  const pct = Math.round((score / QS.length) * 100);
  const done = still || finished;
  const q = QS[Math.min(at, QS.length - 1)]!;
  const pick = picks[at];
  const ring = 2 * Math.PI * 17;

  return (
    <SceneFrame
      innerRef={ref}
      compact={compact}
      title="Knowledge check"
      label="A three-question quiz with a timer, marked as each answer is given."
      right={
        <span className="fk-qz-timer" data-low={left < 15 || undefined}>
          <Timer size={13} strokeWidth={2} aria-hidden /> 0:{String(still ? LIMIT : left).padStart(2, "0")}
        </span>
      }
    >
      {!done ? (
        <div className="fk-qz" key={at}>
          <div className="fk-qz-progress" aria-hidden>
            {QS.map((_, i) => (
              <i
                key={i}
                data-state={
                  i < picks.length ? (picks[i] === QS[i]!.right ? "right" : "wrong") : i === at ? "now" : undefined
                }
              />
            ))}
          </div>
          <span className="fk-qz-count">
            Question {at + 1} of {QS.length} · 1 mark
          </span>
          <p className="fk-qz-q">{q.q}</p>
          <div className="fk-qz-opts">
            {q.opts.map((o, i) => {
              const state =
                pick === undefined ? undefined : i === q.right ? "right" : i === pick ? "wrong" : "dim";
              return (
                <button
                  key={o}
                  type="button"
                  disabled={pick !== undefined || compact}
                  tabIndex={compact ? -1 : undefined}
                  data-state={state}
                  onClick={() => choose(i)}
                >
                  <span className="fk-qz-letter">{"ABC"[i]}</span>
                  {o}
                  {state === "right" && <Check size={16} strokeWidth={2.4} aria-hidden />}
                  {state === "wrong" && <X size={16} strokeWidth={2.4} aria-hidden />}
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="fk-qz-result">
          <svg viewBox="0 0 40 40" className="fk-qz-ring" aria-hidden>
            <circle cx="20" cy="20" r="17" />
            <circle
              cx="20"
              cy="20"
              r="17"
              data-pass={pct >= PASS || undefined}
              strokeDasharray={`${(ring * pct) / 100} ${ring}`}
            />
          </svg>
          <div>
            <span className="fk-qz-score">
              {score} / {QS.length}
            </span>
            <span className="fk-qz-verdict" data-pass={pct >= PASS || undefined}>
              {pct}% · {pct >= PASS ? "Passed" : "Not passed"} (pass mark {PASS}%)
            </span>
            <ul className="fk-qz-list">
              {QS.map((x, i) => (
                <li key={x.q} data-right={shownPicks[i] === x.right || undefined}>
                  {shownPicks[i] === x.right ? <Check size={13} strokeWidth={2.4} /> : <X size={13} strokeWidth={2.4} />}
                  {x.q}
                </li>
              ))}
            </ul>
            {!compact && (
              <button type="button" className="fk-sc-link" onClick={reset}>
                <RotateCcw size={13} strokeWidth={2} aria-hidden /> Try again
              </button>
            )}
          </div>
        </div>
      )}
    </SceneFrame>
  );
}
