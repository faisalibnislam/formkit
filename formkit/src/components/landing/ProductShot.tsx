"use client";

import { useState } from "react";
import {
  ArrowRight,
  AtSign,
  Check,
  CircleDot,
  Eye,
  FileUp,
  GitBranch,
  Paperclip,
  Rocket,
  SlidersHorizontal,
  Sparkles,
  TextCursorInput,
} from "lucide-react";

/**
 * The second thing on the landing page: one form seen three ways at once.
 * The builder (drafted by Ask Formkit), the same form on a respondent's
 * phone, and the response it sends back. Pick a question and all three
 * follow it. Nothing moves by itself.
 */

type Q = {
  n: string;
  short: string;
  type: string;
  icon: typeof AtSign;
  q: string;
  answer: string;
  options?: string[];
  logic?: string;
};

const QS: Q[] = [
  { n: "04", short: "Email", type: "Email", icon: AtSign, q: "Where should we send the proposal?", answer: "maya@northstar.co" },
  {
    n: "05",
    short: "Brand",
    type: "Multiple choice",
    icon: CircleDot,
    q: "Which brand is this brief for?",
    options: ["Northstar", "Merrow", "Velto", "Fieldnote"],
    answer: "Northstar",
  },
  {
    n: "06",
    short: "Budget",
    type: "Range",
    icon: SlidersHorizontal,
    q: "Where does the budget sit?",
    options: ["Under £10k", "£10k to £24k", "£24k to £40k"],
    answer: "£24k to £40k",
    logic: "Under £10k skips to Contact",
  },
  {
    n: "07",
    short: "Project",
    type: "Long text",
    icon: TextCursorInput,
    q: "What are we building, in one line?",
    answer: "A new site for Northstar, launching in March",
  },
  { n: "08", short: "Brand files", type: "File upload", icon: FileUp, q: "Share your brand guidelines", answer: "northstar-brand-2026.pdf" },
];

const PAGES = [
  ["01", "Welcome", "Intro"],
  ["02", "About you", "3"],
  ["03", "Your project", "8"],
] as const;

export function ProductShot() {
  const [at, setAt] = useState(1);
  const q = QS[at]!;

  return (
    <section id="product" className="fk-prod" aria-labelledby="prod-title">
      <div className="fk-prod-head">
        <div>
          <span className="fk-more-kicker">One form, three views</span>
          <h2 id="prod-title" className="fk-lp-h2">
            Build it once. Watch it answered. Read what comes back.
          </h2>
        </div>
        <div className="fk-prod-picker">
          <span>Follow a question</span>
          <div role="tablist" aria-label="Follow a question">
            {QS.map((x, i) => (
              <button
                key={x.n}
                type="button"
                role="tab"
                aria-selected={i === at}
                onClick={() => setAt(i)}
              >
                <em>{x.n}</em> {x.short}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="fk-prod-stage">
        {/* 1. Build */}
        <div className="fk-prod-builder">
          <span className="fk-prod-badge">
            <b>1</b> Build it, or let AI draft it
          </span>
          <div className="fk-prod-win">
            <div className="fk-prod-bar">
              <span className="fk-prod-dots" aria-hidden>
                <i />
                <i />
                <i />
              </span>
              <b>Client onboarding</b>
              <span className="fk-prod-draft">Draft</span>
              <span className="fk-prod-eye" aria-hidden>
                <Eye size={14} strokeWidth={2} />
              </span>
              <span className="fk-prod-publish" aria-hidden>
                <Rocket size={13} strokeWidth={2} /> Publish
              </span>
            </div>
            <div className="fk-prod-ai">
              <Sparkles size={14} strokeWidth={2} aria-hidden />
              <span>
                Drafted by Ask Formkit from <q>An onboarding form for new clients, with budget and brand files</q>
              </span>
            </div>
            <div className="fk-prod-body">
              <aside className="fk-prod-pages" aria-label="Pages">
                {PAGES.map(([n, name, count]) => (
                  <div key={n} data-on={n === "03" || undefined}>
                    <em>{n}</em>
                    {name}
                    <small>{count}</small>
                  </div>
                ))}
                <div className="fk-prod-rule">
                  <GitBranch size={13} strokeWidth={2} aria-hidden />
                  <span>Returning clients skip 3 questions</span>
                </div>
              </aside>
              <div className="fk-prod-qs">
                {QS.map((x, i) => (
                  <button
                    key={x.n}
                    type="button"
                    aria-pressed={i === at}
                    onClick={() => setAt(i)}
                    tabIndex={-1}
                  >
                    <span className="fk-prod-n">{x.n}</span>
                    <span className="fk-prod-q">
                      <small>
                        <x.icon size={12} strokeWidth={2} aria-hidden /> {x.type}
                      </small>
                      {x.q}
                      {x.logic && (
                        <em>
                          <GitBranch size={11} strokeWidth={2} aria-hidden /> {x.logic}
                        </em>
                      )}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* 3. Read */}
        <div className="fk-prod-resp">
          <span className="fk-prod-badge">
            <b>3</b> Every answer, read and sorted
          </span>
          <div className="fk-prod-card">
            <div className="fk-prod-resp-head">
              <span className="fk-prod-av">MO</span>
              <span>
                <b>Maya Okafor</b>
                <em>Northstar · just now</em>
              </span>
              <span className="fk-prod-new">New</span>
            </div>
            <dl>
              {QS.map((x, i) => (
                <div key={x.n} data-on={i === at || undefined}>
                  <dt>{x.q}</dt>
                  <dd>{x.answer}</dd>
                </div>
              ))}
            </dl>
            <div className="fk-prod-tags">
              <Sparkles size={13} strokeWidth={2} aria-hidden />
              <span data-tone="green">Positive</span>
              <span data-tone="blue">Lead score 82</span>
              <span>Reply sent</span>
            </div>
          </div>
        </div>

        {/* 2. Answer */}
        <div className="fk-prod-phone-wrap">
          <div className="fk-prod-phone" aria-label="The published form on a phone">
            <span className="fk-prod-notch" aria-hidden />
            <div className="fk-prod-screen">
              <span className="fk-prod-url">formkit.app/studio-nine/onboarding</span>
              <span className="fk-prod-brand">
                <i>S9</i> Studio Nine
                <small>
                  {Number(q.n)} / 11
                </small>
              </span>
              <span className="fk-prod-progress">
                <i style={{ width: `${(Number(q.n) / 11) * 100}%` }} />
              </span>
              <div className="fk-prod-ask" key={q.n}>
                <p>{q.q}</p>
                {q.options ? (
                  <div className="fk-prod-opts">
                    {q.options.map((o) => (
                      <span key={o} data-on={o === q.answer || undefined}>
                        {o === q.answer && <Check size={13} strokeWidth={2.6} aria-hidden />}
                        {o}
                      </span>
                    ))}
                  </div>
                ) : q.type === "File upload" ? (
                  <span className="fk-prod-input">
                    <Paperclip size={14} strokeWidth={2} aria-hidden /> {q.answer}
                  </span>
                ) : (
                  <span className="fk-prod-input">{q.answer}</span>
                )}
                {q.logic && (
                  <span className="fk-prod-logic">
                    <GitBranch size={12} strokeWidth={2} aria-hidden /> {q.logic}
                  </span>
                )}
              </div>
              <span className="fk-prod-next">
                Continue <ArrowRight size={14} strokeWidth={2} aria-hidden />
              </span>
            </div>
          </div>
          <span className="fk-prod-badge">
            <b>2</b> They answer, on any screen
          </span>
        </div>
      </div>
    </section>
  );
}
