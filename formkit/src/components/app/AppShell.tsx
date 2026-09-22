"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import {
  Bell,
  ChartPie,
  CircleUser,
  FileText,
  Inbox,
  LayoutGrid,
  LayoutTemplate,
  LogOut,
  Menu,
  Plus,
  Search,
  Settings2,
  Shield,
  Sparkles,
  X,
} from "lucide-react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { NightSky } from "@/components/brand/NightSky";
import { Logo } from "@/components/brand/Logo";
import { PillTabs } from "@/components/ui";
import { CreateFormDialog } from "./CreateFormDialog";
import { NotificationsDrawer } from "./NotificationsDrawer";
import { CommandPalette } from "./CommandPalette";
import { EditorHeader } from "./EditorHeader";
import { Avatar, TabCard } from "./bits";

/**
 * The signed-in shell.
 *
 * The header decides what it shows from the URL rather than from a prop a page
 * passes up, so a page renders only its body. Inside a form the header is the
 * editor's own — title, status, publish — which `EditorHeader` draws.
 *
 * Ask Formkit appears in the rail only when the account has been allowed it. An
 * account without access sees no AI surface at all: no pill, no locked state,
 * no mention of it. Do not add one back.
 */

type NavKey = "home" | "forms" | "responses" | "analytics" | "templates" | "ask";

const NAV: { value: NavKey; label: string; href: string; icon: ReactNode }[] = [
  { value: "home", label: "Dashboard", href: "/app", icon: <LayoutGrid size={16} strokeWidth={1.8} aria-hidden /> },
  { value: "forms", label: "Forms", href: "/app/forms", icon: <FileText size={16} strokeWidth={1.8} aria-hidden /> },
  { value: "responses", label: "Responses", href: "/app/responses", icon: <Inbox size={16} strokeWidth={1.8} aria-hidden /> },
  { value: "analytics", label: "Analytics", href: "/app/analytics", icon: <ChartPie size={16} strokeWidth={1.8} aria-hidden /> },
  { value: "templates", label: "Templates", href: "/app/templates", icon: <LayoutTemplate size={16} strokeWidth={1.8} aria-hidden /> },
];

const ASK_NAV = {
  value: "ask" as const,
  label: "Ask",
  href: "/app/ask",
  icon: <Sparkles size={16} strokeWidth={1.8} aria-hidden />,
};

