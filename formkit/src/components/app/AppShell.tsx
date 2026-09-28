"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
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
import { AppSky, periodFor } from "@/components/brand/AppSky";
import { Logo } from "@/components/brand/Logo";
import { PillTabs } from "@/components/ui";
import { CreateFormDialog } from "./CreateFormDialog";
import { NotificationsDrawer } from "./NotificationsDrawer";
import { AskProvider } from "./ai/AskProvider";
import { AskDock } from "./ai/AskDock";
import { AppScrollbar } from "./AppScrollbar";
import { SupportBanner, SupportView } from "./SupportView";
import { useToast } from "@/components/ui/Toast";
import { useEscape, useTipEscape } from "@/components/ui/useEscape";
import { useInboxAlerts } from "./useInboxAlerts";
import { CommandPalette } from "./CommandPalette";
import { EditorHeader } from "./EditorHeader";
import { AvatarPill, ClientTab, TabSummary } from "./ds";
import { SessionGate } from "./AccountGates";
import { SETTINGS_TABS, settingsHref, settingsTabOf } from "./Settings";

/**
 * The signed-in shell.
 *
 * The header decides what it shows from the URL rather than from a prop a page
 * passes up, so a page renders only its body. Inside a form the header is the
 * editor's own — title, status, publish — which `EditorHeader` draws.
 *
 * The record dock along the band's bottom edge is the navigation; there is no
 * second row of tabs in the bar above it. The dock is the last thing in the
 * band and the band carries no padding below it, so the tabs meet its bottom
 * edge however tall the active one grows — the active tab carries a summary row
 * its neighbours do not, and a reserved constant would clip it.
 *
 * Ask Formkit appears only when the account has been allowed it. An account
 * without access sees no AI surface at all: no tab, no locked state, no mention
 * of it. Do not add one back.
 */

type NavKey = "home" | "forms" | "responses" | "analytics" | "templates" | "ask";

/** The band's own breathing room under the title when no dock is present. */
const BAND_PAD = 116;

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

/**
 * What stands in front of the app: a session that still owes its two-factor
 * code, or an account deleted inside its 30-day window, sees that screen and
 * nothing else — every other query would refuse it anyway.
 */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <SessionGate>
      <AppFrame>{children}</AppFrame>
    </SessionGate>
  );
}

/** The device a session is on, in the words the sessions list uses. */
function deviceLabel() {
  const ua = navigator.userAgent;
  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /Firefox\//.test(ua)
      ? "Firefox"
      : /Chrome\//.test(ua)
        ? "Chrome"
        : /Safari\//.test(ua)
          ? "Safari"
          : "A browser";
  const os = /iPhone/.test(ua)
    ? "iPhone"
    : /iPad/.test(ua)
      ? "iPad"
      : /Android/.test(ua)
        ? "Android"
        : /Mac OS X/.test(ua)
          ? "Mac"
          : /Windows/.test(ua)
            ? "Windows"
            : /Linux/.test(ua)
              ? "Linux"
              : "";
  return os ? `${browser} on ${os}` : browser;
}

/**
 * Dark mode: the account's choice, when the "Dark mode" flag reaches it.
 * "Match my system" follows the operating system as it changes. The answer is
 * remembered in this browser so the next visit starts in the right theme.
 */
function useAppTheme(pref: "light" | "dark" | "system" | undefined, allowed: boolean, ready: boolean) {
  useEffect(() => {
    if (!ready) return;
    const root = document.documentElement;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      const dark = allowed && (pref === "dark" || (pref === "system" && mq.matches));
      if (dark) root.dataset.appTheme = "dark";
      else delete root.dataset.appTheme;
      try {
        window.localStorage.setItem("fk.appTheme", dark ? "dark" : "light");
      } catch {
        /* no storage: the theme is just applied a moment later next time */
      }
    };
    apply();
    mq.addEventListener("change", apply);
    return () => {
      mq.removeEventListener("change", apply);
      // Leaving the app (for the marketing site, say) leaves the dark theme too.
      delete root.dataset.appTheme;
    };
  }, [pref, allowed, ready]);
}

