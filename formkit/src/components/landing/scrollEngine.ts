/**
 * The landing page's floating form parts: they bob in place and lean toward
 * the pointer.
 *
 * Its own requestAnimationFrame loop on its own clock, writing transforms
 * straight to the DOM rather than through React state, so nothing re-renders
 * sixty times a second. The hero's own pill carries a `data-float` too, so the
 * word in the headline leans with everything else.
 *
 * The loop only runs while the hero is on screen: an IntersectionObserver
 * starts and stops it, so it never runs on a phone (where the desktop hero is
 * not shown) or once the hero has scrolled away. The stage is measured on
 * scroll and resize, never inside the frame, so drawing does not force a
 * layout. Returns a function that stops it.
 */
export function floaties(root: HTMLElement) {
  const els = Array.from(root.querySelectorAll<HTMLElement>("[data-float]"));
  const stage = root.querySelector<HTMLElement>(".fk-hero-stage");
  if (!els.length || !stage) return () => {};

  const depths = els.map((el) => parseFloat(el.getAttribute("data-float") ?? "") || 20);
  let box = stage.getBoundingClientRect();
  const measure = () => {
    box = stage.getBoundingClientRect();
  };

  let mx = 0;
  let my = 0;
  const onMove = (event: PointerEvent) => {
    if (!box.width) return;
    mx = (event.clientX - (box.left + box.width / 2)) / Math.max(1, box.width / 2);
    my = (event.clientY - (box.top + box.height / 2)) / Math.max(1, box.height / 2);
  };

  const t0 = performance.now();
  let raf = 0;
  const tick = (now: number) => {
    const t = (now - t0) / 1000;
    els.forEach((el, i) => {
      const depth = depths[i]!;
      const bobY = Math.sin(t * 0.7 + i * 1.3) * (depth * 0.18);
      const bobX = Math.cos(t * 0.5 + i * 0.9) * (depth * 0.1);
      const leanX = -mx * depth * 0.5;
      const leanY = -my * depth * 0.35;
      el.style.transform =
        `translate3d(${(bobX + leanX).toFixed(2)}px,${(bobY + leanY).toFixed(2)}px,0)` +
        ` rotateX(${(-my * 7).toFixed(2)}deg) rotateY(${(mx * 9).toFixed(2)}deg)`;
    });
    raf = requestAnimationFrame(tick);
  };

  let running = false;
  const start = () => {
    if (running) return;
    running = true;
    measure();
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("scroll", measure, { passive: true });
    window.addEventListener("resize", measure);
    raf = requestAnimationFrame(tick);
  };
  const stop = () => {
    if (!running) return;
    running = false;
    cancelAnimationFrame(raf);
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("scroll", measure);
    window.removeEventListener("resize", measure);
  };

  // A hidden stage (display: none on a phone) never intersects, so never starts.
  const io = new IntersectionObserver(([e]) => (e?.isIntersecting ? start() : stop()), { rootMargin: "100px 0px" });
  io.observe(stage);

  return () => {
    io.disconnect();
    stop();
  };
}
