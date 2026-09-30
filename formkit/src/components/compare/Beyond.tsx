"use client";

import { useState } from "react";
import {
  GitBranch,
  MousePointerClick,
  Palette,
  Sparkles,
  TrendingDown,
} from "lucide-react";
import { SCENES } from "@/components/site/scenes";
import { SceneFrame } from "@/components/site/scenes/shared";

/**
 * What a row of ticks can't show: four things Formkit does, live, to click
 * through. The first three are the feature pages' own scenes; the drop-off
 * view is drawn here.
 */

const TABS = [
  {
    id: "brand",
    icon: Palette,
    label: "Your link, your look",
    body: "Your theme, your type and your logo, at formkit.app/your-name on every plan. Your own domain is on Pro.",
    scene: "branding",
    hint: "Try a theme, a font and your own domain",
  },
  {
    id: "logic",
    icon: GitBranch,
    label: "Only the questions that apply",
    body: "Skip, show and hide on every plan, with a map of every path through the form.",
    scene: "logic",
    hint: "Choose an answer and watch the path change",
  },
  {
    id: "ai",
    icon: Sparkles,
    label: "Describe it, get the form",
    body: "Ask Formkit writes every question from one sentence. 3 builds and 10 edits a month on Free.",
    scene: "ai-form-builder",
    hint: "Pick a prompt and watch it build",
  },
  {
    id: "drop",
    icon: TrendingDown,
    label: "See where people stop",
    body: "Drop-off by question and partial answers kept, on every plan, so a long form tells you where it loses people.",
    scene: null,
    hint: "Pick a question to see who stopped there",
  },
] as const;

export function Beyond() {
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("brand");
  const t = TABS.find((x) => x.id === tab)!;
  const entry = t.scene ? SCENES[t.scene] : null;

  return (
    <div className="fk-beyond">
      <div
        className="fk-beyond-tabs"
        role="tablist"
        aria-label="What a table can't show"
      >
        {TABS.map((x) => (
          <button
            key={x.id}
            type="button"
            role="tab"
            id={`fk-beyond-${x.id}`}
            aria-selected={x.id === tab}
            aria-controls="fk-beyond-panel"
            onClick={() => setTab(x.id)}
          >
            <span className="fk-beyond-ic">
              <x.icon size={17} strokeWidth={2} aria-hidden />
            </span>
            <span>
              <b>{x.label}</b>
              <small>{x.body}</small>
            </span>
          </button>
        ))}
      </div>
      <div
        className="fk-beyond-stage"
        id="fk-beyond-panel"
        role="tabpanel"
        aria-labelledby={`fk-beyond-${tab}`}
      >
        <div className="fk-beyond-scene" key={tab}>
          {entry ? <entry.Scene /> : <DropOff />}
        </div>
        <p className="fk-beyond-hint">
          <MousePointerClick size={15} strokeWidth={2} aria-hidden /> {t.hint}
        </p>
      </div>
    </div>
  );
}

const FUNNEL = [
  { q: "Your name and email", n: 240 },
  { q: "What does your company do?", n: 231 },
  { q: "Which services do you need?", n: 222 },
  { q: "Where does the budget sit?", n: 151 },
  { q: "When do you want to start?", n: 144 },
  { q: "Anything else we should know?", n: 138 },
];

const PARTIALS: Record<number, { who: string; last: string }[]> = {
  1: [{ who: "Ines Duarte", last: "ines@lumen.studio" }],
  2: [{ who: "Tom Becker", last: "Brand identity for a new café" }],
  3: [
    { who: "Priya Nair", last: "Website, Branding" },
    { who: "Sam Osei", last: "Website" },
  ],
  4: [{ who: "Leo Marchetti", last: "£10k to £24k" }],
  5: [{ who: "Ana Lima", last: "Next month" }],
};

/** Responses by question: how many reached each one, and who stopped where. */
function DropOff() {
  const [pick, setPick] = useState(3);
  const top = FUNNEL[0]!.n;
  const lost = FUNNEL[pick - 1] ? FUNNEL[pick - 1]!.n - FUNNEL[pick]!.n : 0;

  return (
    <SceneFrame
      title="Client onboarding · Analytics"
      label="Drop-off by question, with partial answers"
      right={<span className="fk-drop-live">Last 30 days</span>}
    >
      <div className="fk-drop">
        <div className="fk-drop-main">
          <p className="fk-drop-head">
            <b>{top}</b> started · how many answered each question
          </p>
          <ol className="fk-drop-bars">
            {FUNNEL.map((f, i) => {
              const drop = i > 0 ? FUNNEL[i - 1]!.n - f.n : 0;
              return (
                <li key={f.q}>
                  <button
                    type="button"
                    aria-pressed={i === pick}
                    onClick={() => setPick(i)}
                    disabled={i === 0}
                  >
                    <span className="fk-drop-q">
                      <em>{String(i + 1).padStart(2, "0")}</em> {f.q}
                    </span>
                    <span className="fk-drop-bar">
                      <i style={{ width: `${(f.n / top) * 100}%` }} />
                    </span>
                    <span className="fk-drop-n">
                      {Math.round((f.n / top) * 100)}%
                      {drop > 20 && <small>−{drop}</small>}
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        </div>
        <div className="fk-drop-side" key={pick}>
          <span className="fk-drop-big">{lost}</span>
          <span className="fk-drop-cap">
            people stopped at <q>{FUNNEL[pick]!.q}</q>
          </span>
          <span className="fk-drop-kept">Their answers so far are kept</span>
          <ul>
            {(PARTIALS[pick] ?? []).map((p) => (
              <li key={p.who}>
                <b>{p.who}</b>
                <span>Last answer: {p.last}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </SceneFrame>
  );
}
