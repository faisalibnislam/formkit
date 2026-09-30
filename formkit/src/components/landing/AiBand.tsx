"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { ArrowRight, Check, Sparkles } from "lucide-react";
import { AiBuildScene } from "@/components/site/scenes/AiBuildScene";
import { LogicScene } from "@/components/site/scenes/LogicScene";
import { StarField } from "./StarField";
import { ReplyScene } from "@/components/site/scenes/ReplyScene";
import { InsightsScene } from "@/components/site/scenes/InsightsScene";

/**
 * AI, the third thing on the page and the reason to pick Formkit: it builds
 * the form, decides where each person goes, and acts on every answer. Each
 * row is a scene people can play with. Rows rise in as they are reached.
 */

const ROWS = [
  {
    id: "ai-build",
    n: "01",
    kicker: "Build with AI",
    title: "Describe it. Formkit builds it.",
    body: "Write what you need in a sentence and Ask Formkit drafts the questions, the pages and the logic, in your wording. Then change anything by asking: “make the budget a range”, “add a thank-you page”.",
    points: [
      "3 AI-built forms a month on Free, 50 a seat on Pro",
      "On Pro, build from a brief, a document or an old form",
      "It drafts, you decide: nothing goes live until you publish",
    ],
    href: "/features/ai-form-builder",
    link: "How AI builds forms",
  },
  {
    id: "ai-think",
    n: "02",
    kicker: "Forms that think",
    title: "Every person gets the form that fits them.",
    body: "Rules read like sentences and the logic map shows every path. On Pro, the AI reads what someone wrote, decides where they go next, and pulls out facts like a budget for later questions and totals.",
    points: [
      "Skip, show and hide on every plan",
      "AI decides: “is this a good fit?” picks the path",
      "Calculations, several endings and quizzes on Pro",
    ],
    href: "/features/logic",
    link: "How logic works",
  },
  {
    id: "ai-act",
    n: "03",
    kicker: "Act on every answer",
    title: "Every response, answered. Every answer, understood.",
    body: "The AI writes each person a reply from your instructions and your own facts, on the thank-you screen or by email. It reads every response for how people feel, what they want and how promising they are, and writes you a report.",
    points: [
      "A personal reply to every response, on Pro",
      "Sentiment, intent, topics and a lead score on each one",
      "Then on to Slack, Sheets, Zapier, Make or your webhook",
    ],
    href: "/features/ai-replies",
    link: "How AI replies work",
  },
] as const;

export function AiBand() {
  const root = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const rows = el.querySelectorAll<HTMLElement>("[data-rise]");
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || !("IntersectionObserver" in window)) {
      rows.forEach((r) => r.setAttribute("data-in", ""));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          e.target.setAttribute("data-in", "");
          io.unobserve(e.target);
        }
      },
      { threshold: 0.18 },
    );
    rows.forEach((r) => io.observe(r));
    return () => io.disconnect();
  }, []);

  return (
    <section ref={root} id="ai" className="fk-aib" aria-labelledby="ai-title">
      <StarField />
      <div className="fk-aib-glow" aria-hidden />
      <div className="fk-aib-glow fk-aib-glow-2" aria-hidden />
      <div className="fk-aib-glow fk-aib-glow-3" aria-hidden />
      <header className="fk-aib-head" data-rise>
        <span className="fk-aib-badge">
          <Sparkles size={14} strokeWidth={2} aria-hidden /> AI in Formkit
        </span>
        <h2 id="ai-title">
          AI that builds the form, <span>runs it, and answers for you.</span>
        </h2>
        <p>
          Writing the form, sorting the people who fill it in, and getting back to each of them. Formkit takes the
          first pass at all three, and you stay in charge of every word.
        </p>
        <nav className="fk-aib-jump" aria-label="AI features">
          {ROWS.map((r) => (
            <a key={r.id} href={`#${r.id}`}>
              <b>{r.n}</b> {r.kicker}
            </a>
          ))}
        </nav>
      </header>

      {ROWS.map((r, i) => (
        <div key={r.id} id={r.id} className="fk-aib-row" data-flip={i % 2 === 1 || undefined} data-rise>
          <div className="fk-aib-copy">
            <span className="fk-aib-n">{r.n}</span>
            <span className="fk-aib-kicker">{r.kicker}</span>
            <h3>{r.title}</h3>
            <p>{r.body}</p>
            <ul>
              {r.points.map((p) => (
                <li key={p}>
                  <Check size={16} strokeWidth={2.4} aria-hidden /> {p}
                </li>
              ))}
            </ul>
            <Link href={r.href} className="fk-aib-link">
              {r.link} <ArrowRight size={15} strokeWidth={2} aria-hidden />
            </Link>
          </div>
          <div className="fk-aib-scene">
            {r.id === "ai-build" && <AiBuildScene />}
            {r.id === "ai-think" && <LogicScene start="ai" />}
            {r.id === "ai-act" && (
              <div className="fk-aib-stack">
                <ReplyScene />
                <div className="fk-aib-mini">
                  <InsightsScene compact />
                </div>
              </div>
            )}
          </div>
        </div>
      ))}

      <p className="fk-aib-foot" data-rise>
        AI runs on Google&rsquo;s Gemini models. Chatting with Ask Formkit about Formkit never counts against your
        allowance. <Link href="/pricing">See what each plan includes</Link>
      </p>
    </section>
  );
}
