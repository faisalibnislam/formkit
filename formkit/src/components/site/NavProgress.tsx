"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

/**
 * A thin bar across the top of the window while a page is on its way.
 *
 * It starts on a click on any link to another page on this site and finishes
 * when the address changes. A navigation that lands within a moment never
 * shows it at all.
 */

export function NavProgress() {
  const pathname = usePathname();
  const search = useSearchParams();
  const [state, setState] = useState<"idle" | "loading" | "done">("idle");
  const timers = useRef<number[]>([]);
  const running = useRef(false);

  useEffect(() => {
    const clear = () => {
      timers.current.forEach((t) => window.clearTimeout(t));
      timers.current = [];
    };
    const start = () => {
      if (running.current) return;
      running.current = true;
      clear();
      // A beat's grace: fast navigations finish before the bar appears.
      timers.current.push(window.setTimeout(() => running.current && setState("loading"), 120));
      // Never left hanging if the navigation is abandoned.
      timers.current.push(window.setTimeout(() => finish(), 12_000));
    };
    const finish = () => {
      if (!running.current) return;
      running.current = false;
      clear();
      setState((s) => (s === "loading" ? "done" : "idle"));
      timers.current.push(window.setTimeout(() => setState("idle"), 500));
    };
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a");
      if (!a || !a.href || (a.target && a.target !== "_self") || a.hasAttribute("download")) return;
      const to = new URL(a.href, window.location.href);
      if (to.origin !== window.location.origin) return;
      if (to.pathname === window.location.pathname && to.search === window.location.search) return;
      start();
    };
    document.addEventListener("click", onClick);
    window.addEventListener("fk:navigated", finish);
    return () => {
      document.removeEventListener("click", onClick);
      window.removeEventListener("fk:navigated", finish);
      clear();
    };
  }, []);

  // The address changed: the new page is here.
  useEffect(() => {
    window.dispatchEvent(new Event("fk:navigated"));
  }, [pathname, search]);

  return <div className="fk-navbar" data-state={state} aria-hidden />;
}
