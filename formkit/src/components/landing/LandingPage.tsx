"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef } from "react";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { SiteNav } from "@/components/site/SiteNav";
import { SiteFooter } from "@/components/site/SiteFooter";
import { CompareTable } from "@/components/site/CompareTable";
import { COMPARE_ASOF } from "@/content/compare";
import { HELP_ARTICLES } from "@/content/help";
import { LANDING_FAQS } from "@/content/landing";
import { HeroScene } from "./HeroScene";
import { ProductShot } from "./ProductShot";
import { FeaturesScene } from "./FeaturesScene";
import { MobileLanding } from "./MobileLanding";
import { MoreScenes } from "./MoreScenes";
import { AiBand } from "./AiBand";
import { createEngine, UNPIN_AT, type Engine } from "./scrollEngine";

/**
 * The marketing home: the headline in the night sky with form pieces that lean
 * with the pointer, one form seen three ways (builder, phone, response), then
 * AI takes the stage (building, deciding, answering), then everything else,
 * companies and the plans. Only the features carousel is driven by scroll.
 *
 * The scroll choreography is an imperative effect writing to the DOM, not React
 * state. Driving 900vh of it through render would drop frames, and nothing must
 * re-render over the scroll-written inline styles.
 */
export function LandingPage() {
  const root = useRef<HTMLDivElement | null>(null);
  const engine = useRef<Engine | null>(null);

  useEffect(() => {
    const el = root.current;
    if (!el) return;

    const e = createEngine(el);
    engine.current = e;
    e.measure();

    const reduced = window.matchMedia("(prefers-reduced-motion:reduce)").matches;
    if (reduced) {
      // Every scene resolves to its end state.
      e.resolveAll();
      return;
    }

    // The floating pieces around the headline run on their own clock and lean
    // with the pointer, so they keep moving after the scroll loop has parked.
    const stopFloaties = e.floaties();

    let eased = 0;
    let raf: number | null = null;
    let mobileResolved = false;

    const frame = () => {
      raf = null;

      // Below the unpin breakpoint the scenes are ordinary stacked sections;
      // driving their transforms would move content that is no longer pinned.
      if (window.innerWidth <= UNPIN_AT) {
        if (!mobileResolved) {
          mobileResolved = true;
          e.resolveAll();
        }
        e.applyCounters();
        return;
      }
      mobileResolved = false;

      const target = e.progress("features");
      const delta = target - eased;
      const moving = Math.abs(delta) > 0.0004;
      eased = moving ? eased + delta * 0.16 : target;
      e.applyFeatures(eased);
      e.applyCounters();

      if (moving) raf = requestAnimationFrame(frame);
    };

    const kick = () => {
      if (raf === null) raf = requestAnimationFrame(frame);
    };
    const onResize = () => {
      e.measure();
      kick();
    };

    window.addEventListener("scroll", kick, { passive: true });
    window.addEventListener("resize", onResize);
    frame();
    kick();
    // Fonts and images settle after first paint; re-measure once they have.
    const settle = window.setTimeout(onResize, 700);

    return () => {
      window.removeEventListener("scroll", kick);
      window.removeEventListener("resize", onResize);
      window.clearTimeout(settle);
      stopFloaties();
      if (raf !== null) cancelAnimationFrame(raf);
      engine.current = null;
    };
  }, []);

  /** The features arrows scroll the page, so the pin stays in charge. */
  const stepFeatures = useCallback((direction: -1 | 1) => {
    const el = root.current?.querySelector('[data-scene="features"]');
    if (!el) return;
    const r = el.getBoundingClientRect();
    const top = r.top + window.scrollY;
    const travel = Math.max(1, r.height - window.innerHeight);
    const current = Math.min(1, Math.max(0, (window.scrollY - top) / travel));
    const next = Math.min(1, Math.max(0, current + direction * 0.2));
    window.scrollTo({
      top: top + travel * next,
      behavior: window.matchMedia("(prefers-reduced-motion:reduce)").matches
        ? "auto"
        : "smooth",
    });
  }, []);

  return (
    <div ref={root} className="fk-landing">
      <a className="fk-skip" href="#content">
        Skip to content
      </a>
      <SiteNav />
      <span id="content" tabIndex={-1} />

      {/* The hero has a desktop and a phone telling; CSS shows the one that fits. */}
      <div className="fk-desk">
        <HeroScene />
      </div>
      <MobileLanding part="hero" />

      {/* The same on every screen: one form three ways, then AI, the reason to pick Formkit. */}
      <ProductShot />
      <AiBand />

      <div className="fk-desk">
        <FeaturesScene onStep={stepFeatures} />
      </div>
      <MobileLanding part="features" />

      {/* Companies and the plans. */}
      <MoreScenes />

      <section id="compare" className="fk-lp-compare">
        <h2 className="fk-lp-h2">Three ways to ask a question.</h2>
        <p className="fk-lp-lede">
          Based on what each one gives you for free in {COMPARE_ASOF}. Paid plans differ, and all
          three are good tools.
        </p>
        <div className="fk-lp-compare-table">
          <CompareTable />
        </div>
        <p className="fk-lp-close">
          Pick the tool that fits the job. Pick Formkit when the form is part of how people see
          you.
        </p>
      </section>

      <section id="faq" className="fk-lp-faq">
        <div className="fk-lp-faq-grid">
          <div className="fk-lp-faq-intro">
            <h2 className="fk-lp-h2">Questions people ask</h2>
            <p className="fk-lp-lede">
              The rest is in the help center: {HELP_ARTICLES.length} articles on building forms, AI,
              logic, responses, companies and billing.
            </p>
            <div className="fk-lp-faq-links">
              <Link href="/help" className="fk-pill fk-pill-light">
                Visit the help center
                <ArrowUpRight size={16} strokeWidth={1.8} aria-hidden />
              </Link>
              <Link href="/signup" className="fk-pill fk-pill-dark">
                Start building free
                <ArrowRight size={17} strokeWidth={1.8} aria-hidden />
              </Link>
            </div>
          </div>

          <div className="fk-lp-faq-list">
            {LANDING_FAQS.map((f) => (
              <div key={f.q} className="fk-lp-faq-item">
                <h3>{f.q}</h3>
                <p>{f.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
