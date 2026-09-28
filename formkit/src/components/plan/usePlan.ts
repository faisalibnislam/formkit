"use client";

import { useCallback } from "react";
import { useQuery } from "convex/react";
import { ConvexError } from "convex/values";
import { api } from "../../../convex/_generated/api";
import { FEATURES, type Feature, type PlanId, type PlanSummary } from "../../../convex/model/plans";

/** The signed-in account's plan, or undefined while it loads. */
export function usePlan(): PlanSummary | undefined {
  const viewer = useQuery(api.users.viewer, {});
  return (viewer?.plan ?? undefined) as PlanSummary | undefined;
}

const OPEN = "fk:upgrade";

export type UpgradeAsk = { feature?: Feature; plan?: PlanId };

/** Opens the upgrade sheet, on a feature or a plan. */
export function openUpgrade(ask: UpgradeAsk = {}) {
  window.dispatchEvent(new CustomEvent<UpgradeAsk>(OPEN, { detail: ask }));
}

export function onUpgradeRequest(fn: (ask: UpgradeAsk) => void) {
  const handler = (e: Event) => fn((e as CustomEvent<UpgradeAsk>).detail ?? {});
  window.addEventListener(OPEN, handler);
  return () => window.removeEventListener(OPEN, handler);
}

/**
 * A server refusal because of the plan carries the feature it was about;
 * this turns it into the upgrade sheet. Returns true when it did.
 */
export function upgradeOnPlanError(e: unknown) {
  if (e instanceof ConvexError && e.data && typeof e.data === "object" && (e.data as { code?: string }).code === "plan") {
    const d = e.data as { feature?: Feature; plan?: PlanId };
    openUpgrade({ feature: d.feature, plan: d.plan });
    return true;
  }
  return false;
}

/**
 * Whether a feature is available here, and a guard for acting on it: a locked
 * feature opens the upgrade sheet instead of running.
 *
 * `features`, when given, is the feature set that applies in this place — the
 * form owner's plan inside a form — instead of the viewer's own.
 */
export function useGate(feature: Feature, features?: Record<string, boolean> | null) {
  const plan = usePlan();
  const set = features ?? plan?.features;
  // Until the plan has loaded nothing is shown as locked, so nothing flickers.
  const locked = set ? !set[feature] : false;
  const needs = FEATURES[feature].plan;
  const guard = useCallback(
    <A extends unknown[]>(fn: (...args: A) => unknown) =>
      (...args: A) => {
        if (locked) {
          openUpgrade({ feature });
          return;
        }
        return fn(...args);
      },
    [locked, feature],
  );
  return { locked, needs, guard };
}
