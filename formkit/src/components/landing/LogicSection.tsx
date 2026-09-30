"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import {
  ArrowRight,
  Calculator,
  Check,
  Eye,
  FlaskConical,
  GitBranch,
  Plus,
  Sparkles,
  Split,
  Waypoints,
} from "lucide-react";
import { SceneFrame, useInView, useReducedMotion, useStep } from "@/components/site/scenes/shared";

/**
 * Logic, on its own stage: say what should happen in plain words, watch the
 * AI write the rule against the form's questions, add it, and see the new
 * path appear on the logic map. It plays through once by itself; clicking a
 * prompt takes over.
 */

type Token = { t: string; k?: "q" | "v" | "op" | "act" };
type Rule = { id: string; prompt: string; when: Token[]; then: Token[]; pro?: boolean; edge: string };

const RULES: Rule[] = [
  {
    id: "call",
    prompt: "If the budget is over £20k and they found us on Instagram, skip to the call page",
    when: [
      { t: "Budget", k: "q" },
      { t: "is more than", k: "op" },
      { t: "£20,000", k: "v" },
      { t: "and" },
      { t: "How did you find us?", k: "q" },
      { t: "is", k: "op" },
      { t: "Instagram", k: "v" },
    ],
    then: [
      { t: "Skip to", k: "act" },
      { t: "Book a call", k: "q" },
    ],
    edge: "M 60 222 C 14 240, 14 300, 50 330",
  },
  {
    id: "print",
    prompt: "Only ask about print if they need branding",
    when: [
      { t: "What do you need?", k: "q" },
      { t: "does not include", k: "op" },
      { t: "Branding", k: "v" },
    ],
    then: [
      { t: "Hide", k: "act" },
      { t: "Do you need print too?", k: "q" },
    ],
    edge: "M 262 72 C 300 90, 300 150, 262 172",
  },
  {
    id: "small",
    prompt: "Send projects under £5k to the self-serve guide",
    when: [
      { t: "Budget", k: "q" },
      { t: "is less than", k: "op" },
      { t: "£5,000", k: "v" },
    ],
    then: [
      { t: "End with", k: "act" },
      { t: "Self-serve guide", k: "q" },
    ],
    pro: true,
    edge: "M 262 172 C 310 200, 300 300, 270 330",
  },
];

const NODES = [
  { label: "Your name and email", y: 12 },
  { label: "What do you need?", y: 60 },
  { label: "Do you need print too?", y: 108 },
  { label: "Budget", y: 156 },
  { label: "How did you find us?", y: 204 },
  { label: "Project details", y: 252 },
];
const ENDS = [
  { id: "call", label: "Book a call", x: 10 },
  { id: "thanks", label: "Thank you", x: 115 },
  { id: "small", label: "Self-serve guide", x: 220 },
];

const CAN = [
  { icon: GitBranch, title: "Skip, show and hide", body: "Send people past what doesn't apply to them.", plan: "Every plan" },
  { icon: Split, title: "Groups and comparisons", body: "And, or, more than, contains, the first rule that matches wins.", plan: "Every plan" },
  { icon: Waypoints, title: "The logic map and tester", body: "Every path at once, and a made-up person to walk it.", plan: "Every plan" },
  { icon: Sparkles, title: "Describe a rule", body: "Say it in words; the AI writes it against your questions.", plan: "Every plan" },
  { icon: Eye, title: "AI decides", body: "“Does this sound urgent?” The AI reads the answer and picks the path.", plan: "Pro" },
  { icon: Calculator, title: "Calculations and endings", body: "Add answers into a price or a score, then end in the right place.", plan: "Pro" },
];

type Phase = "idle" | "typing" | "writing" | "ready";

