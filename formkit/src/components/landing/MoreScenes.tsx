"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { ArrowRight, Check, Sparkles } from "lucide-react";
import { Glyph } from "@/components/brand/Glyph";
import { AI_BRIEF, AI_BUILT, REPLY_DEMO, TRUST_POINTS } from "@/content/landing";
import { PLANS } from "../../../convex/model/plans";

/**
 * What Formkit does beyond the scroll story, in ordinary sections that read
 * the same on a phone and a desktop: building with AI, forms that think,
 * answering every response, companies, the plans, and why to trust it.
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
      <AiBuild />
      <Think />
      <Answer />
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

/** A brief goes in; a form comes out. */
function AiBuild() {
  return (
    <section id="ai" className="fk-more fk-more-ai">
      <div className="fk-more-grid">
        <div className="fk-more-copy">
          <Kicker>Build with AI</Kicker>
          <h2 className="fk-lp-h2">Describe it. Formkit builds it.</h2>
          <p className="fk-lp-lede">
            Write what you need in a sentence and Ask Formkit drafts the questions, the pages and the logic, in your
            wording. On Pro, paste a brief or upload a document instead. Then change anything by asking: “make the budget
            question a range”, “add a thank-you page”.
          </p>
          <ul className="fk-more-points">
            <li>
              <Check size={16} strokeWidth={2.2} aria-hidden /> 3 AI-built forms a month on Free, 50 a seat on Pro
            </li>
            <li>
              <Check size={16} strokeWidth={2.2} aria-hidden /> It drafts, you decide: everything lands as an ordinary
              draft
            </li>
            <li>
              <Check size={16} strokeWidth={2.2} aria-hidden /> Talking to it about Formkit never counts
            </li>
          </ul>
        </div>

        <div className="fk-more-demo fk-aidemo" data-reveal aria-hidden>
          <div className="fk-aidemo-brief">
            <span className="fk-aidemo-who">
              <Sparkles size={15} strokeWidth={2} /> Ask Formkit
            </span>
            <p>{AI_BRIEF}</p>
          </div>
          <div className="fk-aidemo-form">
            <div className="fk-aidemo-formhead">
              <b>Studio intake</b>
              <span>{AI_BUILT.length} questions · 2 pages · 1 rule</span>
            </div>
            {AI_BUILT.map((q, i) => (
              <div key={q.q} className="fk-aidemo-q" style={{ ["--i" as string]: i }}>
                <span className="fk-aidemo-n">{i + 1}</span>
                <span className="fk-aidemo-text">
                  {q.q}
                  {q.logic && <em>{q.logic}</em>}
                </span>
                <span className="fk-aidemo-type">{q.type}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/** Logic three ways: rules, the AI deciding, and scoring. */
function Think() {
  return (
    <section id="logic" className="fk-more fk-more-think">
      <div className="fk-more-head">
        <Kicker>Forms that think</Kicker>
        <h2 className="fk-lp-h2">Every person gets the form that fits them.</h2>
        <p className="fk-lp-lede">
          Rules in plain words on every plan. On Pro, the AI can read what someone wrote and decide where they go,
          and answers can add up into a price, a score or a pass mark.
        </p>
      </div>
      <div className="fk-think-cards" data-reveal>
        <article className="fk-think-card">
          <div className="fk-think-art" aria-hidden>
            <span className="fk-rule">
              <b>If</b> Budget <b>is under</b> $5,000
            </span>
            <span className="fk-rule" data-then="true">
              <b>Skip to</b> Contact details
            </span>
          </div>
          <h3>Logic in plain words</h3>
          <p>Skip, show and hide with rules that read like sentences. See every path on the logic map, and test one before you publish.</p>
          <span className="fk-think-plan">Every plan</span>
        </article>
        <article className="fk-think-card">
          <div className="fk-think-art" aria-hidden>
            <span className="fk-ai-q">“We are a team of 40 and want to launch in spring.”</span>
            <span className="fk-ai-a">
              <Sparkles size={13} strokeWidth={2} /> Good fit · company size 40 → Book a call
            </span>
          </div>
          <h3>AI logic</h3>
          <p>Describe the decision, “is this a good fit?”, and the AI reads the answer and picks the path, or pulls out the facts you need.</p>
          <span className="fk-think-plan" data-plan="pro">
            Pro
          </span>
        </article>
        <article className="fk-think-card">
          <div className="fk-think-art" aria-hidden>
            <span className="fk-score">
              <b>8</b>/10
            </span>
            <span className="fk-score-meta">
              <span className="fk-score-pass">Pass</span>
              <span>12:40 left</span>
            </span>
          </div>
          <h3>Calculations and quizzes</h3>
          <p>Add answers up into a quote or a score. Quizzes add right answers, a timer, marking by hand and results released when you are ready.</p>
          <span className="fk-think-plan" data-plan="pro">
            Pro
          </span>
        </article>
      </div>
    </section>
  );
}

/** A response comes in; a reply goes out; the numbers follow. */
function Answer() {
  return (
    <section id="replies" className="fk-more fk-more-answer">
      <div className="fk-more-grid">
        <div className="fk-more-copy">
          <Kicker tone="inverse">Act on every answer</Kicker>
          <h2 className="fk-lp-h2">Every response, answered.</h2>
          <p className="fk-lp-lede">
            The AI writes each person a reply from your instructions and your own facts, and sends it on the
            thank-you screen, by email or both. It also reads every response for how the person feels, what they
            want and how promising they are, and writes you a report.
          </p>
          <div className="fk-more-chips" aria-label="Connections">
            {["Slack", "Google Sheets", "Zapier", "Make", "Webhooks", "Stripe payments"].map((c) => (
              <span key={c}>{c}</span>
            ))}
          </div>
          <p className="fk-more-note">AI replies, insights, payments and connections are part of Pro.</p>
        </div>

        <div className="fk-more-demo fk-replydemo" data-reveal aria-hidden>
          <div className="fk-replydemo-resp">
            <span className="fk-replydemo-label">New response · {REPLY_DEMO.from}</span>
            {REPLY_DEMO.answers.map(([q, a]) => (
              <div key={q} className="fk-replydemo-row">
                <span>{q}</span>
                <b>{a}</b>
              </div>
            ))}
            <div className="fk-replydemo-insights">
              {REPLY_DEMO.insights.map(([k, v]) => (
                <span key={k}>
                  {k} <b>{v}</b>
                </span>
              ))}
            </div>
          </div>
          <div className="fk-replydemo-mail">
            <span className="fk-replydemo-label">
              <Sparkles size={13} strokeWidth={2} /> Reply sent by email
            </span>
            <p>{REPLY_DEMO.reply}</p>
          </div>
        </div>
      </div>
    </section>
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
