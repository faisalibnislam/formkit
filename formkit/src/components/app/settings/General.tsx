"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import { Clock, Sparkles } from "lucide-react";
import { api } from "../../../../convex/_generated/api";
import { periodFor, type SkyPeriod } from "@/components/brand/AppSky";
import { Badge, Button, Segmented } from "@/components/ui";
import { useToast } from "@/components/ui/Toast";
import { Panel } from "./bits";

/**
 * Settings → Preferences. The AI card exists only for an account that has
 * been allowed Ask Formkit — nobody else sees a word about it here.
 */

type Pref = "sync" | SkyPeriod;

export function GeneralSection() {
  const toast = useToast();
  const viewer = useQuery(api.users.viewer, {});
  const save = useMutation(api.users.setPreferences);
  const [clock, setClock] = useState<{ hour: number; label: string } | null>(null);

  useEffect(() => {
    const read = () => {
      const d = new Date();
      setClock({ hour: d.getHours(), label: d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) });
    };
    const first = window.setTimeout(read, 0);
    const every = window.setInterval(read, 30_000);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(every);
    };
  }, []);

  if (!viewer) return null;
  const pref = viewer.skyPref as Pref;
  const now = clock ? periodFor(clock.hour) : "evening";
  const left = Math.max(0, viewer.ai.limit - viewer.ai.used);

  return (
    <>
      {viewer.ai.allowed && (
        <Panel
          title="Form building with AI"
          lede={`Describe a form in a sentence and Formkit writes it — ${left} of ${viewer.ai.limit} left this month. Rewriting questions, logic rules and themes are free.`}
          aside={<Badge tone="success">On</Badge>}
        >
          <div className="fk-setpanel-actions">
            <Link href="/app/ask">
              <Button variant="secondary" iconLeft={<Sparkles size={16} strokeWidth={1.8} aria-hidden />}>
                Open Ask Formkit
              </Button>
            </Link>
          </div>
        </Panel>
      )}

      <Panel title="Appearance" lede="The sky behind your dashboard. Synced to your own clock, or pinned to one time of day.">
        <Segmented
          ariaLabel="Dashboard sky"
          value={pref}
          onChange={async (next) => {
            await save({ skyPref: next });
            toast(next === "sync" ? "Sky follows your clock" : `Sky pinned to ${next}`);
          }}
          options={[
            { value: "sync", label: "Sync with time" },
            { value: "morning", label: "Morning" },
            { value: "afternoon", label: "Afternoon" },
            { value: "evening", label: "Evening" },
          ]}
        />
        <p className="fk-setpanel-note">
          <Clock size={15} strokeWidth={1.8} aria-hidden />
          <span>
            {pref === "sync"
              ? clock
                ? `It is ${clock.label} for you, so the ${now} sky is showing.`
                : "The sky follows the time where you are."
              : `Pinned to ${pref}. Your greeting still follows the clock.`}
          </span>
        </p>
      </Panel>
    </>
  );
}
