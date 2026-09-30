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


  let scenes: Record<string, Scene> = {};
  let featureSpan = 0;

  function measure() {
    const viewport = window.innerHeight;
    scenes = {};
    for (const name of ["features"]) {
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

  /** Reduced motion, or a viewport too short to pin: every scene resolved. */
  function resolveAll() {
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
    applyFeatures,
    applyCounters,
    resolveAll,
    one,
    q,
    DAMPING,
  };
}

export type Engine = ReturnType<typeof createEngine>;
