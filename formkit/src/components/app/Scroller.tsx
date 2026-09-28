"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

/**
 * A row that scrolls sideways, with arrows at whichever end has more to see.
 * The tabs under the header outgrow the window on all but wide screens; the
 * arrows say so, and a click moves most of a screen along. The open tab is
 * brought into view on arrival.
 */
export function Scroller({
  className,
  shellClassName,
  children,
}: {
  className: string;
  shellClassName?: string;
  children: ReactNode;
}) {
  const row = useRef<HTMLDivElement | null>(null);
  const [ends, setEnds] = useState({ left: false, right: false });

  const measure = useCallback(() => {
    const el = row.current;
    if (!el) return;
    const left = el.scrollLeft > 4;
    const right = el.scrollLeft + el.clientWidth < el.scrollWidth - 4;
    setEnds((e) => (e.left === left && e.right === right ? e : { left, right }));
  }, []);

  useEffect(() => {
    const el = row.current;
    if (!el) return;
    // The open tab, in view.
    const active = el.querySelector<HTMLElement>("[aria-current='page'], [aria-selected='true'], [data-active='true']");
    if (active) {
      const a = active.getBoundingClientRect();
      const r = el.getBoundingClientRect();
      if (a.right > r.right || a.left < r.left) el.scrollLeft += a.left - r.left - (r.width - a.width) / 2;
    }
    measure();
    el.addEventListener("scroll", measure, { passive: true });
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", measure);
      ro.disconnect();
    };
  }, [measure]);

  const nudge = (dir: -1 | 1) => {
    const el = row.current;
    if (el) el.scrollBy({ left: dir * el.clientWidth * 0.7, behavior: "smooth" });
  };

  return (
    <div className={`fk-scroller ${shellClassName ?? ""}`}>
      <div ref={row} className={className}>
        {children}
      </div>
      {ends.left && (
        <button type="button" className="fk-scroller-arrow" data-side="left" aria-label="Scroll left" onClick={() => nudge(-1)}>
          <ChevronLeft size={18} strokeWidth={2} aria-hidden />
        </button>
      )}
      {ends.right && (
        <button type="button" className="fk-scroller-arrow" data-side="right" aria-label="Scroll right" onClick={() => nudge(1)}>
          <ChevronRight size={18} strokeWidth={2} aria-hidden />
        </button>
      )}
    </div>
  );
}
