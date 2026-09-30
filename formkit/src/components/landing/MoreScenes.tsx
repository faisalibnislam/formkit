"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { ArrowRight, Check } from "lucide-react";
import { Glyph } from "@/components/brand/Glyph";
import { TRUST_POINTS } from "@/content/landing";
import { PLANS } from "../../../convex/model/plans";

/**
 * After the AI band, in ordinary sections that read the same on a phone and a
 * desktop: companies, the plans, and why to trust Formkit with answers.
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
      <Teams />
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

/** Companies: a workspace per business, with members and a plan each. */
function Teams() {
  const companies = [
    ["Maya Ortiz", "Personal", "Free", "MO"],
    ["Studio Nine", "4 members", "Pro", "SN"],
    ["Northstar Labs", "12 members", "Business", "NL"],
  ];
  return (
    <section id="teams" className="fk-more fk-more-teams">
      <div className="fk-more-grid">
        <div className="fk-more-demo fk-teamdemo" data-reveal aria-hidden>
          <span className="fk-replydemo-label">Your companies</span>
          {companies.map(([name, meta, plan, mark]) => (
            <div key={name} className="fk-teamdemo-row">
              <span className="fk-teamdemo-mark">{mark}</span>
              <span className="fk-teamdemo-name">
                {name}
                <em>{meta}</em>
              </span>
              <span className="fk-teamdemo-plan" data-plan={plan.toLowerCase()}>
                {plan}
              </span>
            </div>
          ))}
          <span className="fk-teamdemo-add">+ Create a company</span>
        </div>
        <div className="fk-more-copy">
          <Kicker>Companies and teams</Kicker>
          <h2 className="fk-lp-h2">A workspace for every business you run.</h2>
          <p className="fk-lp-lede">
            Everyone starts with a personal company, and can make as many more as they like: one for the studio, one
            for each client. Each has its own forms, brand, members and plan, and you switch between them from the
            top bar.
          </p>
          <ul className="fk-more-points">
            <li>
              <Check size={16} strokeWidth={2.2} aria-hidden /> Members work on every form, as Admin, Editor or Viewer
            </li>
            <li>
              <Check size={16} strokeWidth={2.2} aria-hidden /> Free on Free, unlimited. On paid plans each member is a
              seat
            </li>
            <li>
              <Check size={16} strokeWidth={2.2} aria-hidden /> Guests invited to one form are always free
            </li>
          </ul>
        </div>
      </div>
    </section>
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
      <div className="fk-more-head" style={{ textAlign: "center", marginInline: "auto" }}>
        <Kicker>Pricing</Kicker>
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
        <Link href="/pricing" className="fk-pill fk-pill-dark">
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
