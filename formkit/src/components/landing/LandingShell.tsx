"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { floaties } from "./scrollEngine";

/**
 * The landing page's outer element and the motion that spans the whole page.
 * The page itself is a server component; this is the only part of the frame
 * that needs the browser.
 */
export function LandingShell({ children }: { children: ReactNode }) {
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
      {children}
    </div>
  );
}
