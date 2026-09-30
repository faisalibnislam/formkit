/**
 * The landing page's scroll choreography.
 *
 * One requestAnimationFrame loop reads scroll position, eases each scene's
 * progress toward its target and writes styles straight to the DOM. It parks
 * itself when everything has settled.
 *
 * There is deliberately no React state here: 900vh of choreography driven
 * through render would drop frames, and nothing must re-render over the
 * scroll-written inline styles. Scenes are found by data attribute inside a
 * root element the component owns.
 */

export type Scene = { el: Element; top: number; height: number; viewport: number };

const DAMPING = 0.16;
/** Below this the pinned scenes unpin and become ordinary stacked sections. */
export const UNPIN_AT = 820;

export function createEngine(root: HTMLElement) {
  const q = <T extends Element = HTMLElement>(sel: string) =>
    Array.from(root.querySelectorAll<T>(sel));
  const one = <T extends Element = HTMLElement>(sel: string) =>
    root.querySelector<T>(sel);

  /** Skip a write when the value has not changed - fewer style recalcs a frame. */
  const written = new Map<Element, Map<string, string>>();
  const set = (el: Element | null, prop: string, value: string) => {
    if (!el) return;
    let mine = written.get(el);
    if (!mine) written.set(el, (mine = new Map()));
    if (mine.get(prop) === value) return;
    mine.set(prop, value);
    (el as HTMLElement).style.setProperty(prop, value);
  };

  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
  const seg = (t: number, a: number, b: number) =>
    Math.min(1, Math.max(0, (t - a) / (b - a)));

  let scenes: Record<string, Scene> = {};
  let featureSpan = 0;

  function measure() {
    const viewport = window.innerHeight;
    scenes = {};
    for (const name of ["hero", "features"]) {
      const el = one(`[data-scene="${name}"]`);
      if (!el) continue;
      const r = el.getBoundingClientRect();
      scenes[name] = { el, top: r.top + window.scrollY, height: r.height, viewport };
    }
    const track = one("[data-ftrack]");
    if (track) featureSpan = Math.max(0, track.scrollWidth - window.innerWidth + 40);
  }

  function progress(name: string) {
    const s = scenes[name];
    if (!s) return 0;
    const travel = Math.max(1, s.height - s.viewport);
    return Math.min(1, Math.max(0, (window.scrollY - s.top) / travel));
  }

  function applyHero(p: number) {
    const form = seg(p, 0.16, 0.4);
    // The caption lands first, then the builder assembles around it.
    const reveal = seg(p, 0.52, 0.72);

    set(one(".fk-hero-paper"), "opacity", form.toFixed(3));

    const head = one(".fk-hero-head");
    if (head) {
      set(
        head,
        "transform",
        `translateY(${(-form * 26).toFixed(1)}vh) scale(${lerp(1, 0.52, form).toFixed(3)})`,
      );
      set(head, "opacity", (1 - seg(p, 0.18, 0.4)).toFixed(3));
    }
    set(one(".fk-hero-sub"), "opacity", (0.88 * (1 - seg(p, 0.1, 0.3))).toFixed(3));
    set(one(".fk-hero-eyebrow"), "opacity", (1 - seg(p, 0.06, 0.24)).toFixed(3));
    set(one(".fk-hero-cue"), "opacity", (1 - seg(p, 0.02, 0.16)).toFixed(3));

    const cta = one(".fk-hero-cta");
    set(cta, "opacity", (1 - seg(p, 0.06, 0.24)).toFixed(3));
    set(cta, "pointer-events", p > 0.2 ? "none" : "auto");

    // The floaters belong to the marketing canvas, so they leave with it rather
    // than drifting over the assembled builder.
    set(one(".fk-floaties"), "opacity", (1 - seg(p, 0.06, 0.28)).toFixed(3));

    set(one(".fk-hero-progressline"), "width", `${(form * 100).toFixed(1)}%`);

    const ease = 1 - Math.pow(1 - reveal, 3);
    const parts: Record<string, string> = {
      top: `translate3d(0,${(-100 + 100 * ease).toFixed(2)}%,0)`,
      left: `translate3d(${(-100 + 100 * ease).toFixed(2)}%,0,0)`,
      right: `translate3d(${(100 - 100 * ease).toFixed(2)}%,0,0)`,
      rows: `translate3d(0,${(26 - 26 * ease).toFixed(2)}px,0)`,
    };
    for (const [key, transform] of Object.entries(parts)) {
      const el = one(`[data-bpart="${key}"]`);
      set(el, "opacity", ease.toFixed(3));
      set(el, "transform", transform);
    }

    // Edge to edge: scale the frame to the shell's width, then give it the
    // design height that exactly fills what is left above the caption plate.
    const frame = one(".fk-builder");
    const stage = one(".fk-hero-stage");
    if (frame && stage) {
      const plate = one<HTMLElement>(".fk-hero-plate");
      const available = stage.clientHeight - (plate ? plate.offsetHeight : 120);
      const design = 1660;
      const k = stage.clientWidth / design;
      set(frame, "width", `${design}px`);
      set(frame, "height", `${Math.round(available / k)}px`);
      set(frame, "transform", `scale(${k.toFixed(4)})`);
    }

    const plate = one(".fk-hero-plate");
    if (plate) {
      const show = seg(p, 0.38, 0.5);
      set(plate, "opacity", show.toFixed(3));
      set(plate, "transform", `translateY(${(16 - 16 * show).toFixed(1)}px)`);
    }

    const status = one("[data-herostatus]");
    if (status) {
      const draft = reveal > 0.6;
      const label = draft ? "Draft" : "Untitled";
      if (status.textContent !== label) status.textContent = label;
      set(status, "background", draft ? "var(--green-100)" : "var(--neutral-100)");
      set(status, "color", draft ? "var(--green-600)" : "var(--neutral-600)");
    }
  }

  function applyFeatures(p: number) {
    const track = one("[data-ftrack]");
    if (!track) return;
    set(track, "transform", `translate3d(${(-p * featureSpan).toFixed(1)}px,0,0)`);
    set(one("[data-fbar]"), "width", `${(p * 100).toFixed(1)}%`);

    const total = q("[data-ftrack] > *").length || 12;
    const n = Math.min(total, Math.max(1, Math.round(p * (total - 1)) + 1));
    const label = one("[data-fcount]");
    const text = `${String(n).padStart(2, "0")} / ${total}`;
    if (label && label.textContent !== text) label.textContent = text;
  }

  /** Numbers, ticks and bars animate once, the first time they come into view. */
  const counted = new WeakSet<Element>();
  function applyCounters() {
    q("[data-count],[data-tickh],[data-barw]").forEach((el) => {
      if (counted.has(el)) return;
      const r = el.getBoundingClientRect();
      if (r.top > window.innerHeight * 0.95 || r.bottom < 0) return;
      counted.add(el);

      const tick = el.getAttribute("data-tickh");
      if (tick !== null) {
        (el as HTMLElement).style.height = `${tick}%`;
        return;
      }
      const bar = el.getAttribute("data-barw");
      if (bar !== null) {
        (el as HTMLElement).style.width = `${bar}%`;
        return;
      }

      const target = parseFloat(el.getAttribute("data-count")!);
      const dec = el.getAttribute("data-dec") ? 1 : 0;
      const suffix = el.getAttribute("data-suffix") ?? "";
      const format = (v: number) =>
        (dec ? v.toFixed(1) : Math.round(v).toLocaleString("en-US")) + suffix;
      const start = performance.now();
      const step = (now: number) => {
        const t = Math.min(1, (now - start) / 1000);
        el.textContent = format(target * (1 - Math.pow(1 - t, 3)));
        if (t < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
  }

  /**
   * The floating form parts bob in place and lean toward the pointer.
   *
   * Its own loop, on its own clock: the scroll loop parks itself when
   * everything has settled, and this has to keep running when it does. The
   * hero's own pill carries a `data-float` too, so the word in the headline
   * leans with everything else.
   */
  function floaties() {
    const els = q<HTMLElement>("[data-float]");
    const stage = one(".fk-hero-stage");
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
          // Written straight, not through `set`: it changes every frame, so
          // the dedupe would only cost a map lookup.
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

  /** Reduced motion, or a viewport too short to pin: every scene resolved. */
  function resolveAll(keepHeroScale: boolean) {
    if (!keepHeroScale) applyHero(1);
    applyFeatures(1);
    q("[data-count]").forEach((el) => {
      const dec = el.getAttribute("data-dec") ? 1 : 0;
      const suffix = el.getAttribute("data-suffix") ?? "";
      const v = parseFloat(el.getAttribute("data-count")!);
      el.textContent = (dec ? v.toFixed(1) : Math.round(v).toLocaleString("en-US")) + suffix;
    });
    q("[data-tickh]").forEach((el) => {
      (el as HTMLElement).style.height = `${el.getAttribute("data-tickh")}%`;
    });
    q("[data-barw]").forEach((el) => {
      (el as HTMLElement).style.width = `${el.getAttribute("data-barw")}%`;
    });
  }

  return {
    measure,
    progress,
    applyHero,
    applyFeatures,
    applyCounters,
    floaties,
    resolveAll,
    one,
    q,
    DAMPING,
  };
}

export type Engine = ReturnType<typeof createEngine>;
