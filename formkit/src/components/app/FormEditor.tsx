"use client";

import { useSearchParams } from "next/navigation";
import type { Id } from "../../../convex/_generated/dataModel";
import { Analytics } from "./Analytics";
import { ResponsesInbox } from "./ResponsesInbox";
import { Builder } from "./editor/Builder";
import { DesignTab } from "./editor/DesignTab";
import { FormSettingsTab } from "./editor/FormSettingsTab";
import { LogicTab } from "./editor/LogicTab";

/**
 * The editor body. Its header - title, publish, the dock of tabs - belongs to
 * the shell, which reads the same `?tab=` this does.
 */
export function FormEditor({ formId }: { formId: Id<"forms"> }) {
  const search = useSearchParams();
  const tab = search.get("tab") ?? "build";

  if (tab === "design") return <DesignTab formId={formId} />;
  if (tab === "logic") return <LogicTab formId={formId} />;
  if (tab === "responses")
    return <ResponsesInbox formId={formId} openId={search.get("open")} />;
  if (tab === "analytics") return <Analytics formId={formId} />;
  if (tab === "settings") return <FormSettingsTab formId={formId} />;
  return <Builder formId={formId} />;
}
