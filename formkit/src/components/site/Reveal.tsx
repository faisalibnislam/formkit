"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * Children marked `data-rise` rise into place the first time they scroll
 * into view. With reduced motion, or no IntersectionObserver, they are
 * simply there.
 */
export function Reveal({ children, className }: { children: ReactNode; className?: string }) {
  const root = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const items = el.querySelectorAll<HTMLElement>("[data-rise]");
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || !("IntersectionObserver" in window)) {
      items.forEach((i) => i.setAttribute("data-in", ""));
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
      { threshold: 0.12 },
    );
    items.forEach((i) => io.observe(i));
    return () => io.disconnect();
  }, []);
  return (
    <div ref={root} className={["fk-reveal", className].filter(Boolean).join(" ")}>
      {children}
    </div>
  );
}
