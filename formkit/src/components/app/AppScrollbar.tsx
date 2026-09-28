"use client";

import { useEffect, useRef } from "react";

/**
 * The app's own page scrollbar: a thin thumb on the right edge, pale at rest,
 * darker while the page moves or is dragged, with no track to fill the sky
 * band's edge. The browser's bar is hidden only while this one is mounted, and
 * only for a mouse - touch screens keep their own overlay bar, which already
 * behaves this way.
 *
 * Everything is written straight to the element on scroll; nothing re-renders.
 */
const PAD = 8;
const MIN = 44;

export function AppScrollbar() {
  const thumb = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = thumb.current;
    if (!el || !window.matchMedia("(pointer: fine)").matches) return;
    const root = document.documentElement;
    root.classList.add("fk-own-bar");

    let idle: number | undefined;
    let drag: { startY: number; startScroll: number; range: number; span: number } | null = null;

    const measure = () => {
      const vh = window.innerHeight;
      const sh = Math.max(root.scrollHeight, document.body.scrollHeight);
      const track = vh - PAD * 2;
      const h = Math.max(MIN, Math.round((vh / Math.max(sh, 1)) * track));
      const max = Math.max(1, sh - vh);
      return { vh, sh, h, max, range: Math.max(0, track - h) };
    };

    const paint = (activate: boolean) => {
      const m = measure();
      const visible = m.sh - m.vh > 12;
      el.style.display = visible ? "block" : "none";
      if (!visible) return;
      el.style.height = `${m.h}px`;
      el.style.transform = `translateY(${PAD + Math.round((Math.min(window.scrollY, m.max) / m.max) * m.range)}px)`;
      if (!activate) return;
      el.dataset.active = "true";
      window.clearTimeout(idle);
      idle = window.setTimeout(() => {
        if (!drag) delete el.dataset.active;
      }, 1100);
    };

    const onScroll = () => paint(true);
    const onResize = () => paint(false);
    const onMove = (e: PointerEvent) => {
      if (!drag || drag.range <= 0) return;
      const next = drag.startScroll + ((e.clientY - drag.startY) / drag.range) * drag.span;
      window.scrollTo(0, Math.max(0, Math.min(drag.span, next)));
    };
    const onUp = () => {
      drag = null;
      document.body.style.userSelect = "";
      delete el.dataset.dragging;
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      paint(true);
    };
    const onDown = (e: PointerEvent) => {
      const m = measure();
      drag = { startY: e.clientY, startScroll: window.scrollY, range: m.range, span: m.max };
      document.body.style.userSelect = "none";
      el.dataset.dragging = "true";
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      e.preventDefault();
    };

    // The page grows and shrinks as data arrives; follow it.
    const grow = new ResizeObserver(() => paint(false));
    grow.observe(document.body);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize);
    el.addEventListener("pointerdown", onDown);
    paint(false);

    return () => {
      root.classList.remove("fk-own-bar");
      grow.disconnect();
      window.clearTimeout(idle);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
      el.removeEventListener("pointerdown", onDown);
      onUp();
    };
  }, []);

  return <div ref={thumb} className="fk-bar-thumb" aria-hidden style={{ display: "none" }} />;
}
