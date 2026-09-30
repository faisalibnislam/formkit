"use client";

import { useEffect, useState, useSyncExternalStore, type ReactNode, type RefObject } from "react";

/**
 * The pieces every feature scene shares: whether motion is wanted, whether
 * the scene is on screen (nothing animates off screen), a timer that only
 * runs while it is, and the window frame the scene sits in.
 *
 * Scenes are drawn in HTML rather than screenshots, so they stay sharp,
 * follow the app when it changes, and can be played with.
 */

const RM = "(prefers-reduced-motion: reduce)";

function subscribeRm(cb: () => void) {
  const m = window.matchMedia(RM);
  m.addEventListener("change", cb);
  return () => m.removeEventListener("change", cb);
}

/** True when the visitor asked for less motion. Scenes then show their finished state. */
export function useReducedMotion() {
  return useSyncExternalStore(
    subscribeRm,
    () => window.matchMedia(RM).matches,
    () => false,
  );
}

/** Whether the element is on screen. */
export function useInView(ref: RefObject<HTMLElement | null>, threshold = 0.2) {
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || !("IntersectionObserver" in window)) return;
    const io = new IntersectionObserver(([e]) => setSeen(!!e?.isIntersecting), { threshold });
    io.observe(el);
    return () => io.disconnect();
  }, [ref, threshold]);
  return seen;
}

/** Calls `fn` after `ms`, again whenever `deps` change, but only while `on`. */
export function useStep(on: boolean, ms: number, fn: () => void, deps: unknown[]) {
  useEffect(() => {
    if (!on) return;
    const t = setTimeout(fn, ms);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [on, ms, ...deps]);
}

export type SceneProps = {
  /** Small, self-playing and not clickable: for cards on the index. */
  compact?: boolean;
};

/** The window a scene sits in: a title bar, then the scene. */
export function SceneFrame({
  title,
  right,
  compact,
  children,
  label,
  innerRef,
  tone,
}: {
  title: string;
  right?: ReactNode;
  compact?: boolean;
  children: ReactNode;
  /** What the scene shows, for screen readers. */
  label: string;
  innerRef?: RefObject<HTMLDivElement | null>;
  tone?: "dark";
}) {
  return (
    <div
      ref={innerRef}
      className="fk-sc"
      data-compact={compact || undefined}
      data-tone={tone}
      role="figure"
      aria-label={label}
    >
      <div className="fk-sc-bar">
        <span className="fk-sc-dots" aria-hidden>
          <i />
          <i />
          <i />
        </span>
        <span className="fk-sc-title">{title}</span>
        {right && <span className="fk-sc-right">{right}</span>}
      </div>
      <div className="fk-sc-body">{children}</div>
    </div>
  );
}

/** A small pill of choices inside a scene. */
export function Chips<T extends string>({
  options,
  value,
  onChange,
  label,
  disabled,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <div className="fk-sc-chips" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          tabIndex={disabled ? -1 : undefined}
          disabled={disabled}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
