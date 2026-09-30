"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, Check, Sparkles } from "lucide-react";
import { AiBuildScene } from "@/components/site/scenes/AiBuildScene";
import { LogicScene } from "@/components/site/scenes/LogicScene";
import { StarField } from "./StarField";
import { ActScene } from "./ActScene";

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

/** Wide enough, and tall enough, to pin the three and slide between them. */
const PIN_QUERY = "(min-width: 961px) and (min-height: 640px)";

export function AiBand() {
  const root = useRef<HTMLElement | null>(null);
  const rail = useRef<HTMLDivElement | null>(null);
  const [slide, setSlide] = useState(0);
  const [pinned, setPinned] = useState(false);

  // Which of the three is showing: the rail's scroll is cut into three equal
  // stretches, and each holds its feature until the next begins.
  useEffect(() => {
    const el = rail.current;
    if (!el) return;
    const wide = window.matchMedia(PIN_QUERY);
    let raf = 0;
    const read = () => {
      raf = 0;
      const on = wide.matches;
      setPinned(on);
      if (!on) return;
      const r = el.getBoundingClientRect();
      const travel = Math.max(1, r.height - window.innerHeight);
      const p = Math.min(0.9999, Math.max(0, -r.top / travel));
      setSlide(Math.floor(p * ROWS.length));
    };
    const kick = () => {
      if (!raf) raf = requestAnimationFrame(read);
    };
    kick();
    window.addEventListener("scroll", kick, { passive: true });
    window.addEventListener("resize", kick);
    wide.addEventListener("change", kick);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", kick);
      window.removeEventListener("resize", kick);
      wide.removeEventListener("change", kick);
    };
  }, []);

  /** Scroll the page to where feature `i` is showing. */
  const go = (i: number) => {
    const el = rail.current;
    if (!el) return;
    const top = el.getBoundingClientRect().top + window.scrollY;
    const travel = Math.max(1, el.offsetHeight - window.innerHeight);
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: top + ((i + 0.2) / ROWS.length) * travel, behavior: reduced ? "auto" : "smooth" });
  };

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
          {ROWS.map((r, i) => (
            <a
              key={r.id}
              href={`#${r.id}`}
              onClick={(e) => {
                if (!pinned) return;
                e.preventDefault();
                go(i);
              }}
            >
              <b>{r.n}</b> {r.kicker}
            </a>
          ))}
        </nav>
      </header>

      {/* On a desktop the three stay pinned and slide sideways, one per stretch of scroll. */}
      <div ref={rail} className="fk-aib-rail">
        <div className="fk-aib-pin">
          <div className="fk-aib-stage" data-rise>
            <div className="fk-aib-track" style={{ ["--slide" as string]: slide }}>
              {ROWS.map((r, i) => (
                <div key={r.id} className="fk-aib-slide" aria-hidden={pinned && i !== slide ? true : undefined}>
                  <div id={r.id} className="fk-aib-row" data-flip={i % 2 === 1 || undefined}>
                    <div className="fk-aib-copy">
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
                      <Link href={r.href} className="fk-aib-link" tabIndex={pinned && i !== slide ? -1 : undefined}>
                        {r.link} <ArrowRight size={15} strokeWidth={2} aria-hidden />
                      </Link>
                    </div>
                    <div className="fk-aib-scene">
                      {r.id === "ai-build" && <AiBuildScene />}
                      {r.id === "ai-think" && <LogicScene start="ai" />}
                      {r.id === "ai-act" && <ActScene />}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="fk-aib-steps" aria-label="AI features">
              {ROWS.map((r, i) => (
                <button
                  key={r.id}
                  type="button"
                  aria-current={i === slide || undefined}
                  onClick={() => go(i)}
                >
                  <i aria-hidden />
                  <b>{r.n}</b> {r.kicker}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <p className="fk-aib-foot" data-rise>
        AI runs on Google&rsquo;s Gemini models. Chatting with Ask Formkit about Formkit never counts against your
        allowance. <Link href="/pricing">See what each plan includes</Link>
      </p>
    </section>
  );
}