function AppFrame({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const search = useSearchParams();
  const router = useRouter();
  const { signOut } = useAuthActions();

  const viewer = useQuery(api.users.viewer, {});
  const flags = useQuery(api.flags.mine, {});
  useAppTheme(viewer?.appTheme, Boolean(flags?.["app.dark"]), viewer !== undefined && flags !== undefined);
  // `?viewAs=` is staff only; for anyone else it is ignored.
  const supportUser = viewer?.staffRole ? (search.get("viewAs") as Id<"users"> | null) : null;
  const acceptPending = useMutation(api.collaborators.acceptPending);
  const touch = useMutation(api.security.touch);

  // The sessions list in Settings names each device; this is where it learns
  // this one, and where a new sign-in alert is set off.
  const touched = useRef(false);
  useEffect(() => {
    if (!viewer || touched.current) return;
    touched.current = true;
    void touch({ device: deviceLabel() }).catch(() => {});
  }, [viewer, touch]);

  // Invitations sent to this address before the account existed become live
  // on the way in.
  const accepted = useRef(false);
  useEffect(() => {
    if (!viewer || accepted.current) return;
    accepted.current = true;
    void acceptPending({}).catch(() => {});
  }, [viewer, acceptPending]);
  // Counts only: the full list reads every form's questions, and would recount
  // on every edit in the builder.
  const formsList = useQuery(api.forms.summary, {});
  const inbox = useQuery(api.inbox.list, {});
  const newResponses = useQuery(api.responses.unreadCount, {});
  useInboxAlerts(inbox);

  // Ask Formkit being turned on or off while the app is open is news.
  const toastAccess = useToast();
  const aiWas = useRef<boolean | null>(null);
  const aiNow = viewer?.ai.allowed;
  useEffect(() => {
    if (aiNow === undefined) return;
    if (aiWas.current !== null && aiWas.current !== aiNow) {
      toastAccess(aiNow ? "Ask Formkit is on for your account" : "Ask Formkit is off for now", {
        detail: aiNow ? "Find it in the corner, or under Ask in the tabs." : "Everything it built for you is still in your forms.",
      });
    }
    aiWas.current = aiNow;
  }, [aiNow, toastAccess]);
  // Its figure only shows on the Analytics tab, where the page asks for the
  // same thing — so it is one subscription there and none anywhere else.
  const analytics = useQuery(api.analytics.overview, pathname?.startsWith("/app/analytics") ? {} : "skip");
  const templates = useQuery(api.templates.list, {});

  const [createOpen, setCreateOpen] = useState(false);
  const [bellOpen, setBellOpen] = useState(false);
  // A toast about several new notifications opens the bell.
  useEffect(() => {
    const open = () => setBellOpen(true);
    window.addEventListener("fk:open-bell", open);
    return () => window.removeEventListener("fk:open-bell", open);
  }, []);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  useEscape(menuOpen, () => setMenuOpen(false));
  useEscape(accountOpen, () => setAccountOpen(false));
  useTipEscape();
  const [floating, setFloating] = useState(false);

  const headerRef = useRef<HTMLElement>(null);

  /* The clock is the reader's, not the server's. Rendering the greeting or
     today's date during SSR hydrates into a mismatch for everyone who is not
     in the server's timezone — which is very nearly everyone — and React then
     throws away the tree and rebuilds it. Both are read after mount instead. */
  const [clock, setClock] = useState<{ hour: number; today: string } | null>(null);
  useEffect(() => {
    const read = () => {
      const at = new Date();
      setClock({
        hour: at.getHours(),
        today: at.toLocaleDateString("en-US", {
          weekday: "long",
          day: "numeric",
          month: "long",
        }),
      });
    };
    // Re-read each minute, so a morning greeting becomes an afternoon one.
    const first = window.setTimeout(read, 0);
    const every = window.setInterval(read, 60_000);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(every);
    };
  }, []);

  // The floating rail appears once the header has scrolled away.
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
  const showDock = !editorId;
  const settingsTab = settingsTabOf(search.get("tab"));
  const sharing = useQuery(api.collaborators.people, inSettings ? {} : "skip");

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
  // Until a figure arrives its slot stays blank (a shimmer), never a false zero.
  const known = (ready: boolean, v: string) => (ready ? v : "");
  const unread = inbox?.unread ?? 0;
  const templateCount = templates?.length ?? 0;
  const completion = analytics?.completionRate ?? 0;

  const askAllowed = viewer?.ai.allowed ?? false;
  const askCreditsLeft = viewer ? Math.max(0, viewer.ai.limit - viewer.ai.used) : 0;

  const dock = useMemo(
    () => [
      {
        key: "home" as NavKey,
        href: "/app",
        name: "Dashboard",
        meta: "Overview",
        icon: <LayoutGrid size={15} strokeWidth={1.8} aria-hidden />,
        label: "Live forms:",
        value: known(!!counts, String(live)),
      },
      {
        key: "forms" as NavKey,
        href: "/app/forms",
        name: "Forms",
        meta: counts ? `${counts.all} ${counts.all === 1 ? "form" : "forms"}` : "Your forms",
        icon: <FileText size={15} strokeWidth={1.8} aria-hidden />,
        label: "Collecting:",
        value: known(!!counts, String(live)),
      },
      {
        key: "responses" as NavKey,
        href: "/app/responses",
        name: "Responses",
        meta: "All submissions",
        icon: <Inbox size={15} strokeWidth={1.8} aria-hidden />,
        label: "New:",
        value: known(newResponses !== undefined, String(newResponses ?? 0)),
      },
      {
        key: "analytics" as NavKey,
        href: "/app/analytics",
        name: "Analytics",
        meta: "Last 30 days",
        icon: <ChartPie size={15} strokeWidth={1.8} aria-hidden />,
        label: "Completion:",
        value: known(analytics !== undefined, `${completion}%`),
      },
      {
        key: "templates" as NavKey,
        href: "/app/templates",
        name: "Templates",
        meta: templateCount ? `${templateCount} to start from` : "Start from one",
        icon: <LayoutTemplate size={15} strokeWidth={1.8} aria-hidden />,
        label: "Templates:",
        value: known(templates !== undefined, String(templateCount)),
      },
      // The AI surface exists only for an account that has been allowed it.
      ...(askAllowed
        ? [
            {
              key: "ask" as NavKey,
              href: "/app/ask",
              name: "Ask Formkit",
              meta: "Describe a form",
              icon: <Sparkles size={15} strokeWidth={1.8} aria-hidden />,
              label: "Credits left:",
              value: String(askCreditsLeft),
            },
          ]
        : []),
    ],
    [counts, live, newResponses, analytics, completion, templates, templateCount, askAllowed, askCreditsLeft],
  );

  /* In Settings the dock holds its sections instead of the pages, each with
     the one fact worth seeing at a glance. */
  const skyWord = { sync: "Sync with time", morning: "Morning", afternoon: "Afternoon", evening: "Evening" } as const;
  const settingsDock = SETTINGS_TABS.map((t) => ({
    key: t.value,
    href: settingsHref(t.value),
    name: t.label,
    meta: t.meta,
    icon: <t.icon size={15} strokeWidth={1.8} aria-hidden />,
    ...{
      account: { label: "Signed in as:", value: viewer?.name ?? "" },
      company: { label: "Companies:", value: viewer?.companies.length ? String(viewer.companies.length) : "None" },
      general: { label: "Sky:", value: viewer ? skyWord[viewer.skyPref] : "" },
      members: { label: "Shared with:", value: sharing ? String(sharing.people.length) : "" },
      notifications: { label: "Sent to:", value: viewer?.emailPrefs.to ?? "" },
      exports: { label: "Responses:", value: formsList ? formsList.responses.toLocaleString("en-US") : "" },
    }[t.value],
  }));

  const firstName = (viewer?.name ?? "").trim().split(/\s+/)[0] || (viewer ? "there" : "");

  /**
   * The chrome leads with the person. A second line names the company when
   * there is one and counts them when there are several — nothing when solo.
   */
  const orgLine = viewer?.companies.length
    ? viewer.companies.length === 1
      ? viewer.companies[0]!.name
      : `${viewer.companies.length} companies`
    : "";

  const heroes: Record<string, { eyebrow: string; title: string; sub: string }> = {
    home: {
      eyebrow: clock?.today ?? "",
      title: [clock ? greeting(clock.hour) : "Hello", firstName].filter(Boolean).join(", "),
      sub: !counts
        ? ""
        : counts.all
          ? "Here's what's happening with your forms."
          : "Nothing here yet. One form is all it takes to start.",
    },
    forms: {
      eyebrow: orgLine,
      title: "Forms",
      sub: !counts
        ? ""
        : counts.all
          ? `${counts.all} forms, ${live} of them collecting right now.`
          : "No forms yet — create one, or lift a template.",
    },
    responses: {
      eyebrow: orgLine,
      title: "Responses",
      sub: "Everything people have sent you, in one inbox.",
    },
    analytics: {
      eyebrow: orgLine,
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

  const frame = (
    <div className="fk-app">
      <a className="fk-skip" href="#fk-app-main">
        Skip to content
      </a>

      <header
        className="fk-app-head"
        ref={headerRef}
        data-dock={showDock || editorId ? "true" : undefined}
        style={{ paddingBottom: showDock || editorId ? undefined : BAND_PAD }}
      >
        {/* Evening until the clock is read, so the server and the first
            client render agree. */}
        <AppSky
          period={
            viewer && viewer.skyPref !== "sync"
              ? viewer.skyPref
              : clock
                ? periodFor(clock.hour)
                : "evening"
          }
        />

        <div className="fk-app-bar">
          <div className="fk-app-bar-left">
            <span className="fk-app-menu fk-only-narrow">
              <button
                type="button"
                className="fk-ring-btn"
                data-on-sky="true"
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
              {/* A narrow phone has room for the mark or the actions, not both. */}
              <span className="fk-app-logo-full">
                <Logo tone="inverse" />
              </span>
              <span className="fk-app-logo-mark">
                <Logo tone="inverse" wordmark={false} size={24} />
              </span>
            </Link>
          </div>

          <div className="fk-app-bar-right">
            <button type="button" className="fk-cta fk-only-wide" onClick={() => setCreateOpen(true)}>
              <Plus size={16} strokeWidth={1.9} aria-hidden />
              Create form
            </button>
            <button
              type="button"
              className="fk-ring-btn fk-only-narrow"
              data-on-sky="true"
              aria-label="Create form"
              onClick={() => setCreateOpen(true)}
            >
              <Plus size={18} strokeWidth={1.8} aria-hidden />
            </button>

            <button
              type="button"
              className="fk-ring-btn"
              data-on-sky="true"
              aria-label="Search"
              onClick={() => setPaletteOpen(true)}
            >
              <Search size={18} strokeWidth={1.8} aria-hidden />
            </button>

            <span className="fk-bell">
              <button
                type="button"
                className="fk-ring-btn"
                data-on-sky="true"
                aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}
                onClick={() => setBellOpen(true)}
              >
                <Bell size={18} strokeWidth={1.8} aria-hidden />
              </button>
              {unread > 0 && <span className="fk-bell-count">{unread > 99 ? "99+" : unread}</span>}
            </span>

            <span className="fk-account">
              <AvatarPill
                name={viewer?.name ?? ""}
                image={viewer?.image ?? null}
                expanded={accountOpen}
                onClick={() => setAccountOpen((v) => !v)}
              />
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
                {/* Held open while loading, so the page does not shift when it lands. */}
                {hero && <p>{hero.sub || "\u00a0"}</p>}
              </div>
            </div>

            {showDock && inSettings && (
              <div className="fk-dock">
                {settingsDock.map((d) => (
                  <ClientTab
                    key={d.key}
                    href={d.href}
                    name={d.name}
                    meta={d.meta}
                    mark={d.icon}
                    active={d.key === settingsTab}
                  >
                    {d.key === settingsTab && <TabSummary label={d.label} value={d.value} />}
                  </ClientTab>
                ))}
              </div>
            )}
            {showDock && !inSettings && (
              <div className="fk-dock">
                {dock.map((d) => (
                  <ClientTab
                    key={d.key}
                    href={d.href}
                    name={d.name}
                    meta={d.meta}
                    mark={d.icon}
                    active={d.key === current}
                  >
                    {d.key === current && (
                      <TabSummary label={d.label} value={d.value} tone="up" />
                    )}
                  </ClientTab>
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
              {inSettings ? (
                <PillTabs
                  ariaLabel="Settings sections"
                  tabs={SETTINGS_TABS.map((t) => ({
                    value: t.value,
                    label: t.label,
                    icon: <t.icon size={16} strokeWidth={1.8} aria-hidden />,
                  }))}
                  value={settingsTab}
                  onChange={(next) => router.replace(settingsHref(next), { scroll: false })}
                />
              ) : (
                <PillTabs
                  ariaLabel="Sections"
                  tabs={nav.map((n) => ({ value: n.value, label: n.label, icon: n.icon }))}
                  value={current}
                  onChange={(next) => {
                    const target = nav.find((n) => n.value === next);
                    if (target) router.push(target.href);
                  }}
                />
              )}
            </div>
          </div>
        </div>
      )}

      <main className="fk-app-main" id="fk-app-main">
        {children}
      </main>

      {createOpen && <CreateFormDialog onClose={() => setCreateOpen(false)} />}
      {bellOpen && <NotificationsDrawer onClose={() => setBellOpen(false)} />}
      {paletteOpen && (
        <CommandPalette onClose={() => setPaletteOpen(false)} onCreate={() => setCreateOpen(true)} />
      )}
      {viewer?.ai.allowed && <AskDock />}
      <AppScrollbar />
    </div>
  );

  // A support view is the customer's account alone: none of the staff member's
  // own greeting, tabs or actions, so the two can never be confused.
  if (supportUser) {
    return (
      <div className="fk-app fk-support">
        <SupportBanner who={search.get("who") || "this account"} />
        <main className="fk-app-main" id="fk-app-main">
          <SupportView userId={supportUser} />
        </main>
      </div>
    );
  }

  // Ask Formkit exists only for an account on the allow-list: without it the
  // provider holds nothing and there is no launcher or drawer to find. It is
  // always rendered, so the account loading never changes the tree's shape.
  return (
    <AskProvider userId={viewer?.ai.allowed ? viewer._id : null} limit={viewer?.ai.limit ?? 0} used={viewer?.ai.used ?? 0}>
      {frame}
    </AskProvider>
  );
}
