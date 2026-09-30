"use client";

import { useRef, useState } from "react";
import { RotateCcw, Sparkles, Wand2 } from "lucide-react";
import { Chips, SceneFrame, useInView, useReducedMotion, useStep, type SceneProps } from "./shared";

/** A sentence goes in; a form comes out, one question at a time. */

type Draft = {
  key: string;
  label: string;
  prompt: string;
  title: string;
  pages: number;
  rule: string;
  questions: [string, string][];
};

const DRAFTS: Draft[] = [
  {
    key: "intake",
    label: "Studio intake",
    prompt: "An intake form for a branding studio, with budget and timeline",
    title: "Studio intake",
    pages: 2,
    rule: "Only ask about print if they need it",
    questions: [
      ["Your name and company", "Short text"],
      ["What do you need?", "Choice"],
      ["Do you need print too?", "Yes / No"],
      ["Budget", "Range"],
      ["When do you need it by?", "Date"],
      ["Anything else we should know?", "Long text"],
    ],
  },
  {
    key: "rsvp",
    label: "Party RSVP",
    prompt: "An RSVP for our summer party, with dietary needs and a plus one",
    title: "Summer party RSVP",
    pages: 1,
    rule: "Ask the guest's name only if they bring one",
    questions: [
      ["Your name", "Short text"],
      ["Are you coming?", "Yes / No"],
      ["Bringing a plus one?", "Yes / No"],
      ["Their name", "Short text"],
      ["Any dietary needs?", "Checkboxes"],
    ],
  },
  {
    key: "job",
    label: "Job application",
    prompt: "A job application for a junior designer, with a portfolio upload",
    title: "Junior designer",
    pages: 3,
    rule: "Skip the visa page for people already eligible",
    questions: [
      ["Full name", "Short text"],
      ["Email", "Email"],
      ["Portfolio", "File upload"],
      ["Why this role?", "Long text"],
      ["Do you need a visa to work here?", "Yes / No"],
      ["Earliest start date", "Date"],
    ],
  },
];

/** typing → thinking → building → done */
type Phase = "typing" | "thinking" | "building" | "done";

export function AiBuildScene({ compact }: SceneProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const seen = useInView(ref);
  const still = useReducedMotion();
  const [pick, setPick] = useState(0);
  const [phase, setPhase] = useState<Phase>("typing");
  const [chars, setChars] = useState(0);
  const [built, setBuilt] = useState(0);
  const d = DRAFTS[pick]!;
  const on = seen && !still;

  // Type the prompt, think, then land each question.
  useStep(on && phase === "typing", chars === 0 ? 500 : 26, () => {
    if (chars < d.prompt.length) setChars(chars + 1);
    else setPhase("thinking");
  }, [chars, pick]);
  useStep(on && phase === "thinking", 1100, () => setPhase("building"), [pick]);
  useStep(on && phase === "building", 360, () => {
    if (built < d.questions.length) setBuilt(built + 1);
    else setPhase("done");
  }, [built, pick]);
  // On the index the scene plays through each prompt in turn.
  useStep(on && !!compact && phase === "done", 3200, () => restart((pick + 1) % DRAFTS.length), [pick]);

  function restart(i: number) {
    setPick(i);
    setChars(0);
    setBuilt(0);
    setPhase("typing");
  }

  const done = still || phase === "done";
  const typed = still ? d.prompt : d.prompt.slice(0, chars);
  const count = still ? d.questions.length : built;

  return (
    <SceneFrame
      innerRef={ref}
      compact={compact}
      title="Ask Formkit"
      label={`Ask Formkit turns “${d.prompt}” into a form with ${d.questions.length} questions.`}
      right={
        !compact && (
          <button type="button" className="fk-sc-icon" onClick={() => restart(pick)} aria-label="Play again">
            <RotateCcw size={14} strokeWidth={2} />
          </button>
        )
      }
    >
      {!compact && (
        <Chips
          label="Try a prompt"
          value={d.key}
          options={DRAFTS.map((x) => ({ value: x.key, label: x.label }))}
          onChange={(k) => restart(DRAFTS.findIndex((x) => x.key === k))}
        />
      )}
      <div className="fk-ai-prompt">
        <Sparkles size={15} strokeWidth={2} aria-hidden />
        <span>
          {typed}
          {!done && phase === "typing" && <i className="fk-ai-caret" aria-hidden />}
        </span>
      </div>

      <div className="fk-ai-draft" data-phase={still ? "done" : phase}>
        <div className="fk-ai-head">
          <b>{d.title}</b>
          <span>
            {phase === "thinking" && !still ? (
              <span className="fk-ai-think">
                <Wand2 size={13} strokeWidth={2} aria-hidden /> Drafting
                <i />
                <i />
                <i />
              </span>
            ) : (
              `${count} of ${d.questions.length} questions · ${d.pages} ${d.pages === 1 ? "page" : "pages"}`
            )}
          </span>
        </div>
        <ol className="fk-ai-qs">
          {d.questions.map(([q, type], i) => (
            <li key={q} data-on={i < count || undefined}>
              <span className="fk-ai-n">{i + 1}</span>
              <span className="fk-ai-q">{q}</span>
              <span className="fk-ai-type">{type}</span>
            </li>
          ))}
        </ol>
        <div className="fk-ai-rule" data-on={done || undefined}>
          <span>Logic</span> {d.rule}
        </div>
      </div>
    </SceneFrame>
  );
}
