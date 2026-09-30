/**
 * The landing page's floating form parts: they bob in place and lean toward
 * the pointer.
 *
 * Its own requestAnimationFrame loop on its own clock, writing transforms
 * straight to the DOM rather than through React state, so nothing re-renders
 * sixty times a second. The hero's own pill carries a `data-float` too, so the
 * word in the headline leans with everything else. Returns a function that
 * stops it.
 */
export function floaties(root: HTMLElement) {
  const els = Array.from(root.querySelectorAll<HTMLElement>("[data-float]"));
  const stage = root.querySelector<HTMLElement>(".fk-hero-stage");
  if (!els.length || !stage) return () => {};

  let mx = 0;
  let my = 0;
  const onMove = (event: PointerEvent) => {
    const r = stage.getBoundingClientRect();
    // Hidden (the phone layout is showing) it measures as an empty box.
    if (!r.width || r.bottom < 0 || r.top > window.innerHeight) return;
    mx = (event.clientX - (r.left + r.width / 2)) / Math.max(1, r.width / 2);
    my = (event.clientY - (r.top + r.height / 2)) / Math.max(1, r.height / 2);
  };
  window.addEventListener("pointermove", onMove, { passive: true });

  const t0 = performance.now();
  let raf = requestAnimationFrame(function tick(now: number) {
    const r = stage.getBoundingClientRect();
    // Off screen the loop keeps its clock but writes nothing.
    if (r.height > 0 && r.bottom > -100 && r.top < window.innerHeight + 100) {
      const t = (now - t0) / 1000;
      els.forEach((el, i) => {
        const depth = parseFloat(el.getAttribute("data-float") ?? "") || 20;
        const bobY = Math.sin(t * 0.7 + i * 1.3) * (depth * 0.18);
        const bobX = Math.cos(t * 0.5 + i * 0.9) * (depth * 0.1);
        const leanX = -mx * depth * 0.5;
        const leanY = -my * depth * 0.35;
        el.style.transform =
          `translate3d(${(bobX + leanX).toFixed(2)}px,${(bobY + leanY).toFixed(2)}px,0)` +
          ` rotateX(${(-my * 7).toFixed(2)}deg) rotateY(${(mx * 9).toFixed(2)}deg)`;
      });
    }
    raf = requestAnimationFrame(tick);
  });

  return () => {
    window.removeEventListener("pointermove", onMove);
    cancelAnimationFrame(raf);
  };
}
