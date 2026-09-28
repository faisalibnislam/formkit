"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronDown, LayoutGrid, LifeBuoy, LogOut, Menu, X } from "lucide-react";
import { useAuthActions } from "@convex-dev/auth/react";
import { useViewer } from "@/lib/seed";
import { Logo } from "@/components/brand/Logo";
import { NAV_LINKS, type NavKey } from "@/lib/site";

const NARROW_AFTER = 60;

/**
 * The shared public navigation: a fixed dark pill above every public page.
 *
 * Two behaviours worth knowing before touching this:
 *
 * 1. The bar narrows to the content grid past 60px of scroll.
 * 2. It lifts away while an element marked `data-nav-hide` sits under it. The
 *    guard is computed from the bar's RESTING footprint, never its live rect -
 *    reading the live rect while hidden collapses the test, the bar animates
 *    back in, and (since the handler only runs on scroll) it comes to rest on
 *    top of the very section it was avoiding.
 */
export function SiteNav({ current }: { current?: NavKey }) {
  const bar = useRef<HTMLElement | null>(null);
  const [narrow, setNarrow] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  // The section links, on a screen too narrow to show them in the bar.
  const [sectionsOpen, setSectionsOpen] = useState(false);

  const viewer = useViewer();
  const { signOut } = useAuthActions();
  const router = useRouter();

  useEffect(() => {
    const measure = () => {
      const el = bar.current;
      if (!el) return;

      const scrolled = window.scrollY > NARROW_AFTER;
      setNarrow(scrolled);

      const restingTop = scrolled ? 14 : 29;
      const guard = restingTop + el.offsetHeight + 12;

      // At the very top the bar always shows, even over a marked hero.
      const over =
        window.scrollY > NARROW_AFTER &&
        Array.from(document.querySelectorAll("[data-nav-hide]")).some((section) => {
          const r = section.getBoundingClientRect();
          return r.top < guard && r.bottom > 0;
        });
      setHidden(over);
    };

    measure();
    window.addEventListener("scroll", measure, { passive: true });
    window.addEventListener("resize", measure);
    return () => {
      window.removeEventListener("scroll", measure);
      window.removeEventListener("resize", measure);
    };
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: PointerEvent) => {
      if (bar.current && !bar.current.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  useEffect(() => {
    if (!sectionsOpen) return;
    const onDown = (e: PointerEvent) => {
      if (bar.current && !bar.current.contains(e.target as Node)) setSectionsOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSectionsOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [sectionsOpen]);

  const onSignOut = useCallback(async () => {
    setMenuOpen(false);
    await signOut();
    router.push("/");
  }, [signOut, router]);

  const signedIn = !!viewer;
  const initials =
    (viewer?.name ?? "")
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]!.toUpperCase())
      .join("") || "FK";

  return (
    <header
      ref={bar}
      className="fk-nav"
      data-narrow={narrow}
      data-hidden={hidden}
      aria-label="Formkit form builder"
    >
      <Link
        href={signedIn ? "/app" : "/"}
        className="fk-nav-logo"
        aria-label={signedIn ? "Formkit, go to your dashboard" : "Formkit home"}
      >
        <Logo size={19} tone="current" />
      </Link>

      <nav className="fk-nav-links" aria-label="Sections">
        {NAV_LINKS.map((l) => (
          <Link
            key={l.id}
            href={l.href}
            className="fk-nav-link"
            aria-current={current === l.id ? "page" : undefined}
          >
            {l.label}
          </Link>
        ))}
      </nav>

      <span className="fk-nav-spacer" />

      <span className="fk-nav-sections">
        <button
          type="button"
          className="fk-nav-burger"
          aria-label={sectionsOpen ? "Close the menu" : "Menu"}
          aria-expanded={sectionsOpen}
          aria-controls="fk-nav-sheet"
          onClick={() => {
            setMenuOpen(false);
            setSectionsOpen((o) => !o);
          }}
        >
          {sectionsOpen ? <X size={19} strokeWidth={1.8} aria-hidden /> : <Menu size={19} strokeWidth={1.8} aria-hidden />}
        </button>
        {sectionsOpen && (
          <nav id="fk-nav-sheet" className="fk-nav-sheet" aria-label="Sections">
            {NAV_LINKS.map((l) => (
              <Link
                key={l.id}
                href={l.href}
                className="fk-nav-sheet-link"
                aria-current={current === l.id ? "page" : undefined}
                onClick={() => setSectionsOpen(false)}
              >
                {l.label}
              </Link>
            ))}
          </nav>
        )}
      </span>

      {signedIn ? (
        <span className="fk-nav-account">
          <button
            type="button"
            className="fk-nav-capsule"
            onClick={() => setMenuOpen((o) => !o)}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            aria-label="Account menu"
          >
            {viewer.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img className="fk-nav-initials fk-nav-avatar" src={viewer.image} alt="" />
            ) : (
              <span className="fk-nav-initials">{initials}</span>
            )}
            <span className="fk-nav-name">{viewer.name}</span>
            <span className="fk-nav-caret">
              <ChevronDown size={15} strokeWidth={1.8} aria-hidden />
            </span>
          </button>

          {menuOpen && (
            <span role="menu" className="fk-nav-menu">
              <span className="fk-nav-menu-head">
                <span
                  style={{
                    display: "block",
                    fontSize: 14.5,
                    fontWeight: 500,
                    color: "var(--neutral-900)",
                  }}
                >
                  {viewer.name}
                </span>
                <span
                  style={{
                    display: "block",
                    marginTop: 2,
                    fontSize: 12.5,
                    color: "var(--color-text-tertiary)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {viewer.email}
                </span>
              </span>
              <span className="fk-nav-menu-rule" />
              <Link href="/app" role="menuitem" className="fk-nav-menu-item">
                <LayoutGrid size={16} strokeWidth={1.8} aria-hidden />
                Dashboard
              </Link>
              <Link href="/help" role="menuitem" className="fk-nav-menu-item">
                <LifeBuoy size={16} strokeWidth={1.8} aria-hidden />
                Help center
              </Link>
              <span className="fk-nav-menu-rule" style={{ margin: "6px 8px" }} />
              <button
                type="button"
                role="menuitem"
                className="fk-nav-menu-item fk-nav-menu-danger"
                onClick={onSignOut}
              >
                <LogOut size={16} strokeWidth={1.8} aria-hidden />
                Log out
              </button>
            </span>
          )}
        </span>
      ) : (
        <>
          <Link href="/signin" className="fk-nav-signin">
            Sign in
          </Link>
          <Link href="/signup" className="fk-nav-signup">
            Sign up
          </Link>
        </>
      )}
    </header>
  );
}
