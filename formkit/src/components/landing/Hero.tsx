"use client";

import Link from "next/link";
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
import { NightSky } from "@/components/brand/NightSky";

/**
 * The top of the landing page, for every screen size: the headline, then one
 * still picture of Formkit that tells the whole story at a glance. A form in
 * the builder (drafted by Ask Formkit), the same form on a respondent's
 * phone, and the response it sends back.
 *
 * Nothing moves by itself. Pick a question in the builder and the phone and
 * the response follow it, so the one thread through all three is the point.
 */

type Q = {
  n: string;
  type: string;
  icon: typeof AtSign;
  q: string;
  answer: string;
  options?: string[];
  logic?: string;
};

const QS: Q[] = [
  { n: "04", type: "Email", icon: AtSign, q: "Where should we send the proposal?", answer: "maya@northstar.co" },
  {
    n: "05",
    type: "Multiple choice",
    icon: CircleDot,
    q: "Which brand is this brief for?",
    options: ["Northstar", "Merrow", "Velto", "Fieldnote"],
    answer: "Northstar",
  },
  {
    n: "06",
    type: "Range",
    icon: SlidersHorizontal,
    q: "Where does the budget sit?",
    options: ["Under £10k", "£10k to £24k", "£24k to £40k"],
    answer: "£24k to £40k",
    logic: "Under £10k skips to Contact",
  },
  { n: "07", type: "Long text", icon: TextCursorInput, q: "What are we building, in one line?", answer: "A new site for Northstar, launching in March" },
  { n: "08", type: "File upload", icon: FileUp, q: "Share your brand guidelines", answer: "northstar-brand-2026.pdf" },
];

const PAGES = [
  ["01", "Welcome", "Intro"],
  ["02", "About you", "3"],
  ["03", "Your project", "8"],
] as const;

export function Hero() {
  return (
    <section id="top" className="fk-top" data-nav-hide>
      <NightSky />
      <div className="fk-top-copy">
        <p className="fk-hero-eyebrow">
          <span>Form builder</span>
          <span style={{ opacity: 0.82 }}>Build with AI, add logic, act on every answer. Free to start.</span>
        </p>
        <h1 className="fk-hero-head">
          What will your next{" "}
          <span className="fk-hero-pill">
            <span>
              <Check size={20} strokeWidth={2.4} aria-hidden />
            </span>
            form
          </span>{" "}
          <span style={{ display: "inline-block", verticalAlign: "middle" }}>do?</span>
        </h1>
        <p className="fk-hero-sub">Describe it and Formkit builds it. Branch the journey. Answer every response.</p>
        <div className="fk-hero-cta">
          <Link href="/signup" className="fk-pill fk-pill-light" style={{ height: 54, padding: "0 26px", fontSize: 16 }}>
            Build a form
            <ArrowRight size={18} strokeWidth={1.8} aria-hidden />
          </Link>
          <a href="#how" className="fk-ghost-pill" style={{ height: 54, padding: "0 24px" }}>
            Explore Formkit
          </a>
        </div>
      </div>
      <HeroShot />
    </section>
  );
}

