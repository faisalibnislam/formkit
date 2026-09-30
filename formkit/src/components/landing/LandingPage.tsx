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
import { ShapeScene } from "./ShapeScene";
import { AnswerScene } from "./AnswerScene";
import { InboxScene } from "./InboxScene";
import { AnalyticsScene } from "./AnalyticsScene";
import { FeaturesScene } from "./FeaturesScene";
import { MobileLanding } from "./MobileLanding";
import { MoreScenes } from "./MoreScenes";
import { createEngine, UNPIN_AT, type Engine } from "./scrollEngine";

/**
 * The marketing home: one continuous scroll story around a single form -
 * ASK → SHAPE → ANSWER → UNDERSTAND → ACT - then ordinary sections on
 * building with AI, forms that think, AI replies, companies and the plans.
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
      // Every scene resolves to its end state; the hero keeps its natural type
      // scale, since applyHero(1) would shrink the headline away.
      e.resolveAll(true);
      return;
    }

    // The floaters run on their own clock, so they keep moving after the
    // scroll loop has parked itself.
    const stopFloaties = e.floaties();

    const eased = { hero: 0, features: 0 };
    let raf: number | null = null;
    let mobileResolved = false;

    const frame = () => {
      raf = null;

      // Below the unpin breakpoint the scenes are ordinary stacked sections;
      // driving their transforms would move content that is no longer pinned.
      if (window.innerWidth <= UNPIN_AT) {
        if (!mobileResolved) {
          mobileResolved = true;
          e.resolveAll(true);
        }
        e.applyCounters();
        return;
      }
      mobileResolved = false;

      const target = { hero: e.progress("hero"), features: e.progress("features") };
      let moving = false;
      for (const key of ["hero", "features"] as const) {
        const delta = target[key] - eased[key];
        if (Math.abs(delta) > 0.0004) {
          eased[key] += delta * 0.16;
          moving = true;
        } else {
          eased[key] = target[key];
        }
      }

      e.applyHero(eased.hero);
      // Shape advances in five discrete steps, so it reads scroll directly.
      e.applyShape(e.progress("shape"));
      e.applyFeatures(eased.features);
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
      <SiteNav current="product" />
      <span id="content" tabIndex={-1} />

      {/* Two tellings of the same story; CSS shows the one that fits. */}
      <div className="fk-desk">
        <HeroScene />
        <ShapeScene />
        <AnswerScene />
        <InboxScene />
        <AnalyticsScene />
        <FeaturesScene onStep={stepFeatures} />
      </div>
      <MobileLanding />

      {/* After the story, the same on every screen: AI, logic, replies, teams, plans. */}
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
