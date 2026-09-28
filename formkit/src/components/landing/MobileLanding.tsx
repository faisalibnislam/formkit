"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import {
  ArrowDownRight,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Check,
  ChartPie,
  CircleCheck,
  Eye,
  FileSpreadsheet,
  FileText,
  GripVertical,
  Lock,
  MessageSquare,
  MousePointerClick,
  Paperclip,
  Plus,
  Timer,
} from "lucide-react";
import { NightSky } from "@/components/brand/NightSky";
import { Glyph } from "@/components/brand/Glyph";
import {
  ANSWER_ROWS,
  BRAND_CHOICES,
  DROP_ROWS,
  EDITOR_TABS,
  FEATURES,
  FIELD_ICONS,
  FUNNEL,
  HERO_ROWS,
  INBOX_ROWS,
  LIVE_QUESTIONS,
  LOGIC_LINES,
  PATH_ROWS,
  RANGES,
  RESPONDENT_QS,
  STAT_CARDS,
  WEEK_BARS,
} from "@/content/landing";
import { BrandMark, STEP_PROGRESS, STEP_QUESTION, useLiveForm } from "./AnswerScene";
import { Ticks } from "./Ticks";

/**
 * The landing page on a phone. The desktop story is choreographed by scroll
 * against pinned full-height scenes, which a phone cannot give it room for, so
 * this is the same story told for a narrow screen rather than the desktop
 * scenes squeezed: ASK → SHAPE → ANSWER → UNDERSTAND → the features, in the
 * same order and with the same form, Maya and numbers throughout.
 *
 * What moved on scroll on desktop is something to touch here: the path
 * switches between new and existing clients, the form answers for real, and
 * the features swipe.
 *
 * LandingPage renders this and the desktop scenes side by side and CSS shows
 * one of them, so the first paint is right on either and nothing has to wait
 * for JavaScript to pick a layout.
 */
export function MobileLanding() {
  return (
    <div className="fk-mob">
      <MobileHero />
      <MobileAsk />
      <MobileShape />
      <MobileAnswer />
      <MobileInbox />
      <MobileAnalytics />
      <MobileFeatures />
    </div>
  );
}

/** The dark caption plate that closes a scene, as on desktop. */
function Plate({ eyebrow, title, children }: { eyebrow: string; title: string; children: string }) {
  return (
    <div className="fk-m-plate">
      <span className="fk-m-eyebrow">{eyebrow}</span>
      <h2>{title}</h2>
      <p>{children}</p>
    </div>
  );
}

function Heading({ eyebrow, title, children }: { eyebrow: string; title: string; children: string }) {
  return (
    <div className="fk-m-heading">
      <span className="fk-m-eyebrow">{eyebrow}</span>
      <h2>{title}</h2>
      <p>{children}</p>
    </div>
  );
}

/* ---------- hero ---------- */

const PEEK_TYPES = ["Short text", "Email", "Multiple choice", "Dropdown", "Rating", "Long text"];

