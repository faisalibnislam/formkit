"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { MoreHorizontal } from "lucide-react";
import { IconButton, Portal } from "@/components/ui";

/**
 * A "more actions" menu. It renders in a portal placed from its trigger, so a
 * menu opened from a row near the bottom of the page flips above it, and no
 * card or panel it sits in can clip it. Escape and a click outside close it;
 * the arrow keys move between items.
 */
export type MenuAction = {
  label: string;
  icon: ReactNode;
  onSelect: () => void;
  tone?: "danger";
  /** A rule above this item. */
  divide?: boolean;
};

export function ActionMenu({ label, actions }: { label: string; actions: MenuAction[] }) {
  const trigger = useRef<HTMLSpanElement | null>(null);
  const menu = useRef<HTMLDivElement | null>(null);
  const [at, setAt] = useState<{ top?: number; bottom?: number; right: number } | null>(null);

  const close = () => setAt(null);

  useEffect(() => {
    if (!at) return;
    menu.current?.querySelector<HTMLButtonElement>("button")?.focus();
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (menu.current?.contains(t) || trigger.current?.contains(t)) return;
      close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        close();
        trigger.current?.querySelector("button")?.focus();
      }
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const items = Array.from(menu.current?.querySelectorAll<HTMLButtonElement>("button") ?? []);
        const i = items.indexOf(document.activeElement as HTMLButtonElement);
        const next = items[(i + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length];
        next?.focus();
      }
    };
    const onScroll = () => close();
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey, true);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey, true);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [at]);

  function open() {
    const r = trigger.current?.getBoundingClientRect();
    if (!r) return;
    const needed = actions.length * 44 + 24;
    const below = window.innerHeight - r.bottom;
    setAt({
      top: below < needed && r.top > needed ? undefined : r.bottom + 8,
      bottom: below < needed && r.top > needed ? window.innerHeight - r.top + 8 : undefined,
      right: Math.max(8, window.innerWidth - r.right),
    });
  }

  return (
    <span ref={trigger} style={{ display: "inline-flex" }}>
      <IconButton label={label} tip aria-haspopup="menu" aria-expanded={!!at} onClick={() => (at ? close() : open())}>
        <MoreHorizontal size={16} strokeWidth={1.8} aria-hidden />
      </IconButton>
      {at && (
        <Portal>
          <div
            ref={menu}
            className="fk-menu"
            role="menu"
            aria-label={label}
            style={{ position: "fixed", top: at.top ?? "auto", bottom: at.bottom ?? "auto", right: at.right, zIndex: 400 }}
          >
            {actions.map((a) => (
              <span key={a.label} style={{ display: "contents" }}>
                {a.divide && <span className="fk-menu-rule" />}
                <button
                  type="button"
                  role="menuitem"
                  className="fk-menu-item"
                  data-tone={a.tone}
                  onClick={() => {
                    close();
                    a.onSelect();
                  }}
                >
                  {a.icon}
                  {a.label}
                </button>
              </span>
            ))}
          </div>
        </Portal>
      )}
    </span>
  );
}
