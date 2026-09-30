"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  GripVertical,
  Paperclip,
  Plus,
} from "lucide-react";
import { NightSky } from "@/components/brand/NightSky";
import { Glyph } from "@/components/brand/Glyph";
import {
  EDITOR_TABS,
  FEATURES,
  FIELD_ICONS,
  HERO_ROWS,
} from "@/content/landing";

/**
 * The landing page on a phone. The desktop story is choreographed by scroll
 * against pinned full-height scenes, which a phone cannot give it room for, so
 * this is the same story told for a narrow screen rather than the desktop
 * scenes squeezed: the hero and ASK before the shared sections, and the
 * features after them. What moved on scroll on desktop is something to touch
 * here: the features swipe.
 *
 * LandingPage renders this and the desktop scenes side by side and CSS shows
 * one of them, so the first paint is right on either and nothing has to wait
 * for JavaScript to pick a layout.
 */
export function MobileLanding({ part }: { part: "top" | "end" }) {
  return (
    <div className="fk-mob">
      {part === "top" ? (
        <>
          <MobileHero />
          <MobileAsk />
        </>
      ) : (
        <MobileFeatures />
      )}
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


/* ---------- hero ---------- */

const PEEK_TYPES = ["Short text", "Email", "Multiple choice", "Dropdown", "Rating", "Long text"];

function MobileHero() {
  return (
    <section className="fk-m-sec fk-m-hero" data-nav-hide>
      <NightSky />
      <div className="fk-m-hero-body">
        <p className="fk-m-hero-eyebrow">
          <span>Form builder</span>
          Build with AI, add logic, act on every answer. Free to start.
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
          Describe it and Formkit builds it. Branch the journey. Answer every response.
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
        Eleven questions, written once. Each answer type decides what the respondent sees. Drag to
        reorder, split into pages, publish when it reads right.
      </Plate>
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
        <p>{FEATURES.length} things Formkit does, and which plan has each. Free is the whole form builder; Pro adds AI on your responses and your own brand.</p>
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
