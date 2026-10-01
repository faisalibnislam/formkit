"use client";

import Link from "next/link";
import { Suspense, useEffect, useRef } from "react";
import { ArrowRight, ArrowUpRight, Plus } from "lucide-react";
import { SiteNav } from "@/components/site/SiteNav";
import { SiteFooter } from "@/components/site/SiteFooter";
import { CompareTable } from "@/components/site/CompareTable";
import { COMPARE_ASOF } from "@/content/compare";
import { HELP_ARTICLES } from "@/content/help";
import { LANDING_FAQS } from "@/content/landing";
import { HeroScene } from "./HeroScene";
import { LogicSection } from "./LogicSection";
import { AnalyticsSection } from "./AnalyticsSection";
import { LandingFeatures } from "./LandingFeatures";
import { MobileLanding } from "./MobileLanding";
import { MoreScenes } from "./MoreScenes";
import { AiBand } from "./AiBand";
import { floaties } from "./scrollEngine";

/**
 * The marketing home: the headline in the night sky with form pieces that lean
 * with the pointer, then AI takes the stage
 * (building, deciding, answering), logic, every feature playing, analytics
 * and the plans.
 */
export function LandingPage() {
  const root = useRef<HTMLDivElement | null>(null);

  // The floating pieces around the headline lean with the pointer, on their
  // own clock. With reduced motion they simply stay where they are.
  useEffect(() => {
    const el = root.current;
    if (!el || window.matchMedia("(prefers-reduced-motion:reduce)").matches) return;
    return floaties(el);
  }, []);

  // The hero skies twinkle in CSS; pause them once they are off screen.
  useEffect(() => {
    const skies = root.current?.querySelectorAll<HTMLElement>(".fk-sky");
    if (!skies?.length) return;
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) e.target.toggleAttribute("data-still", !e.isIntersecting);
    });
    skies.forEach((s) => io.observe(s));
    return () => io.disconnect();
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
      <MobileLanding />

      {/* The same on every screen: AI first, the reason to pick Formkit.
          Each section below the hero is its own Suspense boundary, so React
          hydrates them one at a time in short tasks rather than the whole
          page in one long one; the HTML is all there from the server. */}
      <Suspense fallback={null}>
        <AiBand />
      </Suspense>
      <Suspense fallback={null}>
        <LogicSection />
      </Suspense>
      <Suspense fallback={null}>
        <LandingFeatures />
      </Suspense>
      <Suspense fallback={null}>
        <AnalyticsSection />
      </Suspense>

      {/* The plans. */}
      <Suspense fallback={null}>
        <MoreScenes />
      </Suspense>

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
            {LANDING_FAQS.map((f, i) => (
              <details key={f.q} className="fk-lp-faq-item" open={i === 0}>
                <summary>
                  <h3>{f.q}</h3>
                  <Plus size={18} strokeWidth={2} aria-hidden />
                </summary>
                <p>{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