function MobileHero() {
  return (
    <section className="fk-m-sec fk-m-hero" data-nav-hide>
      <NightSky />
      <div className="fk-m-hero-body">
        <p className="fk-m-hero-eyebrow">
          <span>Form builder</span>
          Build forms, add logic, read the responses — free.
        </p>
        <h1 className="fk-m-hero-head">
          What will your next{" "}
          <span className="fk-m-hero-pill">
            <span>
              <Check strokeWidth={2.6} aria-hidden />
            </span>
            form
          </span>{" "}
          do?
        </h1>
        <p className="fk-m-hero-sub">
          Design the questions. Branch the journey. Read what comes back.
        </p>
        <div className="fk-m-hero-cta">
          <Link href="/signup" className="fk-pill fk-pill-light">
            Build a form
            <ArrowRight size={18} strokeWidth={1.8} aria-hidden />
          </Link>
          <a href="#m-ask" className="fk-ghost-pill">
            Explore Formkit
          </a>
        </div>
      </div>

      {/* The builder rising out of the sky, as the desktop hero hands off to it. */}
      <div className="fk-m-hero-peek" aria-hidden>
        <div className="fk-m-peek-bar">
          <span className="fk-m-peek-dots">
            <span />
            <span />
            <span />
          </span>
          <span>Add a question</span>
          <span className="fk-m-peek-saved">16 types</span>
        </div>
        <div className="fk-m-peek-grid">
          {PEEK_TYPES.map((t) => (
            <span key={t}>
              <Glyph name={FIELD_ICONS[t] ?? "type"} size={15} />
              {t}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------- ask ---------- */

function QuestionCard({ row }: { row: (typeof HERO_ROWS)[number] }) {
  return (
    <div className="fk-m-qcard" data-selected={"selected" in row && row.selected ? "true" : undefined}>
      <span className="fk-m-qcard-grip">
        <GripVertical size={15} strokeWidth={1.8} />
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span className="fk-m-qcard-meta">
          <span>{row.no}</span>
          <span className="fk-m-chip">{row.type}</span>
          {row.required && <span className="fk-m-qcard-req">Required</span>}
        </span>
        <span className="fk-m-qcard-q">{row.q}</span>
        <span className="fk-m-qcard-field">
          {row.type === "File upload" && <Paperclip size={14} strokeWidth={1.8} />}
          {row.placeholder}
        </span>
      </span>
    </div>
  );
}

function MobileAsk() {
  return (
    <section id="m-ask" className="fk-m-sec fk-m-paper">
      <div className="fk-m-builder" aria-hidden>
        <div className="fk-m-builder-top">
          <span>
            <span className="fk-m-builder-title">Client onboarding</span>
            <span className="fk-m-builder-sub">Draft · 11 questions · saved</span>
          </span>
          <span className="fk-m-builder-publish">Publish</span>
        </div>
        <div className="fk-m-tabs">
          {EDITOR_TABS.slice(0, 4).map((t) => (
            <span key={t.label} className="fk-m-tab" data-on={t.on ? "true" : undefined}>
              <Glyph name={t.icon} size={15} />
              {t.label}
            </span>
          ))}
        </div>
        <div className="fk-m-page">
          <span>Page 2 · About you</span>
          <span>3 questions</span>
        </div>
        <div className="fk-m-qlist">
          {HERO_ROWS.map((r) => (
            <QuestionCard key={r.no} row={r} />
          ))}
          <span className="fk-m-addq">
            <Plus size={16} strokeWidth={1.8} />
            Add a question
          </span>
        </div>
      </div>
      <Plate eyebrow="ASK" title="Start with what you need to know.">
        Eleven questions, written once. Each answer type decides what the respondent sees — drag to
        reorder, split into pages, publish when it reads right.
      </Plate>
    </section>
  );
}

/* ---------- shape ---------- */

function MobileShape() {
  const [existing, setExisting] = useState(true);
  // The two questions an existing client never sees.
  const skipped = (i: number) => existing && (i === 1 || i === 2);

  return (
    <section id="m-shape" className="fk-m-sec fk-m-white">
      <div className="fk-m-pad">
        <div className="fk-m-logic">
          <span className="fk-m-label">Logic · Client onboarding</span>
          {LOGIC_LINES.map((l) => (
            <span key={l.k} className="fk-m-logicline">
              <span>{l.k}</span>
              {l.v}
            </span>
          ))}
        </div>

        <div className="fk-m-paths">
          {PATH_ROWS.map((r) => (
            <div key={r.label}>
              <div className="fk-m-pathhead">
                <span className="fk-m-pathpct">{r.pct}</span>
                <span className="fk-m-pathlabel">{r.label}</span>
                <span className="fk-m-pathcount">{r.count}</span>
              </div>
              <Ticks total={40} filled={Math.round((r.filled / r.total) * 40)} fill={r.fill} height={34} />
            </div>
          ))}
        </div>

        <div className="fk-m-sees">
          <div className="fk-m-sees-head">
            <span>Have we worked together before?</span>
          </div>
          <div className="fk-m-switch" role="radiogroup" aria-label="Have we worked together before?">
            {[
              { on: true, label: "Yes — existing client" },
              { on: false, label: "No — new client" },
            ].map((o) => (
              <button
                key={o.label}
                type="button"
                role="radio"
                aria-checked={existing === o.on}
                onClick={() => setExisting(o.on)}
              >
                {o.label}
              </button>
            ))}
          </div>
          <div className="fk-m-sees-count">
            <span>What Maya sees</span>
            <span>{existing ? 8 : 11} questions</span>
          </div>
          <ul className="fk-m-sees-list">
            {RESPONDENT_QS.map((q, i) => (
              <li key={q} data-skipped={skipped(i) ? "true" : undefined}>
                <span aria-hidden />
                {q}
                {skipped(i) && <em>Skipped</em>}
              </li>
            ))}
          </ul>
        </div>
      </div>
      <Plate eyebrow="SHAPE" title="People only answer what applies to them.">
        One rule per line. Clients you have worked with before skip three questions you already know
        the answers to. Everyone else answers all eleven.
      </Plate>
    </section>
  );
}

/* ---------- answer ---------- */

function MobileAnswer() {
  const section = useRef<HTMLElement | null>(null);
  const { step, chosen, attached, nextLabel, choose, attach, back, next } = useLiveForm(section);

  return (
    <section ref={section} id="m-answer" className="fk-m-sec fk-m-blue">
      <Heading eyebrow="ANSWER" title="Filling it in should feel like talking to you.">
        This is the real form. Answer it here; it works the way it does for your client.
      </Heading>

      <div className="fk-m-live">
        <div className="fk-m-live-url">
          <Lock size={12} strokeWidth={1.8} aria-hidden />
          <span>formkit.app/studio-nine/client-onboarding</span>
        </div>
        <div className="fk-m-live-body">
          <div className="fk-m-live-brand">
            <span className="fk-m-s9">S9</span>
            <span>Studio Nine</span>
            <span style={{ flex: 1 }} />
            <span className="fk-m-live-step">
              {step === 2 ? "Submitted" : `${STEP_QUESTION[step]} of 11`}
            </span>
          </div>
          <span className="fk-m-live-progress" aria-hidden>
            <span style={{ width: `${STEP_PROGRESS[step]}%` }} />
          </span>

          <div className="fk-m-live-stage" aria-live="polite">
            {step === 0 && (
              <>
                <div className="fk-m-live-q" id="fk-m-live-q0">
                  {LIVE_QUESTIONS[0]}
                </div>
                <div className="fk-m-live-choices" role="radiogroup" aria-labelledby="fk-m-live-q0">
                  {BRAND_CHOICES.map((b) => (
                    <button
                      key={b.id}
                      type="button"
                      role="radio"
                      aria-checked={chosen === b.id}
                      className="fk-live-choice"
                      data-on={chosen === b.id}
                      onClick={() => choose(b.id)}
                    >
                      <BrandMark brand={b} size={20} />
                      <span style={{ flex: 1, minWidth: 0 }}>{b.name}</span>
                      <CircleCheck
                        size={18}
                        strokeWidth={1.8}
                        aria-hidden
                        style={{ color: "var(--blue-700)", opacity: chosen === b.id ? 1 : 0 }}
                      />
                    </button>
                  ))}
                </div>
              </>
            )}

            {step === 1 && (
              <>
                <div className="fk-m-live-q">{LIVE_QUESTIONS[1]}</div>
                <button type="button" className="fk-m-drop" data-on={attached} onClick={attach}>
                  <span className="fk-m-drop-icon">
                    <Paperclip size={17} strokeWidth={1.8} aria-hidden />
                  </span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span className="fk-m-drop-name">
                      {attached ? "northstar-brand-2026.pdf · 2.4 MB" : "Select a file"}
                    </span>
                    <span className="fk-m-drop-hint">Up to 20 MB · .pdf .png .docx</span>
                  </span>
                </button>
              </>
            )}

            {step === 2 && (
              <div className="fk-m-live-done">
                <span>
                  <CircleCheck size={22} strokeWidth={1.8} aria-hidden />
                </span>
                <span>
                  <span className="fk-m-live-q">{LIVE_QUESTIONS[2]}</span>
                  <span className="fk-m-live-note">
                    Studio Nine will be in touch within two working days.
                  </span>
                </span>
              </div>
            )}
          </div>

          <div className="fk-m-live-actions">
            <button type="button" className="fk-m-back" onClick={back} disabled={step === 0}>
              <ArrowLeft size={15} strokeWidth={1.8} aria-hidden />
              Back
            </button>
            <button type="button" className="fk-m-next" onClick={next}>
              {nextLabel}
              <ArrowRight size={15} strokeWidth={1.8} aria-hidden />
            </button>
          </div>
          <p className="fk-m-live-saved" data-on={step > 0}>
            Answers saved as Maya goes
          </p>
        </div>
      </div>
    </section>
  );
}

/* ---------- understand ---------- */

function MobileInbox() {
  const peak = 88;
  const ticks = [42, 55, 48, 61, 58, 66, 72, 69, 78, 74, 83, 88];
  return (
    <section id="m-understand" className="fk-m-sec fk-m-white">
      <div className="fk-m-inbox" aria-label="An example response inbox">
        <div className="fk-m-inbox-head">
          <span>
            <strong>Responses</strong> Client onboarding
          </span>
          <span>248 total</span>
        </div>
        {INBOX_ROWS.map((r) => (
          <div key={r.key} className="fk-m-inbox-row" data-on={r.key === "maya" ? "true" : undefined}>
            <span className="fk-m-avatar">{r.initials}</span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span className="fk-m-inbox-name">{r.name}</span>
              <span className="fk-m-inbox-meta">{r.meta}</span>
            </span>
            <span className="fk-m-badge" data-tone={r.badge}>
              {r.badge}
            </span>
          </div>
        ))}

        <div className="fk-m-sheet">
          <div className="fk-m-sheet-head">
            <span>Maya Okafor</span>
            <span className="fk-m-badge" data-tone="New">
              New
            </span>
            <span style={{ flex: 1 }} />
            <span className="fk-m-sheet-when">2 minutes ago</span>
          </div>
          <dl>
            {ANSWER_ROWS.map((a) => (
              <div key={a.q}>
                <dt>{a.q}</dt>
                <dd>{a.a}</dd>
              </div>
            ))}
          </dl>
          <div className="fk-m-file">
            <Paperclip size={14} strokeWidth={1.8} aria-hidden />
            <span style={{ flex: 1, minWidth: 0 }}>northstar-brand-2026.pdf</span>
            <span>2.4 MB</span>
          </div>
          <div className="fk-m-sheet-actions" aria-hidden>
            <span className="fk-m-sheet-primary">
              <Check size={14} strokeWidth={2} />
              Mark reviewed
            </span>
            <span>
              <MessageSquare size={14} strokeWidth={1.8} />
              Add a note
            </span>
          </div>
        </div>

        <div className="fk-m-inbox-stats">
          <div>
            <span className="fk-m-label">Completion rate</span>
            <span className="fk-m-big">
              <span data-count="72.5" data-dec="1" data-suffix="%">
                72.5%
              </span>
            </span>
            <span className="fk-m-minibars" aria-hidden>
              {ticks.map((t, i) => (
                <span
                  key={i}
                  style={{
                    height: `${(t / peak) * 100}%`,
                    background: i >= ticks.length - 3 ? "var(--green-400)" : "var(--neutral-200)",
                  }}
                />
              ))}
            </span>
          </div>
          <div>
            <span className="fk-m-label">Where people stop</span>
            {DROP_ROWS.map((d) => (
              <span key={d.label} className="fk-m-drop-row">
                <span>{d.label}</span>
                <Ticks total={d.total} filled={d.filled} fill={d.fill} short height={14} />
                <span>{d.pctLabel}</span>
              </span>
            ))}
          </div>
        </div>
      </div>
      <Plate eyebrow="UNDERSTAND" title="Answers land in one place, ready to read.">
        248 answers in one inbox. People who stopped halfway are kept too, counted on their own.
      </Plate>
    </section>
  );
}

/* ---------- analytics ---------- */

const STAT_ICONS: Record<string, typeof Eye> = {
  eye: Eye,
  "mouse-pointer-click": MousePointerClick,
  "circle-check": CircleCheck,
  "chart-pie": ChartPie,
  timer: Timer,
};

function MobileAnalytics() {
  const [range, setRange] = useState(RANGES[1]!);
  const peak = Math.max(...WEEK_BARS);
  // The dark completion-rate card closes the grid across both columns.
  const cards = [...STAT_CARDS.filter((s) => s.tone !== "dark"), ...STAT_CARDS.filter((s) => s.tone === "dark")];

  return (
    <section id="m-analytics" className="fk-m-sec fk-m-blue">
      <Heading eyebrow="ANALYTICS" title="See where people give up, not just who finished.">
        How many looked, how many started, how many finished, how long it took, and the question they
        quit on.
      </Heading>

      <div className="fk-m-pad-x">
        <div className="fk-m-ranges" role="radiogroup" aria-label="Date range">
          {RANGES.map((r) => (
            <button key={r} type="button" role="radio" aria-checked={range === r} onClick={() => setRange(r)}>
              {r}
            </button>
          ))}
        </div>

        <div className="fk-m-stats">
          {cards.map((s) => {
            const Icon = STAT_ICONS[s.icon] ?? Eye;
            return (
              <div key={s.label} className="fk-m-stat" data-tone={s.tone}>
                <span className="fk-m-stat-label">
                  <Icon size={14} strokeWidth={1.8} aria-hidden />
                  {s.label}
                </span>
                <span className="fk-m-stat-row">
                  <span className="fk-m-stat-num">
                    <span data-count={s.count} data-dec={s.dec ? "1" : undefined} data-suffix={s.suffix || undefined}>
                      {s.dec ? s.count.toFixed(1) : s.count.toLocaleString("en-US")}
                      {s.suffix}
                    </span>
                  </span>
                  <span className="fk-m-stat-delta" data-up={s.up}>
                    {s.up ? (
                      <ArrowUpRight size={12} strokeWidth={2} aria-hidden />
                    ) : (
                      <ArrowDownRight size={12} strokeWidth={2} aria-hidden />
                    )}
                  </span>
                  <span className="fk-m-stat-change">{s.delta}</span>
                </span>
              </div>
            );
          })}
        </div>

        <div className="fk-m-card">
          <span className="fk-m-card-title">Responses over time</span>
          <div className="fk-m-bars" aria-hidden>
            {WEEK_BARS.map((v, i) => (
              <span key={i}>
                <span className="fk-m-bar-val">{v}</span>
                <span
                  className="fk-m-bar"
                  style={{
                    height: `${(v / peak) * 100}%`,
                    background: i === WEEK_BARS.length - 1 ? "var(--yellow-400)" : "var(--green-400)",
                  }}
                />
                <span className="fk-m-bar-week">{i + 1}</span>
              </span>
            ))}
          </div>
          <span className="fk-m-bars-foot">Weeks 1–12</span>
        </div>

        <div className="fk-m-card">
          <span className="fk-m-card-title">Completion funnel</span>
          {FUNNEL.map((f) => (
            <div key={f.label} className="fk-m-funnel">
              <span className="fk-m-funnel-head">
                <span>{f.pct}</span>
                {f.label}
                <span style={{ flex: 1 }} />
                <span className="fk-m-funnel-count">{f.count}</span>
              </span>
              <Ticks total={36} filled={Math.round((f.filled / f.total) * 36)} fill={f.fill} height={26} />
            </div>
          ))}
          <p className="fk-m-card-note">
            34% of people who open this form never start it. Most of them leave on a phone.
          </p>
        </div>

        <div className="fk-m-exports" aria-hidden>
          <span>
            <FileSpreadsheet size={15} strokeWidth={1.8} />
            Export Excel
          </span>
          <span>
            <FileText size={15} strokeWidth={1.8} />
            Export CSV
          </span>
        </div>
      </div>
    </section>
  );
}

/* ---------- features ---------- */

function MobileFeatures() {
  const track = useRef<HTMLDivElement | null>(null);
  const [at, setAt] = useState(0);

  const cardStep = () => {
    const el = track.current;
    const first = el?.firstElementChild as HTMLElement | null;
    if (!el || !first) return 1;
    return first.offsetWidth + parseFloat(getComputedStyle(el).columnGap || "0");
  };

  const go = (direction: -1 | 1) => {
    const el = track.current;
    if (!el) return;
    const reduced = window.matchMedia("(prefers-reduced-motion:reduce)").matches;
    el.scrollBy({ left: direction * cardStep(), behavior: reduced ? "auto" : "smooth" });
  };

  return (
    <section id="m-features" className="fk-m-sec fk-m-dark" data-nav-hide>
      <div className="fk-m-heading fk-m-heading-dark">
        <span className="fk-m-eyebrow">EVERYTHING IN FORMKIT</span>
        <h2>Everything from the first question to the spreadsheet.</h2>
        <p>Twelve things Formkit does. Every one starts on the free plan; Pro and Business take them further.</p>
      </div>

      <div
        ref={track}
        className="fk-m-ftrack"
        tabIndex={0}
        role="region"
        aria-label="Formkit features, swipe for more"
        onScroll={(e) => {
          const i = Math.round(e.currentTarget.scrollLeft / cardStep());
          setAt(Math.min(FEATURES.length - 1, Math.max(0, i)));
        }}
      >
        {FEATURES.map((f) => (
          <article key={f.title} className="fk-m-fcard">
            <span className="fk-m-ficon" style={{ background: f.bg }}>
              <Glyph name={f.icon} size={20} />
            </span>
            <h3>{f.title}</h3>
            <p>{f.body}</p>
            <span className="fk-m-fchip">{f.chip}</span>
          </article>
        ))}
      </div>

      <div className="fk-m-fnav">
        <span className="fk-m-fcount" aria-live="polite">
          {String(at + 1).padStart(2, "0")} / {FEATURES.length}
        </span>
        <span className="fk-m-fbar" aria-hidden>
          <span style={{ width: `${((at + 1) / FEATURES.length) * 100}%` }} />
        </span>
        <button type="button" className="fk-round-btn" aria-label="Previous feature" disabled={at === 0} onClick={() => go(-1)}>
          <ArrowLeft size={16} strokeWidth={1.8} aria-hidden />
        </button>
        <button
          type="button"
          className="fk-round-btn"
          aria-label="Next feature"
          disabled={at === FEATURES.length - 1}
          onClick={() => go(1)}
        >
          <ArrowRight size={16} strokeWidth={1.8} aria-hidden />
        </button>
      </div>
    </section>
  );
}