function HeroShot() {
  const [at, setAt] = useState(1);
  const q = QS[at]!;

  return (
    <div className="fk-shot">
      <p className="fk-shot-hint">
        <span>Pick a question</span> and follow it from the builder to the phone to your inbox.
      </p>

      <div className="fk-shot-stage">
        {/* 1. The builder */}
        <div className="fk-shot-app">
          <div className="fk-shot-ask">
            <Sparkles size={15} strokeWidth={2} aria-hidden />
            <span>
              <em>Ask Formkit</em> An onboarding form for new clients, with budget and brand files
            </span>
            <b>
              <Check size={13} strokeWidth={2.6} aria-hidden /> Drafted 11 questions on 3 pages
            </b>
          </div>

          <div className="fk-shot-win">
            <div className="fk-shot-bar">
              <span className="fk-shot-dots" aria-hidden>
                <i />
                <i />
                <i />
              </span>
              <b>Client onboarding</b>
              <span className="fk-shot-draft">Draft</span>
              <span className="fk-shot-saved">Saved just now</span>
              <span className="fk-shot-eye" aria-hidden>
                <Eye size={14} strokeWidth={2} />
              </span>
              <span className="fk-shot-publish" aria-hidden>
                <Rocket size={13} strokeWidth={2} /> Publish
              </span>
            </div>
            <div className="fk-shot-body">
              <aside className="fk-shot-pages" aria-label="Pages">
                <span>Pages</span>
                {PAGES.map(([n, name, count]) => (
                  <div key={n} data-on={n === "03" || undefined}>
                    <em>{n}</em>
                    {name}
                    <small>{count}</small>
                  </div>
                ))}
                <div className="fk-shot-rule">
                  <GitBranch size={13} strokeWidth={2} aria-hidden />
                  Returning clients skip 3 questions
                </div>
              </aside>
              <div className="fk-shot-qs" role="listbox" aria-label="Questions on this page">
                {QS.map((x, i) => (
                  <button
                    key={x.n}
                    type="button"
                    role="option"
                    aria-selected={i === at}
                    onClick={() => setAt(i)}
                    onMouseEnter={() => setAt(i)}
                    onFocus={() => setAt(i)}
                  >
                    <span className="fk-shot-n">{x.n}</span>
                    <span className="fk-shot-q">
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
          <span className="fk-shot-cap" data-n="1">
            You build it, or Ask Formkit drafts it
          </span>
        </div>

        {/* 2. The phone */}
        <div className="fk-shot-phone-wrap">
          <div className="fk-shot-phone" aria-label="The published form on a phone">
            <span className="fk-shot-notch" aria-hidden />
            <div className="fk-shot-screen">
              <span className="fk-shot-url">formkit.app/studio-nine/onboarding</span>
              <span className="fk-shot-brand">
                <i>S9</i> Studio Nine
              </span>
              <span className="fk-shot-progress">
                <i style={{ width: `${((Number(q.n) + 1) / 12) * 100}%` }} />
              </span>
              <div className="fk-shot-ask-q" key={q.n}>
                <small>
                  Question {Number(q.n)} of 11
                </small>
                <p>{q.q}</p>
                {q.options ? (
                  <div className="fk-shot-opts">
                    {q.options.map((o) => (
                      <span key={o} data-on={o === q.answer || undefined}>
                        {o === q.answer && <Check size={13} strokeWidth={2.6} aria-hidden />}
                        {o}
                      </span>
                    ))}
                  </div>
                ) : q.type === "File upload" ? (
                  <span className="fk-shot-file">
                    <Paperclip size={14} strokeWidth={2} aria-hidden /> {q.answer}
                  </span>
                ) : (
                  <span className="fk-shot-input">{q.answer}</span>
                )}
                <span className="fk-shot-next">
                  Continue <ArrowRight size={14} strokeWidth={2} aria-hidden />
                </span>
              </div>
            </div>
          </div>
          <span className="fk-shot-cap" data-n="2">
            They answer on any screen
          </span>
        </div>

        {/* 3. What comes back */}
        <div className="fk-shot-resp-wrap">
          <div className="fk-shot-resp">
            <div className="fk-shot-resp-head">
              <span className="fk-shot-av">MO</span>
              <span>
                <b>Maya Okafor</b>
                <em>Northstar · just now</em>
              </span>
              <span className="fk-shot-new">New</span>
            </div>
            <dl>
              {QS.map((x, i) => (
                <div key={x.n} data-on={i === at || undefined}>
                  <dt>{x.q}</dt>
                  <dd>{x.answer}</dd>
                </div>
              ))}
            </dl>
            <div className="fk-shot-ai">
              <Sparkles size={13} strokeWidth={2} aria-hidden />
              <span data-tone="green">Positive</span>
              <span data-tone="blue">Lead score 82</span>
              <span>Reply sent</span>
            </div>
          </div>
          <span className="fk-shot-cap" data-n="3">
            Every answer lands, read and sorted
          </span>
        </div>
      </div>
    </div>
  );
}
