"use client";

import { useCallback, useEffect, type ReactNode } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import {
  Building2,
  ChartPie,
  Coins,
  LifeBuoy,
  BookOpen,
  LogOut,
  MailCheck,
  Megaphone,
  ScrollText,
  ShieldAlert,
  Sparkles,
  ToggleRight,
  UserCog,
  Users,
  CreditCard,
  TrendingUp,
} from "lucide-react";
import { api } from "../../../convex/_generated/api";
import { Logo } from "@/components/brand/Logo";
import { Button } from "@/components/ui";
import { AdminOverview } from "./sections/AdminOverview";
import { AdminUsers } from "./sections/AdminUsers";
import { AdminCompanies } from "./sections/AdminCompanies";
import { AdminAi } from "./sections/AdminAi";
import { AdminModeration } from "./sections/AdminModeration";
import { AdminSupport } from "./sections/AdminSupport";
import { AdminHelp } from "./sections/AdminHelp";
import { AdminAnnouncements } from "./sections/AdminAnnouncements";
import { AdminMail } from "./sections/AdminMail";
import { AdminTeam } from "./sections/AdminTeam";
import { AdminFlags } from "./sections/AdminFlags";
import { AdminRevenue } from "./sections/AdminRevenue";
import { AdminAiCost } from "./sections/AdminAiCost";
import { AdminBilling } from "./sections/AdminBilling";
import { AdminAudit } from "./sections/AdminAudit";

/**
 * formkit.app/admin.
 *
 * Unlinked from the product and gated by who you are: staff get the console, a
 * signed-in customer is offered their dashboard, and a stranger is sent to the
 * marketing site. A section a person's permissions do not cover is not in the
 * rail at all.
 */
type Key =
  | "overview"
  | "users"
  | "companies"
  | "ai"
  | "moderation"
  | "support"
  | "help"
  | "announcements"
  | "mail"
  | "team"
  | "flags"
  | "billing"
  | "revenue"
  | "aicost"
  | "audit";

