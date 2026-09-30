"use client";

import { useRef, useState } from "react";
import { Sparkles } from "lucide-react";
import { Chips, SceneFrame, useInView, useReducedMotion, useStep, type SceneProps } from "./shared";

/**
 * Pick an answer and watch the path through the form light up; or let the
 * AI read a written answer and choose the ending.
 */

type Choice = "website" | "branding" | "both";

const CHOICES: { value: Choice; label: string; then: string }[] = [
  { value: "website", label: "A website", then: "hide Brand details" },
  { value: "branding", label: "Branding", then: "skip to Brand details" },
  { value: "both", label: "Both", then: "show every page" },
];

type NodeKey = "q1" | "pages" | "brand" | "budget" | "end";
const NODES: Record<NodeKey, { x: number; y: number; label: string }> = {
  q1: { x: 180, y: 30, label: "What do you need?" },
  pages: { x: 88, y: 118, label: "Pages you need" },
  brand: { x: 272, y: 118, label: "Brand details" },
  budget: { x: 180, y: 206, label: "Budget" },
  end: { x: 180, y: 282, label: "Thank you" },
};

const EDGES: Record<string, string> = {
  "q1-pages": "M180 47 C180 80 88 74 88 101",
  "q1-brand": "M180 47 C180 80 272 74 272 101",
  "pages-brand": "M148 118 L212 118",
  "pages-budget": "M88 135 C88 170 180 160 180 189",
  "brand-budget": "M272 135 C272 170 180 160 180 189",
  "budget-end": "M180 223 L180 265",
};

const PATHS: Record<Choice, string[]> = {
  website: ["q1-pages", "pages-budget", "budget-end"],
  branding: ["q1-brand", "brand-budget", "budget-end"],
  both: ["q1-pages", "pages-brand", "brand-budget", "budget-end"],
};

/** One continuous route for the travelling dot. */
function route(edges: string[]) {
  return edges.map((k, i) => (i === 0 ? EDGES[k]! : EDGES[k]!.replace(/^M/, "L"))).join(" ");
}

const ANSWERS = [
  {
    key: "fit",
    label: "A big rebrand",
    text: "We're rebranding all twelve shops next spring. Budget is about $20k.",
    verdict: "Yes",
    fact: "$20,000",
    ending: "Book a call",
  },
  {
    key: "nofit",
    label: "A quick logo",
    text: "Just need a quick logo, as cheap as possible, by Friday.",
    verdict: "No",
    fact: "Not given",
    ending: "See our rates",
  },
] as const;

export function LogicScene({ compact, start = "rules" }: SceneProps & { start?: "rules" | "ai" }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const seen = useInView(ref);
  const still = useReducedMotion();
  const [mode, setMode] = useState<"rules" | "ai">(start);
  const [choice, setChoice] = useState<Choice>("branding");
  const [touched, setTouched] = useState(false);
  const [answer, setAnswer] = useState<(typeof ANSWERS)[number]["key"]>("fit");
  const [reading, setReading] = useState(false);
  const on = seen && !still;

  // Until someone clicks, the answer changes by itself so the path moves.
  useStep(on && !touched && mode === "rules", 2600, () => {
    const i = CHOICES.findIndex((c) => c.value === choice);
    setChoice(CHOICES[(i + 1) % CHOICES.length]!.value);
  }, [choice]);
  useStep(on && reading, 1200, () => setReading(false), [answer]);

  const active = new Set(PATHS[choice]);
  const lit = new Set<NodeKey>(["q1", "budget", "end"]);
  if (choice !== "branding") lit.add("pages");
  if (choice !== "website") lit.add("brand");
  const c = CHOICES.find((x) => x.value === choice)!;
  const a = ANSWERS.find((x) => x.key === answer)!;
  const pickAnswer = (k: typeof answer) => {
    setAnswer(k);
    setReading(true);
  };

  return (
    <SceneFrame
      innerRef={ref}
      compact={compact}
      title={mode === "rules" ? "Logic map" : "AI logic"}
      label="A logic map: the answer to “What do you need?” decides which pages each person sees."
      right={
        !compact && (
          <Chips
            label="Kind of logic"
            value={mode}
            onChange={setMode}
            options={[
              { value: "rules", label: "Rules" },
              { value: "ai", label: "AI decides" },
            ]}
          />
        )
      }
    >
      {mode === "rules" ? (
        <div className="fk-lg">
          {!compact && (
            <div className="fk-lg-form">
              <span className="fk-lg-q">What do you need?</span>
              <div className="fk-lg-opts" role="radiogroup" aria-label="What do you need?">
                {CHOICES.map((o) => (
                  <button
                    key={o.value}
                    type="button"
                    role="radio"
                    aria-checked={o.value === choice}
                    onClick={() => {
                      setTouched(true);
                      setChoice(o.value);
                    }}
                  >
                    <i aria-hidden />
                    {o.label}
                  </button>
                ))}
              </div>
              <div className="fk-lg-rule" key={choice}>
                <b>If</b> What do you need <b>is</b> {c.label}, <b>then</b> {c.then}
              </div>
            </div>
          )}
          <svg className="fk-lg-map" viewBox="0 0 360 300" aria-hidden>
            {Object.entries(EDGES).map(([k, d]) => (
              <path key={k} d={d} className="fk-lg-edge" data-on={active.has(k) || undefined} />
            ))}
            {on && (
              <circle key={choice} r="5" className="fk-lg-dot">
                <animateMotion dur="2.2s" repeatCount="indefinite" path={route(PATHS[choice])} />
              </circle>
            )}
            {(Object.keys(NODES) as NodeKey[]).map((k) => {
              const n = NODES[k];
              const w = k === "q1" ? 150 : 120;
              return (
                <g key={k} className="fk-lg-node" data-on={lit.has(k) || undefined}>
                  <rect x={n.x - w / 2} y={n.y - 17} width={w} height={34} rx={12} />
                  <text x={n.x} y={n.y + 4.5} textAnchor="middle">
                    {n.label}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      ) : (
        <div className="fk-lg-ai">
          <Chips
            label="Their answer"
            value={answer}
            onChange={pickAnswer}
            options={ANSWERS.map((x) => ({ value: x.key, label: x.label }))}
          />
          <div className="fk-lg-said">
            <span>Tell us about the project</span>
            <p>{a.text}</p>
          </div>
          <div className="fk-lg-ask" data-reading={reading || undefined}>
            <Sparkles size={15} strokeWidth={2} aria-hidden />
            <span>
              Is this a good fit for us? <em>Over $5,000 and at least a month away</em>
            </span>
            <b data-yes={a.verdict === "Yes" || undefined}>{reading ? "Reading…" : a.verdict}</b>
          </div>
          <div className="fk-lg-out" data-hide={reading || undefined}>
            <div>
              <span>Fact pulled into a hidden field</span>
              <b>Budget: {a.fact}</b>
            </div>
            <div>
              <span>Goes to ending</span>
              <b>{a.ending}</b>
            </div>
          </div>
        </div>
      )}
    </SceneFrame>
  );
}
