"use client";

import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { NightSky } from "@/components/brand/NightSky";
import { Glyph } from "@/components/brand/Glyph";
import { FIELD_ICONS } from "@/content/landing";

/**
 * The phone telling of the hero (without the pointer-driven floaters).
 * Everything else on the landing page is shared by every screen size.
 *
 * LandingPage renders this and the desktop scenes side by side and CSS shows
 * one of them, so the first paint is right on either and nothing has to wait
 * for JavaScript to pick a layout.
 */
export function MobileLanding() {
  return (
    <div className="fk-mob">
      <MobileHero />
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
        {/* The desktop hero carries the page's one <h1>; only one of the two shows. */}
        <p className="fk-m-hero-head" role="heading" aria-level={1}>
          What will your next{" "}
          <span className="fk-m-hero-pill">
            <span>
              <Check strokeWidth={2.6} aria-hidden />
            </span>
            form
          </span>{" "}
          do?
        </p>
        <p className="fk-m-hero-sub">
          Describe it and Formkit builds it. Branch the journey. Answer every response.
        </p>
        <div className="fk-m-hero-cta">
          <Link href="/signup" className="fk-pill fk-pill-light">
            Build a form
            <ArrowRight size={18} strokeWidth={1.8} aria-hidden />
          </Link>
          <a href="#ai" className="fk-ghost-pill">
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
