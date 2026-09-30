"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowRight,
  AtSign,
  Check,
  CircleDot,
  FileUp,
  GitBranch,
  Inbox,
  Paperclip,
  PenLine,
  Rocket,
  Send,
  SlidersHorizontal,
  Smartphone,
  Sparkles,
  TextCursorInput,
} from "lucide-react";

/**
 * The second thing on the landing page: one question's journey. It is built
 * in the builder, published to a respondent's phone, and submitted into your
 * inbox, and a line runs through all three so the connection is literal.
 * Pick another question and the line redraws to follow it.
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

type Wire = { d: string; x: number; y: number; x1: number; y1: number; x2: number; y2: number };

export function ProductShot() {
  const [at, setAt] = useState(1);
  const q = QS[at]!;
  const stage = useRef<HTMLDivElement | null>(null);
  const rows = useRef<(HTMLButtonElement | null)[]>([]);
  const phoneQ = useRef<HTMLDivElement | null>(null);
  const answers = useRef<(HTMLDivElement | null)[]>([]);
  const [wires, setWires] = useState<{ a: Wire; b: Wire } | null>(null);

  /** Runs the two lines from the chosen row to the phone, and on to its answer. */
  const measure = useCallback(() => {
    const s = stage.current;
    const row = rows.current[at];
    const phone = phoneQ.current;
    const ans = answers.current[at];
    if (!s || !row || !phone || !ans || s.clientWidth < 1000) {
      setWires(null);
      return;
    }
    const o = s.getBoundingClientRect();
    const r = row.getBoundingClientRect();
    const p = phone.getBoundingClientRect();
    const a = ans.getBoundingClientRect();
    const curve = (x1: number, y1: number, x2: number, y2: number): Wire => {
      const k = (x2 - x1) * 0.55;
      return {
        d: `M${x1} ${y1} C${x1 + k} ${y1}, ${x2 - k} ${y2}, ${x2} ${y2}`,
        x: (x1 + x2) / 2,
        y: (y1 + y2) / 2,
        x1,
        y1,
        x2,
        y2,
      };
    };
    setWires({
      a: curve(r.right - o.left + 6, r.top + r.height / 2 - o.top, p.left - o.left - 6, p.top + 40 - o.top),
      b: curve(p.right - o.left + 6, p.top + 40 - o.top, a.left - o.left - 6, a.top + a.height / 2 - o.top),
    });
  }, [at]);

  useEffect(() => {
    const raf = requestAnimationFrame(measure);
    const ro = new ResizeObserver(() => measure());
    if (stage.current) ro.observe(stage.current);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [measure]);

  return (
    <section id="product" className="fk-prod" aria-labelledby="prod-title">
      <div className="fk-prod-head">
        <div>
          <span className="fk-more-kicker">One question&rsquo;s journey</span>
          <h2 id="prod-title" className="fk-lp-h2">
            Build it once. Watch it answered. Read what comes back.
          </h2>
        </div>
        <div className="fk-prod-picker">
          <span>Follow a question</span>
          <div role="tablist" aria-label="Follow a question">
            {QS.map((x, i) => (
              <button key={x.n} type="button" role="tab" aria-selected={i === at} onClick={() => setAt(i)}>
                <em>{x.n}</em> {x.short}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="fk-prod-stage" ref={stage}>
        {wires && (
          <svg className="fk-prod-wires" aria-hidden key={at}>
            <path d={wires.a.d} />
            <path d={wires.b.d} />
            {[wires.a, wires.b].map((w, i) => (
              <g key={i}>
                <circle r="4.5" cx={w.x1} cy={w.y1} />
                <circle r="4.5" cx={w.x2} cy={w.y2} />
              </g>
            ))}
          </svg>
        )}
        {wires && (
          <>
            <span className="fk-prod-tag" style={{ left: wires.a.x, top: wires.a.y }} key={`a${at}`}>
              <Rocket size={12} strokeWidth={2.2} aria-hidden /> Publish
            </span>
            <span className="fk-prod-tag" style={{ left: wires.b.x, top: wires.b.y }} key={`b${at}`}>
              <Send size={12} strokeWidth={2.2} aria-hidden /> Submit
            </span>
          </>
        )}

        {/* 1. Build */}
        <div className="fk-prod-col">
          <span className="fk-prod-step">
            <b>
              <PenLine size={14} strokeWidth={2} aria-hidden />
            </b>
            <span>
              <em>1 · Build</em> You write it, or Ask Formkit drafts it
            </span>
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
            </div>
            <div className="fk-prod-ai">
              <Sparkles size={14} strokeWidth={2} aria-hidden />
              <span>
                Drafted from <q>An onboarding form for new clients, with budget and brand files</q>
              </span>
            </div>
            <div className="fk-prod-qs">
              <span className="fk-prod-page">Page 3 · Your project</span>
              {QS.map((x, i) => (
                <button
                  key={x.n}
                  ref={(el) => {
                    rows.current[i] = el;
                  }}
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

        <span className="fk-prod-flow" aria-hidden>
          <ArrowDown size={14} strokeWidth={2.2} /> Publish
        </span>

        {/* 2. Answer */}
        <div className="fk-prod-col fk-prod-col-phone">
          <span className="fk-prod-step">
            <b>
              <Smartphone size={14} strokeWidth={2} aria-hidden />
            </b>
            <span>
              <em>2 · Answer</em> On any screen
            </span>
          </span>
          <div className="fk-prod-phone" aria-label="The published form on a phone">
            <span className="fk-prod-notch" aria-hidden />
            <div className="fk-prod-screen">
              <span className="fk-prod-url">formkit.app/studio-nine/onboarding</span>
              <span className="fk-prod-brand">
                <i>S9</i> Studio Nine
                <small>{Number(q.n)} / 11</small>
              </span>
              <span className="fk-prod-progress">
                <i style={{ width: `${(Number(q.n) / 11) * 100}%` }} />
              </span>
              <div className="fk-prod-ask" key={q.n} ref={phoneQ}>
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
              </div>
              <span className="fk-prod-next">
                Continue <ArrowRight size={14} strokeWidth={2} aria-hidden />
              </span>
            </div>
          </div>
        </div>

        <span className="fk-prod-flow" aria-hidden>
          <ArrowDown size={14} strokeWidth={2.2} /> Submit
        </span>

        {/* 3. Read */}
        <div className="fk-prod-col">
          <span className="fk-prod-step">
            <b>
              <Inbox size={14} strokeWidth={2} aria-hidden />
            </b>
            <span>
              <em>3 · Read</em> Every answer, sorted by AI
            </span>
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
                <div
                  key={x.n}
                  ref={(el) => {
                    answers.current[i] = el;
                  }}
                  data-on={i === at || undefined}
                >
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
      </div>
    </section>
  );
}
