"use client";

import { useEffect } from "react";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import type { Id } from "../../../convex/_generated/dataModel";
import { Builder } from "./editor/Builder";

/**
 * Build opens first and ships with the page; the other tabs are fetched in
 * the background once the editor is up, so the first load carries one tab
 * and switching still never waits. Tabs change through a link, so even an
 * early switch keeps the current tab on screen until the next has arrived.
 */
const TABS = {
  design: () => import("./editor/DesignTab").then((m) => m.DesignTab),
  logic: () => import("./editor/LogicTab").then((m) => m.LogicTab),
  responses: () => import("./ResponsesInbox").then((m) => m.ResponsesInbox),
  analytics: () => import("./Analytics").then((m) => m.Analytics),
  settings: () => import("./editor/FormSettingsTab").then((m) => m.FormSettingsTab),
};
const DesignTab = dynamic(TABS.design);
const LogicTab = dynamic(TABS.logic);
const ResponsesInbox = dynamic(TABS.responses);
const Analytics = dynamic(TABS.analytics);
const FormSettingsTab = dynamic(TABS.settings);
const PREFETCH_AFTER_MS = 1500;

/**
 * The editor body. Its header - title, publish, the dock of tabs - belongs to
 * the shell, which reads the same `?tab=` this does.
 */
export function FormEditor({ formId }: { formId: Id<"forms"> }) {
  const search = useSearchParams();
  const tab = search.get("tab") ?? "build";

  useEffect(() => {
    const t = window.setTimeout(() => Object.values(TABS).forEach((load) => void load()), PREFETCH_AFTER_MS);
    return () => window.clearTimeout(t);
  }, []);

  if (tab === "design") return <DesignTab formId={formId} />;
  if (tab === "logic") return <LogicTab formId={formId} />;
  if (tab === "responses")
    return <ResponsesInbox formId={formId} openId={search.get("open")} />;
  if (tab === "analytics") return <Analytics formId={formId} />;
  if (tab === "settings") return <FormSettingsTab formId={formId} />;
  return <Builder formId={formId} />;
}
