"use client";

import { useRef, useState } from "react";
import { Check, GitBranch, Inbox, MessageCircle } from "lucide-react";
import { Chips, SceneFrame, useInView, useReducedMotion, useStep } from "@/components/site/scenes/shared";

/**
 * The story after the hero, told once and briefly: the form shapes itself
 * to each person, filling it in feels like a conversation, and every answer
 * lands in one place with where people stop. Three steps that play by
 * themselves and can be picked.
 */

const STEPS = [
  {
    key: "shape",
    icon: GitBranch,
    title: "Only what applies",
    body: "Rules in plain words. Returning clients skip what you already know.",
  },
  {
    key: "answer",
    icon: MessageCircle,
    title: "Feels like a conversation",
    body: "One question at a time, in your brand, on any screen.",
  },
  {
    key: "understand",
    icon: Inbox,
    title: "Every answer in one place",
    body: "Read each response, and see exactly where people stop.",
  },
] as const;
type Key = (typeof STEPS)[number]["key"];

const DWELL = 6500;

export function HowItWorks() {
  const ref = useRef<HTMLElement | null>(null);
  const seen = useInView(ref, 0.3);
  const still = useReducedMotion();
  const [step, setStep] = useState<Key>("shape");
  const [held, setHeld] = useState(false);
  const i = STEPS.findIndex((s) => s.key === step);

  useStep(seen && !still && !held, DWELL, () => setStep(STEPS[(i + 1) % STEPS.length]!.key), [step]);

  return (
    <section ref={ref} id="how" className="fk-how" aria-labelledby="how-title">
      <div className="fk-how-inner">
        <div className="fk-how-copy">
          <span className="fk-more-kicker">How it works</span>
          <h2 id="how-title" className="fk-lp-h2">
            One form, from the first question to the last answer.
          </h2>
          <ol className="fk-how-steps">
            {STEPS.map((s, n) => (
              <li key={s.key}>
                <button
                  type="button"
                  aria-pressed={s.key === step}
                  onClick={() => {
                    setHeld(true);
                    setStep(s.key);
                  }}
                >
                  <span className="fk-how-n">
                    <s.icon size={16} strokeWidth={2} aria-hidden />
                  </span>
                  <span>
                    <b>
                      {n + 1}. {s.title}
                    </b>
                    <span>{s.body}</span>
                  </span>
                  {s.key === step && !held && !still && seen && (
                    <i className="fk-how-timer" style={{ animationDuration: `${DWELL}ms` }} aria-hidden />
                  )}
                </button>
              </li>
            ))}
          </ol>
        </div>
        <div className="fk-how-stage">
          {step === "shape" && <ShapeMini />}
          {step === "answer" && <AnswerMini />}
          {step === "understand" && <UnderstandMini />}
        </div>
      </div>
    </section>
  );
}

const ALL = [
  "Who is the main contact?",
  "Which parts of the brand are fixed?",
  "Tell us about your audience",
  "Where are your brand files?",
  "What is the deadline?",
  "Who signs off?",
];
/** Returning clients skip these. */
const KNOWN = new Set([1, 2, 3]);

function ShapeMini() {
  const ref = useRef<HTMLDivElement | null>(null);
  const seen = useInView(ref);
  const still = useReducedMotion();
  const [returning, setReturning] = useState(true);
  const [held, setHeld] = useState(false);
  useStep(seen && !still && !held, 2400, () => setReturning(!returning), [returning]);
  const count = returning ? ALL.length - KNOWN.size : ALL.length;
  return (
    <SceneFrame
      innerRef={ref}
      title="Logic · Client onboarding"
      label="A rule skips three questions for returning clients."
      right={<span className="fk-how-count">{count} questions</span>}
    >
      <div className="fk-how-rule">
        <span>When</span> Have we worked together before? <span>is</span> Yes <span>then</span> skip three questions
      </div>
      <div className="fk-how-as">
        <span>Answer as</span>
        <Chips
          label="Answer as"
          value={returning ? "yes" : "no"}
          onChange={(v) => {
            setHeld(true);
            setReturning(v === "yes");
          }}
          options={[
            { value: "yes", label: "Existing client" },
            { value: "no", label: "New client" },
          ]}
        />
      </div>
      <ul className="fk-how-qs">
        {ALL.map((q, n) => (
          <li key={q} data-skip={(returning && KNOWN.has(n)) || undefined}>
            <i aria-hidden />
            {q}
          </li>
        ))}
      </ul>
    </SceneFrame>
  );
}

