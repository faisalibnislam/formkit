"use client";

import { useEffect, useRef } from "react";

/**
 * Escape closes whatever is open. A menu or popover that opens with a click
 * must close with Escape as well as a click outside, and hand focus back to
 * whatever was focused when it opened, so a keyboard user is never stranded.
 *
 * Listens in the capture phase and stops the event, so one press closes the
 * topmost thing only — a menu inside a drawer closes, the drawer stays.
 */
export function useEscape(open: boolean, close: () => void) {
  const closeRef = useRef(close);
  useEffect(() => {
    closeRef.current = close;
  }, [close]);

  useEffect(() => {
    if (!open) return;
    const before = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented) return;
      e.preventDefault();
      e.stopPropagation();
      closeRef.current();
    };
    window.addEventListener("keydown", onKey, true);
    return () => {
      window.removeEventListener("keydown", onKey, true);
      // Only take focus back if it was left somewhere that no longer exists.
      if (before && before.isConnected && (!document.activeElement || document.activeElement === document.body)) {
        before.focus({ preventScroll: true });
      }
    };
  }, [open]);
}

/**
 * The dark button tips are CSS, shown on hover and focus. Escape hides the one
 * showing — without moving the pointer — until the pointer leaves the button or
 * focus moves off it. Mounted once, by the app shell.
 */
export function useTipEscape() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      const shown = [
        ...document.querySelectorAll<HTMLElement>("[data-tip]:hover"),
        ...(document.activeElement instanceof HTMLElement && document.activeElement.matches("[data-tip]")
          ? [document.activeElement]
          : []),
      ];
      for (const el of shown) {
        if (el.hasAttribute("data-tip-off")) continue;
        el.setAttribute("data-tip-off", "");
        const back = () => {
          el.removeAttribute("data-tip-off");
          el.removeEventListener("pointerleave", back);
          el.removeEventListener("blur", back);
        };
        el.addEventListener("pointerleave", back);
        el.addEventListener("blur", back);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}