export function LogicSection() {
  const frame = useRef<HTMLDivElement | null>(null);
  const seen = useInView(frame, 0.35);
  const still = useReducedMotion();
  const [pick, setPick] = useState(0);
  const [phase, setPhase] = useState<Phase>("idle");
  const [typed, setTyped] = useState(0);
  const [added, setAdded] = useState<string[]>([]);
  const [held, setHeld] = useState(false);
  const rule = RULES[pick]!;

  const start = (i: number) => {
    setPick(i);
    setTyped(0);
    setPhase(still ? "ready" : "typing");
  };

  // The first prompt starts by itself once the section is on screen.
  useStep(seen && phase === "idle" && !held && added.length === 0, 900, () => start(0), [phase]);
  useStep(phase === "typing", 22, () => {
    if (typed >= rule.prompt.length) setPhase("writing");
    else setTyped(Math.min(rule.prompt.length, typed + 2));
  }, [typed, pick]);
  useStep(phase === "writing", 1100, () => setPhase("ready"), [pick]);
  // Played through on its own: add the rule, then the next prompt.
  useStep(phase === "ready" && !held && !added.includes(rule.id), 1600, () => {
    setAdded([...added, rule.id]);
  }, [pick, added]);
  useStep(phase === "ready" && !held && added.includes(rule.id) && pick < RULES.length - 1, 1800, () => start(pick + 1), [pick, added]);

  const shown = still ? rule.prompt : rule.prompt.slice(0, typed);
  const isAdded = added.includes(rule.id);

  return (
    <section id="logic" className="fk-rs" aria-labelledby="lg-title">
      <div className="fk-rs-head">
        <span className="fk-more-kicker">Advanced logic</span>
        <h2 id="lg-title" className="fk-lp-h2">
          Say what should happen.
          <br />
          The rule writes itself.
        </h2>
        <p className="fk-lp-lede">
          Describe a rule in your own words and the AI writes it against your questions.
          Groups, comparisons, several endings and a map of every path, with a tester to
          walk it before anyone else does.
        </p>
      </div>

      <div ref={frame} className="fk-rs-demo">
        <SceneFrame title="Client intake · Logic" label="Writing a logic rule from a sentence, and the logic map" right={<span className="fk-rs-count">{added.length + 2} rules</span>}>
          <div className="fk-rs-body">
            <div className="fk-rs-left">
              <span className="fk-rs-label">
                <Sparkles size={13} strokeWidth={2} aria-hidden /> Describe a rule
              </span>
              <div className="fk-rs-input" data-live={phase === "typing" || undefined}>
                {phase === "idle" ? <span className="fk-rs-ph">Say what should happen…</span> : shown}
                {phase === "typing" && <i className="fk-rs-caret" />}
              </div>
              <div className="fk-rs-prompts" role="group" aria-label="Try a prompt">
                {RULES.map((r, i) => (
                  <button
                    key={r.id}
                    type="button"
                    aria-pressed={i === pick && phase !== "idle"}
                    onClick={() => {
                      setHeld(true);
                      start(i);
                    }}
                  >
                    {r.prompt}
                  </button>
                ))}
              </div>

              <div className="fk-rs-out" aria-live="polite">
                {phase === "writing" && (
                  <div className="fk-rs-writing">
                    <Sparkles size={14} strokeWidth={2} aria-hidden /> Writing the rule against your questions…
                  </div>
                )}
                {phase === "ready" && (
                  <div className="fk-rs-rule" key={rule.id}>
                    <p>
                      <em className="fk-rs-if">If</em>
                      {rule.when.map((tk, i) => (
                        <span key={i} data-k={tk.k}>
                          {tk.t}
                        </span>
                      ))}
                    </p>
                    <p>
                      <em className="fk-rs-if">Then</em>
                      {rule.then.map((tk, i) => (
                        <span key={i} data-k={tk.k}>
                          {tk.t}
                        </span>
                      ))}
                      {rule.pro && <b className="fk-rs-pro">Pro</b>}
                    </p>
                    <button
                      type="button"
                      className="fk-rs-add"
                      data-done={isAdded || undefined}
                      onClick={() => {
                        setHeld(true);
                        if (!isAdded) setAdded([...added, rule.id]);
                      }}
                    >
                      {isAdded ? (
                        <>
                          <Check size={14} strokeWidth={2.4} aria-hidden /> Added to the form
                        </>
                      ) : (
                        <>
                          <Plus size={14} strokeWidth={2.4} aria-hidden /> Add this rule
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="fk-rs-map">
              <span className="fk-rs-label">
                <Waypoints size={13} strokeWidth={2} aria-hidden /> Logic map
              </span>
              <svg viewBox="0 0 320 370" role="img" aria-label={`Logic map with ${added.length} new rules`}>
                {NODES.slice(0, -1).map((n, i) => (
                  <line key={n.label} x1="160" y1={n.y + 30} x2="160" y2={NODES[i + 1]!.y} className="fk-rs-base" />
                ))}
                <path d="M 160 282 L 160 330" className="fk-rs-base" />
                {RULES.map((r) =>
                  added.includes(r.id) ? (
                    <g key={r.id} className="fk-rs-edge" data-on={r.id === rule.id || undefined}>
                      <path d={r.edge} />
                      {!still && r.id === rule.id && (
                        <circle r="4">
                          <animateMotion dur="1.8s" repeatCount="indefinite" path={r.edge} />
                        </circle>
                      )}
                    </g>
                  ) : null,
                )}
                {NODES.map((n, i) => {
                  const hidden = i === 2 && added.includes("print");
                  return (
                    <g key={n.label} className="fk-rs-node" data-dim={hidden || undefined}>
                      <rect x="60" y={n.y} width="200" height="30" rx="10" />
                      <text x="160" y={n.y + 19.5}>
                        {n.label}
                      </text>
                    </g>
                  );
                })}
                {ENDS.map((e) => (
                  <g
                    key={e.id}
                    className="fk-rs-node fk-rs-end"
                    data-on={(e.id === "thanks" || added.includes(e.id)) || undefined}
                  >
                    <rect x={e.x} y="330" width="92" height="30" rx="15" />
                    <text x={e.x + 46} y="349.5">
                      {e.label}
                    </text>
                  </g>
                ))}
              </svg>
              <span className="fk-rs-test">
                <FlaskConical size={13} strokeWidth={2} aria-hidden /> Test a path before you publish
              </span>
            </div>
          </div>
        </SceneFrame>
      </div>

      <ul className="fk-rs-can">
        {CAN.map((c) => (
          <li key={c.title}>
            <span className="fk-rs-ic">
              <c.icon size={17} strokeWidth={2} aria-hidden />
            </span>
            <span>
              <b>
                {c.title} <small data-pro={c.plan === "Pro" || undefined}>{c.plan}</small>
              </b>
              <span>{c.body}</span>
            </span>
          </li>
        ))}
      </ul>
      <p className="fk-rs-more">
        <Link href="/features/logic">
          How logic works <ArrowRight size={15} strokeWidth={2} aria-hidden />
        </Link>
      </p>
    </section>
  );
}
