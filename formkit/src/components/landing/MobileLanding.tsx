"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { NightSky } from "@/components/brand/NightSky";
import { Glyph } from "@/components/brand/Glyph";
import { FEATURES, FIELD_ICONS } from "@/content/landing";

/**
 * The phone telling of the two desktop scenes that pin: the hero (without
 * the pointer-driven floaters) and the features carousel, which swipes here.
 * Everything else on the landing page is shared by every screen size.
 *
 * LandingPage renders this and the desktop scenes side by side and CSS shows
 * one of them, so the first paint is right on either and nothing has to wait
 * for JavaScript to pick a layout.
 */
export function MobileLanding({ part }: { part: "hero" | "features" }) {
  return <div className="fk-mob">{part === "hero" ? <MobileHero /> : <MobileFeatures />}</div>;
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
          <a href="#product" className="fk-ghost-pill">
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
