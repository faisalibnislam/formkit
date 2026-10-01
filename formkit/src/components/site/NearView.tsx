"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Mounts its children only once their spot comes near the viewport.
 *
 * The page's animated demos are decoration (each is aria-hidden or repeats
 * what the copy says), and there are a lot of them. Rendering one only when
 * someone scrolls towards it keeps them out of the server HTML and out of
 * hydration, which is most of the work a phone does when the page loads.
 * Until then a placeholder of `minHeight` holds the space so nothing shifts.
 */
export function NearView({
  children,
  minHeight = 0,
  margin = "800px 100%",
}: {
  children: ReactNode;
  minHeight?: number | string;
  /** How far outside the viewport to start; the second value covers slides off to the side. */
  margin?: string;
}) {
  const spot = useRef<HTMLSpanElement | null>(null);
  const [near, setNear] = useState(false);

  useEffect(() => {
    const el = spot.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      const t = setTimeout(() => setNear(true), 0);
      return () => clearTimeout(t);
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setNear(true);
          io.disconnect();
        }
      },
      { rootMargin: margin },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [margin]);

  if (near) return <>{children}</>;
  return <span ref={spot} className="fk-near" style={{ display: "block", minHeight }} aria-hidden />;
}