const SECTIONS: {
  key: Key;
  label: string;
  group: string;
  icon: ReactNode;
  permission?: string;
  title: string;
  lede: string;
}[] = [
  {
    key: "overview",
    label: "Overview",
    group: "",
    icon: <ChartPie size={17} strokeWidth={1.8} aria-hidden />,
    title: "Overview",
    lede: "Signups, how people are standing, and how much of the AI allowance is actually being used.",
  },
  {
    key: "users",
    label: "Users",
    group: "Customers",
    icon: <Users size={17} strokeWidth={1.8} aria-hidden />,
    permission: "users.view",
    title: "Users",
    lede: "Everyone on Formkit. Open someone to see their plan, change their AI limit, or change their standing.",
  },
  {
    key: "companies",
    label: "Companies",
    group: "Customers",
    icon: <Building2 size={17} strokeWidth={1.8} aria-hidden />,
    permission: "users.view",
    title: "Companies",
    lede: "Every company on Formkit, personal ones included. Open one to see who is in it and what it pays, and to give it Pro or Business free of charge.",
  },
  {
    key: "ai",
    label: "AI access",
    group: "Customers",
    icon: <Sparkles size={17} strokeWidth={1.8} aria-hidden />,
    permission: "ai.access",
    title: "AI access",
    lede: "Ask Formkit is on for every account, with monthly credits set by plan. Turn it off for one account, or pause it for everyone.",
  },
  {
    key: "revenue",
    label: "Plans and revenue",
    group: "Customers",
    icon: <TrendingUp size={17} strokeWidth={1.8} aria-hidden />,
    permission: "billing",
    title: "Plans and revenue",
    lede: "Who is on which plan, what it is worth each month, how that is moving, and where more could come from.",
  },
  {
    key: "aicost",
    label: "AI cost",
    group: "Customers",
    icon: <Coins size={17} strokeWidth={1.8} aria-hidden />,
    permission: "billing",
    title: "AI cost",
    lede: "What Gemini costs, by feature, model, plan and account, and how it compares with what each plan pays.",
  },
  {
    key: "billing",
    label: "Billing",
    group: "Customers",
    icon: <CreditCard size={17} strokeWidth={1.8} aria-hidden />,
    permission: "billing",
    title: "Billing",
    lede: "Plans, who is paying, and the Polar connection behind them.",
  },
  {
    key: "moderation",
    label: "Moderation",
    group: "Operations",
    icon: <ShieldAlert size={17} strokeWidth={1.8} aria-hidden />,
    permission: "moderation",
    title: "Moderation",
    lede: "Forms people have reported. Locking one stops it collecting; nothing already sent is deleted.",
  },
  {
    key: "support",
    label: "Support",
    group: "Operations",
    icon: <LifeBuoy size={17} strokeWidth={1.8} aria-hidden />,
    permission: "support",
    title: "Support",
    lede: "Questions customers have asked. Replies go out as Formkit.",
  },
  {
    key: "help",
    label: "Help centre",
    group: "Operations",
    icon: <BookOpen size={17} strokeWidth={1.8} aria-hidden />,
    permission: "support",
    title: "Help centre",
    lede: "What people searched for and did not find, and which articles did not help.",
  },
  {
    key: "announcements",
    label: "Announcements",
    group: "Operations",
    icon: <Megaphone size={17} strokeWidth={1.8} aria-hidden />,
    permission: "announcements",
    title: "Announcements",
    lede: "A message on every customer's dashboard. Short, factual, and never a sales pitch.",
  },
  {
    key: "mail",
    label: "Email log",
    group: "Operations",
    icon: <MailCheck size={17} strokeWidth={1.8} aria-hidden />,
    title: "Email log",
    lede: "Everything Formkit has sent on a customer's behalf, and what happened to it.",
  },
  {
    key: "team",
    label: "Team access",
    group: "Administrative",
    icon: <UserCog size={17} strokeWidth={1.8} aria-hidden />,
    permission: "team",
    title: "Team access",
    lede: "Who can reach this console, and exactly what each of them can do here.",
  },
  {
    key: "flags",
    label: "Feature flags",
    group: "Administrative",
    icon: <ToggleRight size={17} strokeWidth={1.8} aria-hidden />,
    permission: "flags",
    title: "Feature flags",
    lede: "Platform features, on or off, with a rollout share.",
  },
  {
    key: "audit",
    label: "Audit log",
    group: "Administrative",
    icon: <ScrollText size={17} strokeWidth={1.8} aria-hidden />,
    title: "Audit log",
    lede: "Every change made from this console, and who made it.",
  },
];

