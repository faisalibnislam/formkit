"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowRight } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { FOOTER_COLUMNS } from "@/lib/site";

/**
 * The shared public footer. Its closing question is a real field: what you type
 * seeds the first question of a new form, and pushes the wordmark's fill
 * further as you go.
 */
export function SiteFooter() {
  const root = useRef<HTMLElement | null>(null);
  const [fill, setFill] = useState(0);
  const [typed, setTyped] = useState("");
  const [markSize, setMarkSize] = useState(96);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion:reduce)").matches;
    const typedFill = () => Math.min(100, typed.trim().length * 3);

    const paint = () => {
      const el = root.current;
      if (!el) return;
      setMarkSize(Math.round(Math.min(150, Math.max(56, window.innerWidth * 0.1))));
      const r = el.getBoundingClientRect();
      const scrolled = reduced
        ? 1
        : Math.min(
            1,
            Math.max(
              0,
              (window.innerHeight - r.top) /
                Math.max(1, Math.min(r.height, window.innerHeight * 1.4)),
            ),
          );
      setFill(Math.max(typedFill(), Math.round(scrolled * 100)));
    };

    paint();
    window.addEventListener("scroll", paint, { passive: true });
    window.addEventListener("resize", paint);
    return () => {
      window.removeEventListener("scroll", paint);
      window.removeEventListener("resize", paint);
    };
  }, [typed]);

  const startHref = typed.trim()
    ? `/signup?q=${encodeURIComponent(typed.trim())}`
    : "/signup";

  return (
    <footer ref={root} className="fk-foot" data-nav-hide>
      <h2 className="fk-foot-head">What will you ask first?</h2>

      <div className="fk-foot-ask">
        <input
          aria-label="What will you ask first?"
          placeholder="What does success look like?"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
        />
        <Link href={startHref} className="fk-foot-cta" data-typed={typed.trim().length > 0}>
          Build a form
          <span>
            <ArrowRight size={16} strokeWidth={1.8} aria-hidden />
          </span>
        </Link>
      </div>

      <div className="fk-foot-rows">
        {FOOTER_COLUMNS.map((col) => (
          <div key={col.heading} className="fk-foot-row">
            <span className="fk-foot-heading">{col.heading}</span>
            {col.links.map((l) => (
              <Link key={l.href + l.label} href={l.href}>
                {l.label}
              </Link>
            ))}
          </div>
        ))}
      </div>

      <div className="fk-foot-mark">
        <div className="fk-foot-mark-ghost" aria-hidden>
          <Logo size={markSize} tone="current" />
        </div>
        <div
          className="fk-foot-mark-fill"
          aria-label="Formkit"
          role="img"
          style={{ clipPath: `inset(0 ${100 - fill}% 0 0)` }}
        >
          <Logo size={markSize} tone="current" />
        </div>
      </div>

      <div className="fk-foot-bottom">
        <span>© {new Date().getFullYear()} Formkit</span>
        <span>formkit.app</span>
        <Link href="/privacy">Privacy</Link>
        <Link href="/terms">Terms</Link>
        <Link href="/dpa">DPA</Link>
      </div>
    </footer>
  );
}
