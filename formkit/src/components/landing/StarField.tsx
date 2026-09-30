"use client";

import { useEffect, useRef } from "react";

/**
 * A night sky for a dark section: small stars that twinkle at their own pace,
 * a few brighter ones with a soft halo, and now and then one that falls. It
 * fills its positioned parent, draws only while on screen, and holds still
 * for anyone who asked for less motion.
 */

type Star = { x: number; y: number; r: number; base: number; speed: number; phase: number; halo: boolean };
type Fall = { x: number; y: number; vx: number; vy: number; life: number };

export function StarField({ density = 1 }: { density?: number }) {
  const canvas = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const c = canvas.current;
    const parent = c?.parentElement;
    const ctx = c?.getContext("2d");
    if (!c || !parent || !ctx) return;

    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let stars: Star[] = [];
    let fall: Fall | null = null;
    let nextFall = 4;
    let w = 0;
    let h = 0;
    let dpr = 1;

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

    const draw = (t: number) => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      for (const s of stars) {
        const tw = still ? 1 : 0.55 + 0.45 * Math.sin(t * s.speed + s.phase);
        const a = s.base * tw;
        if (s.halo) {
          const g = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.r * 7);
          g.addColorStop(0, `rgba(190, 220, 255, ${0.35 * tw})`);
          g.addColorStop(1, "rgba(190, 220, 255, 0)");
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(s.x, s.y, s.r * 7, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.fillStyle = `rgba(235, 244, 255, ${a})`;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();
      }
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
    };

    seed();
    let raf = 0;
    let visible = false;
    let last = performance.now();

    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const t = now / 1000;
      nextFall -= dt;
      if (!fall && nextFall <= 0) {
        fall = { x: w * (0.2 + Math.random() * 0.7), y: h * Math.random() * 0.4, vx: -420, vy: 180, life: 1 };
        nextFall = 7 + Math.random() * 9;
      }
      if (fall) {
        fall.x += fall.vx * dt;
        fall.y += fall.vy * dt;
        fall.life -= dt * 1.4;
        if (fall.life <= 0) fall = null;
      }
      draw(t);
      if (visible) raf = requestAnimationFrame(tick);
    };

    const io = new IntersectionObserver(([e]) => {
      visible = !!e?.isIntersecting;
      cancelAnimationFrame(raf);
      if (visible && !still) {
        last = performance.now();
        raf = requestAnimationFrame(tick);
      }
    });
    io.observe(parent);
    const ro = new ResizeObserver(() => {
      seed();
      draw(performance.now() / 1000);
    });
    ro.observe(parent);
    draw(0);

    return () => {
      io.disconnect();
      ro.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [density]);

  return <canvas ref={canvas} className="fk-stars" aria-hidden />;
}