export function AdminConsole() {
  const router = useRouter();
  const { signOut } = useAuthActions();
  const me = useQuery(api.admin.who, {});
  const stats = useQuery(api.admin.overview, {});
  const noteSession = useMutation(api.admin.noteSession);
  const search = useSearchParams();
  // The section lives in the address, so a link can land on one - the support
  // view's "Leave", or "Needs a look" jumping to a filtered list.
  const key = (search.get("section") as Key | null) ?? "overview";
  const setKey = useCallback((next: Key) => router.push(`/admin?section=${next}`, { scroll: false }), [router]);

  // Staff coming in is audited like every other action, once a browser session.
  const staffId = me?.staff?._id;
  useEffect(() => {
    if (!staffId) return;
    try {
      if (window.sessionStorage.getItem("fk.admin.in") === staffId) return;
      window.sessionStorage.setItem("fk.admin.in", staffId);
    } catch {
      /* no session storage: audit every load instead */
    }
    void noteSession({ what: "in" }).catch(() => {});
  }, [staffId, noteSession]);

  if (me === undefined) return null;

  if (!me.staff) {
    // The console is unlinked: a customer is offered their dashboard, a
    // stranger the marketing site. Neither is told what is here.
    return (
      <div className="fk-admin-main" style={{ maxWidth: 560, margin: "0 auto", minHeight: "100dvh", justifyContent: "center" }}>
        <h1 style={{ margin: 0, fontSize: 32, fontWeight: 700, letterSpacing: "-.024em" }}>
          Not found
        </h1>
        <p style={{ margin: 0, fontSize: 16, lineHeight: 1.6, color: "var(--color-text-secondary)" }}>
          There is nothing at this address.
        </p>
        <div>
          <Link href={me.signedIn ? "/app" : "/"}>
            <Button>{me.signedIn ? "Back to your dashboard" : "Back to Formkit"}</Button>
          </Link>
        </div>
      </div>
    );
  }

  const allowed = SECTIONS.filter(
    (s) => !s.permission || me.staff!.permissions.includes(s.permission),
  );
  const current = allowed.find((s) => s.key === key) ?? allowed[0]!;

  // A group heading is drawn above the first section that belongs to it.
  const headings = allowed.map((s, i) =>
    s.group && s.group !== allowed[i - 1]?.group ? s.group : null,
  );

  return (
    <div className="fk-admin">
      <nav className="fk-admin-rail" aria-label="Admin sections">
        <div className="fk-admin-mark">
          <Logo />
          <span className="fk-admin-tag">ADMIN</span>
        </div>
        {allowed.map((s, i) => {
          const heading = headings[i];
          const count =
            s.key === "moderation"
              ? stats?.openReports
              : s.key === "support"
                ? stats?.openTickets
                : undefined;
          return (
            <div key={s.key}>
              {heading && <div className="fk-admin-section">{heading}</div>}
              <button
                type="button"
                className="fk-admin-link"
                data-active={s.key === current.key ? "true" : undefined}
                aria-current={s.key === current.key ? "page" : undefined}
                onClick={() => setKey(s.key)}
              >
                {s.icon}
                <span style={{ flex: 1, minWidth: 0 }}>{s.label}</span>
                {!!count && <span className="fk-admin-count">{count}</span>}
              </button>
            </div>
          );
        })}
        {/* Every staff role signs out from here. There is deliberately no link
            from the console back to the customer app. */}
        <div style={{ marginTop: "auto", paddingTop: 18 }}>
          <div className="fk-admin-whoami">
            <span>{me.staff.name}</span>
            <span>{me.staff.role}</span>
          </div>
          <button
            type="button"
            className="fk-admin-link"
            onClick={async () => {
              await noteSession({ what: "out" }).catch(() => {});
              try {
                window.sessionStorage.removeItem("fk.admin.in");
              } catch {
                /* nothing to clear */
              }
              await signOut();
              router.push("/");
            }}
          >
            <LogOut size={17} strokeWidth={1.8} aria-hidden />
            <span style={{ flex: 1, minWidth: 0 }}>Sign out</span>
          </button>
        </div>
      </nav>

      <main className="fk-admin-main">
        <header className="fk-admin-head">
          {current.group && <div className="fk-admin-eyebrow">{current.group}</div>}
          <h1>{current.title}</h1>
          <p>{current.lede}</p>
        </header>

        {current.key === "overview" && <AdminOverview />}
        {current.key === "users" && <AdminUsers permissions={me.staff.permissions} />}
        {current.key === "companies" && <AdminCompanies permissions={me.staff.permissions} />}
        {current.key === "ai" && <AdminAi />}
        {current.key === "moderation" && <AdminModeration />}
        {current.key === "support" && <AdminSupport />}
        {current.key === "help" && <AdminHelp />}
        {current.key === "announcements" && <AdminAnnouncements />}
        {current.key === "mail" && <AdminMail />}
        {current.key === "team" && <AdminTeam meId={me.staff._id} />}
        {current.key === "flags" && <AdminFlags />}
        {current.key === "billing" && <AdminBilling />}
        {current.key === "revenue" && <AdminRevenue />}
        {current.key === "aicost" && <AdminAiCost />}
        {current.key === "audit" && <AdminAudit />}
      </main>
    </div>
  );
}
