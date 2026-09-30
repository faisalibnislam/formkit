"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  Eye,
  ListChecks,
  Palette,
  Send,
  Sparkles,
  Star,
  TrendingDown,
} from "lucide-react";
import { THEME_PRESETS } from "../../../convex/model/themePresets";
import { useInView, useReducedMotion, useStep } from "@/components/site/scenes/shared";

/**
 * The second thing on the landing page: a form being made, drawn as layers
 * in space. A prompt types itself, the form fills in, the theme and font
 * change, and a response lands. The pieces lean with the pointer, and the
 * theme and font chips can be clicked. Three plain promises sit underneath.
 */

const PROMPT = "A feedback form for my gym, after someone's first class";
const THEMES = ["sky", "mint", "blush", "midnight"] as const;
const FONTS = { sans: "var(--font-sans)", serif: 'Georgia, "Times New Roman", serif' } as const;

const PROMISES = [
  {
    icon: ListChecks,
    title: "Forms people finish",
    body: "One question at a time or the whole page, a progress bar people can see, and logic that skips what doesn't apply to them.",
  },
  {
    icon: TrendingDown,
    title: "Answers with the whole story",
    body: "Partial answers are kept and drop-off is shown question by question, on every plan, so you know where a form loses people.",
  },
  {
    icon: Palette,
    title: "Your brand on every screen",
    body: "Themes, fonts and your logo, sent from formkit.app/your-name. Your own domain, without the Formkit badge, is on Pro.",
  },
];

