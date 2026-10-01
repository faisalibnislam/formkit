"use client";

import { useEffect, useRef } from "react";

/**
 * A night sky for a dark section: small stars that twinkle at their own pace,
 * a few brighter ones with a soft halo, and now and then one that falls. It
 * fills its positioned parent, draws only while on screen, and holds still
 * for anyone who asked for less motion.
 *
 * Kept cheap because the sections it fills are tall: it redraws only the
 * slice of the sky that is in the viewport, at 30 frames a second, and the
 * halo is drawn once into a small sprite rather than built as a gradient for
 * every star on every frame.
 */

type Star = { x: number; y: number; r: number; base: number; speed: number; phase: number; halo: boolean };
type Fall = { x: number; y: number; vx: number; vy: number; life: number };

const FRAME_MS = 1000 / 30;
const HALO = 64;

/** A soft round glow, drawn once and stamped wherever a bright star sits. */
function haloSprite() {
  const s = document.createElement("canvas");
  s.width = s.height = HALO;
  const g = s.getContext("2d");
  if (!g) return null;
  const grad = g.createRadialGradient(HALO / 2, HALO / 2, 0, HALO / 2, HALO / 2, HALO / 2);
  grad.addColorStop(0, "rgba(190, 220, 255, 0.35)");
  grad.addColorStop(1, "rgba(190, 220, 255, 0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, HALO, HALO);
  return s;
}

export function StarField({ density = 1 }: { density?: number }) {
  const canvas = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const c = canvas.current;
    const parent = c?.parentElement;
    const ctx = c?.getContext("2d");
    if (!c || !parent || !ctx) return;

    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const sprite = haloSprite();
    let stars: Star[] = [];
    let fall: Fall | null = null;
    let nextFall = 4;
    let w = 0;
    let h = 0;
    let dpr = 1;
    // The part of the canvas in the viewport, in canvas pixels; updated on scroll, not per frame.
    let top = 0;
    let bottom = 0;

    const seed = () => {
      dpr = Math.min(2, window.devicePixelRatio || 1);
      w = parent.clientWidth;
      h = parent.clientHeight;
      c.width = Math.round(w * dpr);
      c.height = Math.round(h * dpr);
      c.style.width = `${w}px`;
      c.style.height = `${h}px`;
      const count = Math.round(((w * h) / 5200) * density);
      stars = Array.from({ length: count }, () => {
        const halo = Math.random() < 0.05;
        return {
          x: Math.random() * w,
          y: Math.random() * h,
          r: halo ? 1.1 + Math.random() * 0.7 : 0.35 + Math.random() * 0.8,
          base: 0.25 + Math.random() * 0.55,
          speed: 0.4 + Math.random() * 1.6,
          phase: Math.random() * Math.PI * 2,
          halo,
        };
      });
    };

    const measure = () => {
      const r = parent.getBoundingClientRect();
      top = Math.max(0, -r.top - 20);
      bottom = Math.min(h, window.innerHeight - r.top + 20);
    };

    /** Draws the stars between y0 and y1; the whole sky when asked. */
    const draw = (t: number, y0 = 0, y1 = h) => {
      if (y1 <= y0) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, y0, w, y1 - y0);
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, y0, w, y1 - y0);
      ctx.clip();
      ctx.fillStyle = "rgb(235, 244, 255)";
      for (const s of stars) {
        if (s.y < y0 - 14 || s.y > y1 + 14) continue;
        const tw = still ? 1 : 0.55 + 0.45 * Math.sin(t * s.speed + s.phase);
        if (s.halo && sprite) {
          const size = s.r * 14;
          ctx.globalAlpha = tw;
          ctx.drawImage(sprite, s.x - size / 2, s.y - size / 2, size, size);
        }
        ctx.globalAlpha = s.base * tw;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      if (fall) {
        const tail = 90;
        const len = Math.hypot(fall.vx, fall.vy);
        const g = ctx.createLinearGradient(fall.x, fall.y, fall.x - (fall.vx / len) * tail, fall.y - (fall.vy / len) * tail);
        g.addColorStop(0, `rgba(255, 255, 255, ${0.8 * fall.life})`);
        g.addColorStop(1, "rgba(255, 255, 255, 0)");
        ctx.strokeStyle = g;
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(fall.x, fall.y);
        ctx.lineTo(fall.x - (fall.vx / len) * tail, fall.y - (fall.vy / len) * tail);
        ctx.stroke();
      }
      ctx.restore();
    };

    seed();
    let raf = 0;
    let visible = false;
    let last = performance.now();
    let lastDraw = 0;

    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      if (now - lastDraw < FRAME_MS) return;
      lastDraw = now;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      nextFall -= dt;
      if (!fall && nextFall <= 0) {
        // Only where someone will see it.
        const y = top + (bottom - top) * Math.random() * 0.4;
        fall = { x: w * (0.2 + Math.random() * 0.7), y, vx: -420, vy: 180, life: 1 };
        nextFall = 7 + Math.random() * 9;
      }
      if (fall) {
        fall.x += fall.vx * dt;
        fall.y += fall.vy * dt;
        fall.life -= dt * 1.4;
        if (fall.life <= 0) fall = null;
      }
      draw(now / 1000, top, bottom);
    };

    const start = () => {
      window.addEventListener("scroll", measure, { passive: true });
      window.addEventListener("resize", measure);
      measure();
      last = performance.now();
      raf = requestAnimationFrame(tick);
    };
    const stop = () => {
      window.removeEventListener("scroll", measure);
      window.removeEventListener("resize", measure);
      cancelAnimationFrame(raf);
    };

    const io = new IntersectionObserver(([e]) => {
      const now = !!e?.isIntersecting;
      if (now === visible) return;
      visible = now;
      if (visible && !still) start();
      else stop();
    });
    io.observe(parent);
    const ro = new ResizeObserver(() => {
      seed();
      measure();
      draw(performance.now() / 1000);
    });
    ro.observe(parent);
    draw(0);

    return () => {
      io.disconnect();
      ro.disconnect();
      stop();
    };
  }, [density]);

  return <canvas ref={canvas} className="fk-stars" aria-hidden />;
}
