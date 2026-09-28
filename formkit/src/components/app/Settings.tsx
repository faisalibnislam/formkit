"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Bell, CircleUser, CreditCard, Download, ShieldCheck, SlidersHorizontal, Store, UsersRound, Users } from "lucide-react";
import { PillTabs } from "@/components/ui";
import { Scroller } from "./Scroller";
import { AccountSection } from "./settings/Account";
import { CompanySection } from "./settings/Company";
import { GeneralSection } from "./settings/General";
import { MembersSection } from "./settings/Members";
import { NotificationsSection } from "./settings/Notifications";
import { ExportsSection } from "./settings/Exports";
import { PlanSection } from "./settings/Plan";
import { TeamSection } from "./settings/Team";
import { ControlsSection } from "./settings/Controls";

/**
 * Account settings.
 *
 * Identity is person-first: the account is a person, companies are optional and
 * plural, and each identity can claim one link of its own.
 *
 * On a wide screen the sections are the header's own dock, as every other
 * page's records are; on a narrow one they sit in the page, since the band
 * cannot hold six readable tabs.
 */

export type SettingsTab =
  | "account"
  | "plan"
  | "company"
  | "team"
  | "general"
  | "members"
  | "notifications"
  | "exports"
  | "controls";

/** Older links and the account menu use these names. */
const ALIAS: Record<string, SettingsTab> = {
  companies: "company",
  sharing: "members",
  emails: "exports",
  preferences: "general",
  billing: "plan",
  security: "controls",
  audit: "controls",
  api: "controls",
};

export const SETTINGS_TABS: { value: SettingsTab; label: string; meta: string; icon: typeof CircleUser }[] = [
  { value: "account", label: "Account", meta: "Profile and password", icon: CircleUser },
  { value: "plan", label: "Plan", meta: "Plan, usage and billing", icon: CreditCard },
  { value: "company", label: "Companies", meta: "Optional — links, logos and brands", icon: Store },
  { value: "team", label: "Team", meta: "People on every form, approvals", icon: UsersRound },
  { value: "general", label: "Preferences", meta: "Dashboard appearance", icon: SlidersHorizontal },
  { value: "members", label: "Sharing", meta: "People with access", icon: Users },
  { value: "notifications", label: "Notifications", meta: "Email and alerts", icon: Bell },
  { value: "exports", label: "Exports", meta: "Excel, CSV and email", icon: Download },
  { value: "controls", label: "Controls", meta: "Audit, retention, API, sign-in", icon: ShieldCheck },
];

export function settingsTabOf(raw: string | null): SettingsTab {
  if (!raw) return "account";
  if (raw in ALIAS) return ALIAS[raw]!;
  return SETTINGS_TABS.some((t) => t.value === raw) ? (raw as SettingsTab) : "account";
}

export function settingsHref(tab: SettingsTab) {
  return tab === "account" ? "/app/settings" : `/app/settings?tab=${tab}`;
}

export function Settings() {
  const router = useRouter();
  const search = useSearchParams();

  /* The section is read from the URL rather than held in state, so the account
     menu's "Companies and branding" lands on that section even from inside
     Settings — a soft navigation does not remount this component. */
  const tab = settingsTabOf(search.get("tab"));

  // On a phone the tab strip scrolls; keep the open section's tab in view.
  useEffect(() => {
    document
      .querySelector(".fk-settings-tabs [aria-selected='true']")
      ?.scrollIntoView({ block: "nearest", inline: "center" });
  }, [tab]);

  return (
    <div className="fk-settings">
      <Scroller className="fk-settings-tabs-row fk-no-scrollbar" shellClassName="fk-settings-tabs">
        <PillTabs
          ariaLabel="Settings section"
          value={tab}
          onChange={(next) => router.replace(settingsHref(next), { scroll: false })}
          tabs={SETTINGS_TABS.map((t) => ({
            value: t.value,
            label: t.label,
            icon: <t.icon size={16} strokeWidth={1.8} aria-hidden />,
          }))}
        />
      </Scroller>

      {tab === "account" && <AccountSection />}
      {tab === "plan" && <PlanSection />}
      {tab === "company" && <CompanySection />}
      {tab === "general" && <GeneralSection />}
      {tab === "members" && <MembersSection />}
      {tab === "notifications" && <NotificationsSection />}
      {tab === "exports" && <ExportsSection />}
      {tab === "team" && <TeamSection />}
      {tab === "controls" && <ControlsSection />}
    </div>
  );
}