const CONVO = [
  { q: "Which brand are you submitting this brief for?", opts: ["Northstar", "Merrow", "Velto"], pick: 0 },
  { q: "Where does the budget sit?", opts: ["Under £10k", "£10k to £24k", "£24k to £40k"], pick: 2 },
  { q: "When do you need it by?", opts: ["This month", "Next quarter", "No rush"], pick: 1 },
];

function AnswerMini() {
  const ref = useRef<HTMLDivElement | null>(null);
  const seen = useInView(ref);
  const still = useReducedMotion();
  const [at, setAt] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const on = seen && !still;
  const c = CONVO[at]!;
  useStep(on && picked === null, 1500, () => setPicked(c.pick), [at, picked]);
  useStep(on && picked !== null, 900, () => {
    setAt((at + 1) % CONVO.length);
    setPicked(null);
  }, [picked]);
  return (
    <SceneFrame
      innerRef={ref}
      title="formkit.app/studio-nine/brief"
      label="A form asking one question at a time."
      right={
        <span className="fk-how-count">
          Question {at + 5} of 8
        </span>
      }
    >
      <div className="fk-how-convo" key={at}>
        <span className="fk-how-brand">
          <i aria-hidden>S9</i> Studio Nine
        </span>
        <span className="fk-how-bar" aria-hidden>
          <i style={{ width: `${((at + 5) / 8) * 100}%` }} />
        </span>
        <p>{c.q}</p>
        <div className="fk-how-opts">
          {c.opts.map((o, n) => (
            <button
              key={o}
              type="button"
              aria-pressed={picked === n}
              onClick={() => setPicked(n)}
            >
              {picked === n && <Check size={14} strokeWidth={2.6} aria-hidden />}
              {o}
            </button>
          ))}
        </div>
      </div>
    </SceneFrame>
  );
}

const ROWS = [
  ["MO", "Maya Okafor", "Northstar website redesign", "New"],
  ["DA", "Dele Adeyemi", "Merrow packaging", "Read"],
  ["JS", "Jonas Sand", "Fieldnote app", "Partial"],
] as const;
const STOPS = [
  ["Q7 · Budget range", 62],
  ["Q4 · File upload", 24],
  ["Q9 · Sign-off", 11],
] as const;

function UnderstandMini() {
  const ref = useRef<HTMLDivElement | null>(null);
  const seen = useInView(ref);
  const still = useReducedMotion();
  const grown = seen || still;
  return (
    <SceneFrame innerRef={ref} title="Responses · Client onboarding" label="Responses in one inbox, with the completion rate and where people stop.">
      <ul className="fk-how-inbox">
        {ROWS.map(([av, name, what, state]) => (
          <li key={name}>
            <span className="fk-rp-av" aria-hidden>
              {av}
            </span>
            <span>
              <b>{name}</b>
              <em>{what}</em>
            </span>
            <span className="fk-how-state" data-state={state}>
              {state}
            </span>
          </li>
        ))}
      </ul>
      <div className="fk-how-stats">
        <div>
          <span>Completion rate</span>
          <b>72.5%</b>
        </div>
        <div className="fk-how-stops">
          <span>Where people stop</span>
          {STOPS.map(([q, pct]) => (
            <span key={q} className="fk-how-stop">
              <em>{q}</em>
              <i>
                <i style={{ width: grown ? `${pct}%` : 0 }} />
              </i>
              <b>{pct}%</b>
            </span>
          ))}
        </div>
      </div>
    </SceneFrame>
  );
}
