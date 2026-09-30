"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { ArrowRight, Check } from "lucide-react";
import { Glyph } from "@/components/brand/Glyph";
import { TRUST_POINTS } from "@/content/landing";
import { PLANS } from "../../../convex/model/plans";
import { StarField } from "./StarField";

/**
 * After the AI band, in ordinary sections that read the same on a phone and a
 * desktop: the plans.
 *
 * Each section fades its demo in once, when it scrolls into view; with
 * reduced motion everything is simply there.
 */
export function MoreScenes() {
  const root = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const targets = el.querySelectorAll<HTMLElement>("[data-reveal]");
    if (window.matchMedia("(prefers-reduced-motion:reduce)").matches || !("IntersectionObserver" in window)) {
      targets.forEach((t) => t.setAttribute("data-in", "true"));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.setAttribute("data-in", "true");
            io.unobserve(e.target);
          }
        }
      },
      { threshold: 0.25 },
    );
    targets.forEach((t) => io.observe(t));
    return () => io.disconnect();
  }, []);

  return (
    <div ref={root}>
      <Plans />
    </div>
  );
}

function Kicker({ children, tone }: { children: string; tone?: "inverse" }) {
  return (
    <span className="fk-more-kicker" data-tone={tone}>
      {children}
    </span>
  );
}

/** The plans in brief, and the reasons to trust Formkit with answers. */
function Plans() {
  const cards = [
    {
      id: "free" as const,
      price: "$0",
      per: "forever",
      points: ["Unlimited forms, responses and members", "Logic, themes, partial responses and drop-off", "AI builds 3 forms a month"],
    },
    {
      id: "pro" as const,
      price: `$${PLANS.pro.price.month}`,
      per: "a seat a month",
      points: ["AI replies, AI logic and insights", "Your domain, payments and connections", "Quizzes, calculations and several endings"],
    },
    {
      id: "business" as const,
      price: `$${PLANS.business.price.month}`,
      per: "a seat a month",
      points: ["Bigger AI allowances on every seat", "Approvals, audit log and retention", "API access and company sign-in"],
    },
  ];
  return (
    <section id="plans" className="fk-more fk-more-plans">
      <StarField />
      <div className="fk-aib-glow" aria-hidden />
      <div className="fk-aib-glow fk-aib-glow-3" aria-hidden />
      <div className="fk-more-head" style={{ textAlign: "center", marginInline: "auto" }}>
        <Kicker tone="inverse">Pricing</Kicker>
        <h2 className="fk-lp-h2" style={{ marginInline: "auto" }}>
          Free to start. Simple when you grow.
        </h2>
        <p className="fk-lp-lede" style={{ marginInline: "auto" }}>
          Plans belong to a company and are paid per seat. Yearly is two months free.
        </p>
      </div>
      <div className="fk-plan-teaser">
        {cards.map((c) => (
          <div key={c.id} className="fk-plan-teaser-card" data-plan={c.id}>
            <b>{PLANS[c.id].name}</b>
            <span className="fk-plan-teaser-price">
              {c.price} <em>{c.per}</em>
            </span>
            <ul>
              {c.points.map((p) => (
                <li key={p}>
                  <Check size={15} strokeWidth={2.2} aria-hidden /> {p}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="fk-plan-teaser-cta">
        <Link href="/pricing" className="fk-pill fk-pill-light">
          See every plan <ArrowRight size={17} strokeWidth={1.8} aria-hidden />
        </Link>
      </div>

      <div className="fk-trust">
        {TRUST_POINTS.map((t) => (
          <div key={t.title} className="fk-trust-item">
            <span className="fk-trust-icon">
              <Glyph name={t.icon} size={18} />
            </span>
            <b>{t.title}</b>
            <p>{t.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