export function FormStage() {
  const stage = useRef<HTMLDivElement | null>(null);
  const seen = useInView(stage, 0.3);
  const still = useReducedMotion();
  const [typed, setTyped] = useState(0);
  const [beat, setBeat] = useState(0);
  const [theme, setTheme] = useState<(typeof THEMES)[number]>("sky");
  const [font, setFont] = useState<keyof typeof FONTS>("sans");
  const [held, setHeld] = useState(false);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });

  const done = still || typed >= PROMPT.length;
  const shownTyped = still ? PROMPT.length : typed;
  const shownBeat = still ? 3 : beat;

  // The prompt types itself once it is on screen.
  useStep(seen && !done, 38, () => setTyped((n) => n + 1), [typed]);
  // Then the form builds, the response arrives, and the look changes now and then.
  useStep(seen && done && !still, beat < 3 ? 900 : 3200, () => {
    if (beat < 3) {
      setBeat(beat + 1);
      return;
    }
    if (held) return;
    const next = THEMES[(THEMES.indexOf(theme) + 1) % THEMES.length]!;
    setTheme(next);
    if (next === "blush") setFont(font === "sans" ? "serif" : "sans");
  }, [beat, theme, held]);

  // The layers lean toward the pointer while it is over the stage.
  useEffect(() => {
    const el = stage.current;
    if (!el || still) return;
    let raf = 0;
    const move = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5;
      const y = (e.clientY - r.top) / r.height - 0.5;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => setTilt({ x, y }));
    };
    const leave = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => setTilt({ x: 0, y: 0 }));
    };
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerleave", leave);
    return () => {
      cancelAnimationFrame(raf);
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerleave", leave);
    };
  }, [still]);

  const t = THEME_PRESETS.find((x) => x.id === theme)!;
  const dark = t.text === "#ffffff";

  return (
    <section id="product" className="fk-fs" aria-labelledby="fs-title">
      <div className="fk-fs-top">
        <div className="fk-fs-copy">
          <span className="fk-more-kicker">Forms, beautifully simple</span>
          <h2 id="fs-title" className="fk-lp-h2">
            Build it from one sentence. Make it yours in a click.
          </h2>
          <p className="fk-lp-lede">
            Describe what you need and Ask Formkit writes the questions. Pick a theme, a
            font and your logo, and it goes out under your own link, looking like the rest
            of your brand.
          </p>
          <div className="fk-fs-ctas">
            <Link href="/signup" className="fk-pill fk-pill-dark fk-pill-lg">
              Start building free <ArrowRight size={17} strokeWidth={1.8} aria-hidden />
            </Link>
            <Link href="/templates" className="fk-pill fk-pill-light fk-pill-lg">
              Browse templates <ArrowUpRight size={16} strokeWidth={1.8} aria-hidden />
            </Link>
          </div>
        </div>

        <div
          ref={stage}
          className="fk-fs-stage"
          style={{
            ["--tx" as string]: tilt.x.toFixed(3),
            ["--ty" as string]: tilt.y.toFixed(3),
          }}
          role="img"
          aria-label="A feedback form being drafted from a sentence, themed, and answered"
        >
          <span className="fk-fs-glow" aria-hidden />
          <div className="fk-fs-world">
            {/* The form itself, the deepest layer. */}
            <div
              className="fk-fs-form"
              data-dark={dark || undefined}
              style={{
                ["--f-bg" as string]: t.bg,
                ["--f-surface" as string]: t.surface,
                ["--f-text" as string]: t.text,
                ["--f-primary" as string]: t.primary,
                ["--f-on" as string]: dark ? "#21282E" : "#ffffff",
                fontFamily: FONTS[font],
              }}
            >
              <span className="fk-fs-url">formkit.app/northstar-gym/first-class</span>
              <div className="fk-fs-card">
                <span className="fk-fs-brand">
                  <i>N</i> Northstar Gym
                </span>
                <div className="fk-fs-q" data-on={shownBeat >= 1 || undefined}>
                  <b>How was your first class?</b>
                  <span className="fk-fs-stars">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <Star key={n} size={18} strokeWidth={1.8} data-on={shownBeat >= 3 || undefined} />
                    ))}
                  </span>
                </div>
                <div className="fk-fs-q" data-on={shownBeat >= 2 || undefined}>
                  <b>What would bring you back?</b>
                  <span className="fk-fs-opts">
                    <span data-on={shownBeat >= 3 || undefined}>
                      <Check size={11} strokeWidth={3} aria-hidden /> Evening classes
                    </span>
                    <span>A friend to train with</span>
                  </span>
                </div>
                <span className="fk-fs-progress">
                  <i style={{ width: `${Math.min(3, shownBeat) * 33}%` }} />
                </span>
                <span className="fk-fs-btn">
                  Continue <ArrowRight size={12} strokeWidth={2.2} aria-hidden />
                </span>
              </div>
            </div>

            {/* The prompt that made it. */}
            <div className="fk-fs-layer fk-fs-prompt" data-depth="3">
              <span className="fk-fs-prompt-ic">
                <Sparkles size={14} strokeWidth={2} aria-hidden />
              </span>
              <span>
                {PROMPT.slice(0, shownTyped)}
                {!done && <i className="fk-fs-caret" />}
              </span>
              <span className="fk-fs-send" data-on={done || undefined}>
                <Send size={12} strokeWidth={2.2} aria-hidden />
              </span>
            </div>

            {/* The look, which anyone can change. */}
            <div className="fk-fs-layer fk-fs-font" data-depth="2">
              <button
                type="button"
                onClick={() => {
                  setHeld(true);
                  setFont(font === "sans" ? "serif" : "sans");
                }}
                aria-label={`Font: ${font === "sans" ? "Sans" : "Serif"}. Switch font`}
                style={{ fontFamily: FONTS[font] }}
              >
                Aa
              </button>
              <small>{font === "sans" ? "Sans" : "Serif"}</small>
            </div>
            <div className="fk-fs-layer fk-fs-themes" data-depth="2" role="radiogroup" aria-label="Theme">
              {THEMES.map((id) => {
                const p = THEME_PRESETS.find((x) => x.id === id)!;
                return (
                  <button
                    key={id}
                    type="button"
                    role="radio"
                    aria-checked={id === theme}
                    aria-label={p.name}
                    title={p.name}
                    onClick={() => {
                      setHeld(true);
                      setTheme(id);
                    }}
                    style={{ background: `linear-gradient(135deg, ${p.bg} 0 50%, ${p.primary} 50% 100%)` }}
                  />
                );
              })}
            </div>

            {/* What comes back. */}
            <div className="fk-fs-layer fk-fs-toast" data-depth="4" data-on={shownBeat >= 3 || undefined}>
              <span className="fk-fs-av">LK</span>
              <span>
                <b>New response</b>
                <small>Leila K. · 5 stars · Evening classes</small>
              </span>
            </div>
            <div className="fk-fs-layer fk-fs-views" data-depth="1" data-on={shownBeat >= 2 || undefined}>
              <Eye size={13} strokeWidth={2} aria-hidden /> <b>24</b> responses this week
            </div>
          </div>
        </div>
      </div>

      <ul className="fk-fs-promises">
        {PROMISES.map((p) => (
          <li key={p.title}>
            <span className="fk-fs-pic">
              <p.icon size={18} strokeWidth={2} aria-hidden />
            </span>
            <span>
              <b>{p.title}</b>
              <span>{p.body}</span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