function greeting(hour: number) {
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const search = useSearchParams();
  const router = useRouter();
  const { signOut } = useAuthActions();

  const viewer = useQuery(api.users.viewer, {});
  const formsList = useQuery(api.forms.list, { filter: "all" });
  const notifications = useQuery(api.notifications.recent, {});

  const [createOpen, setCreateOpen] = useState(false);
  const [bellOpen, setBellOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [floating, setFloating] = useState(false);

  const headerRef = useRef<HTMLElement>(null);

  // The floating rail appears once the header's own tabs have scrolled away.
  useEffect(() => {
    const onScroll = () => {
      const el = headerRef.current;
      if (!el) return;
      setFloating(el.getBoundingClientRect().bottom < 8);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [pathname]);

  // Cmd-K opens the palette from anywhere.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const editorId = useMemo(() => {
    const match = /^\/app\/forms\/([^/]+)/.exec(pathname ?? "");
    return match ? (match[1] as Id<"forms">) : null;
  }, [pathname]);

  const inSettings = pathname?.startsWith("/app/settings") ?? false;

  const nav = useMemo(
    () => (viewer?.ai.allowed ? [...NAV, ASK_NAV] : NAV),
    [viewer?.ai.allowed],
  );

  const current: NavKey = editorId
    ? "forms"
    : pathname === "/app"
      ? "home"
      : pathname?.startsWith("/app/forms")
        ? "forms"
        : pathname?.startsWith("/app/responses")
          ? "responses"
          : pathname?.startsWith("/app/analytics")
            ? "analytics"
            : pathname?.startsWith("/app/templates")
              ? "templates"
              : pathname?.startsWith("/app/ask")
                ? "ask"
                : "home";

  const counts = formsList?.counts;
  const live = counts?.published ?? 0;
  const unread = notifications?.unread ?? 0;

  const dock = useMemo(
    () => [
      { href: "/app", name: "Dashboard", meta: "Overview", icon: <LayoutGrid size={15} strokeWidth={1.8} aria-hidden />, label: "Live forms", value: String(live), key: "home" },
      { href: "/app/forms", name: "Forms", meta: `${counts?.all ?? 0} forms`, icon: <FileText size={15} strokeWidth={1.8} aria-hidden />, label: "Collecting", value: String(live), key: "forms" },
      { href: "/app/responses", name: "Responses", meta: "All submissions", icon: <Inbox size={15} strokeWidth={1.8} aria-hidden />, label: "New", value: String(unread), key: "responses" },
      { href: "/app/analytics", name: "Analytics", meta: "Last 30 days", icon: <ChartPie size={15} strokeWidth={1.8} aria-hidden />, label: "Forms", value: String(counts?.all ?? 0), key: "analytics" },
      { href: "/app/templates", name: "Templates", meta: "Start from one", icon: <LayoutTemplate size={15} strokeWidth={1.8} aria-hidden />, label: "Ready to use", value: "6", key: "templates" },
    ],
    [counts, live, unread],
  );

  const hour = new Date().getHours();
  const firstName = (viewer?.name ?? "").trim().split(/\s+/)[0] || "there";

  const heroes: Record<string, { eyebrow: string; title: string; sub: string }> = {
    home: {
      eyebrow: new Date().toLocaleDateString("en-US", {
        weekday: "long",
        day: "numeric",
        month: "long",
      }),
      title: `${greeting(hour)}, ${firstName}`,
      sub: counts?.all
        ? "Here's what's happening with your forms."
        : "Nothing here yet. One form is all it takes to start.",
    },
    forms: {
      eyebrow: viewer?.email ?? "",
      title: "Forms",
      sub: counts?.all
        ? `${counts.all} forms, ${live} of them collecting right now.`
        : "No forms yet — create one, or lift a template.",
    },
    responses: {
      eyebrow: viewer?.email ?? "",
      title: "Responses",
      sub: "Everything people have sent you, in one inbox.",
    },
    analytics: {
      eyebrow: viewer?.email ?? "",
      title: "Analytics",
      sub: "Where people drop off, and how long they stay.",
    },
    templates: {
      eyebrow: "Library",
      title: "Templates",
      sub: "Start from something that already works.",
    },
    ask: {
      eyebrow: viewer
        ? `${Math.max(0, viewer.ai.limit - viewer.ai.used)} of ${viewer.ai.limit} form credits left`
        : "",
      title: "Ask Formkit",
      sub: "Describe a form, or ask for a change to one you already have.",
    },
  };

  const hero = inSettings
    ? { eyebrow: "", title: "Settings", sub: "Your account, companies, sharing and exports." }
    : heroes[current];

  return (
    <div className="fk-app">
      <a className="fk-skip" href="#fk-app-main">
        Skip to content
      </a>

      <header className="fk-app-head" ref={headerRef}>
        <NightSky />

        <div className="fk-app-bar">
          <div className="fk-app-bar-left">
            <span style={{ position: "relative", display: "inline-flex" }} className="fk-only-narrow">
              <button
                type="button"
                className="fk-glass"
                aria-label="Sections"
                aria-expanded={menuOpen}
                onClick={() => setMenuOpen((v) => !v)}
              >
                {menuOpen ? <X size={18} strokeWidth={1.8} aria-hidden /> : <Menu size={18} strokeWidth={1.8} aria-hidden />}
              </button>
              {menuOpen && (
                <>
                  <span className="fk-menu-scrim" onClick={() => setMenuOpen(false)} aria-hidden />
                  <span className="fk-menu" data-align="left" role="menu">
                    {nav.map((n) => (
                      <Link
                        key={n.value}
                        role="menuitem"
                        href={n.href}
                        className="fk-menu-item"
                        style={n.value === current ? { background: "var(--blue-50)" } : undefined}
                        onClick={() => setMenuOpen(false)}
                      >
                        {n.icon}
                        <span style={{ flex: 1, minWidth: 0 }}>{n.label}</span>
                      </Link>
                    ))}
                  </span>
                </>
              )}
            </span>

            <Link href="/app" className="fk-app-home" aria-label="Formkit — go to dashboard">
              <Logo tone="inverse" />
            </Link>
          </div>

          <div className="fk-app-bar-mid">
            <PillTabs
              ariaLabel="Sections"
              tabs={nav.map((n) => ({ value: n.value, label: n.label, icon: n.icon }))}
              value={current}
              onChange={(next) => {
                const target = nav.find((n) => n.value === next);
                if (target) router.push(target.href);
              }}
            />
          </div>

          <div className="fk-app-bar-right">
            <button
              type="button"
              className="fk-glass fk-glass-pill fk-glass-solid fk-only-wide"
              onClick={() => setCreateOpen(true)}
            >
              <Plus size={16} strokeWidth={1.8} aria-hidden />
              Create form
            </button>
            <button
              type="button"
              className="fk-glass fk-only-narrow"
              aria-label="Create form"
              onClick={() => setCreateOpen(true)}
            >
              <Plus size={18} strokeWidth={1.8} aria-hidden />
            </button>

            <button
              type="button"
              className="fk-glass fk-only-wide"
              aria-label="Search"
              onClick={() => setPaletteOpen(true)}
            >
              <Search size={18} strokeWidth={1.8} aria-hidden />
            </button>

            <span className="fk-bell">
              <button
                type="button"
                className="fk-glass"
                aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}
                onClick={() => setBellOpen(true)}
              >
                <Bell size={18} strokeWidth={1.8} aria-hidden />
              </button>
              {unread > 0 && <span className="fk-bell-count">{unread}</span>}
            </span>

            <span className="fk-account">
              <button
                type="button"
                className="fk-account-trigger"
                aria-haspopup="menu"
                aria-expanded={accountOpen}
                onClick={() => setAccountOpen((v) => !v)}
              >
                <Avatar name={viewer?.name ?? ""} image={viewer?.image ?? null} />
                <span className="fk-account-name">{viewer?.name ?? "Account"}</span>
              </button>
              {accountOpen && (
                <>
                  <span className="fk-menu-scrim" onClick={() => setAccountOpen(false)} aria-hidden />
                  <span className="fk-menu" data-align="right" role="menu">
                    <span className="fk-menu-head">{viewer?.email}</span>
                    <Link
                      role="menuitem"
                      href="/app/settings"
                      className="fk-menu-item"
                      onClick={() => setAccountOpen(false)}
                    >
                      <CircleUser size={16} strokeWidth={1.8} aria-hidden />
                      Account
                    </Link>
                    <Link
                      role="menuitem"
                      href="/app/settings?tab=companies"
                      className="fk-menu-item"
                      onClick={() => setAccountOpen(false)}
                    >
                      <Settings2 size={16} strokeWidth={1.8} aria-hidden />
                      Companies and branding
                    </Link>
                    {viewer?.staffRole && (
                      <Link
                        role="menuitem"
                        href="/admin"
                        className="fk-menu-item"
                        onClick={() => setAccountOpen(false)}
                      >
                        <Shield size={16} strokeWidth={1.8} aria-hidden />
                        Admin console
                      </Link>
                    )}
                    <span className="fk-menu-rule" />
                    <button
                      type="button"
                      role="menuitem"
                      className="fk-menu-item"
                      data-tone="danger"
                      onClick={() => {
                        setAccountOpen(false);
                        void signOut().then(() => router.push("/"));
                      }}
                    >
                      <LogOut size={16} strokeWidth={1.8} aria-hidden />
                      Sign out
                    </button>
                  </span>
                </>
              )}
            </span>
          </div>
        </div>

        {editorId ? (
          <EditorHeader formId={editorId} tab={search.get("tab") ?? "build"} />
        ) : (
          <>
            <div className="fk-app-hero">
              <div className="fk-app-hero-text">
                {inSettings ? (
                  <Link href="/app" className="fk-app-back">
                    ← Dashboard
                  </Link>
                ) : (
                  hero?.eyebrow && <div className="fk-app-eyebrow">{hero.eyebrow}</div>
                )}
                <h1>{hero?.title}</h1>
                {hero?.sub && <p>{hero.sub}</p>}
              </div>
            </div>

            {!inSettings && (
              <div className="fk-dock">
                {dock.map((d) => (
                  <TabCard
                    key={d.key}
                    href={d.href}
                    name={d.name}
                    meta={d.meta}
                    mark={d.icon}
                    active={d.key === current}
                    sumLabel={`${d.label}:`}
                    sumValue={d.value}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </header>

      {floating && !editorId && (
        <div className="fk-float">
          <div className="fk-float-inner">
            <div className="fk-float-rail">
              <PillTabs
                ariaLabel="Sections"
                tabs={nav.map((n) => ({ value: n.value, label: n.label, icon: n.icon }))}
                value={current}
                onChange={(next) => {
                  const target = nav.find((n) => n.value === next);
                  if (target) router.push(target.href);
                }}
              />
            </div>
          </div>
        </div>
      )}

      <main className="fk-app-main" id="fk-app-main">
        {children}
      </main>

      {createOpen && <CreateFormDialog onClose={() => setCreateOpen(false)} />}
      {bellOpen && <NotificationsDrawer onClose={() => setBellOpen(false)} />}
      {paletteOpen && <CommandPalette onClose={() => setPaletteOpen(false)} />}
    </div>
  );
}
