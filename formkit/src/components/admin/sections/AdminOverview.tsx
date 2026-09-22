"use client";

import { useMutation, useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Switch } from "@/components/ui";
import { Stat } from "@/components/app/bits";
import { useToast } from "@/components/ui/Toast";

/** What the platform is doing right now, counted from stored data. */
export function AdminOverview() {
  const toast = useToast();
  const stats = useQuery(api.admin.overview, {});
  const setAiPlatform = useMutation(api.admin.setAiPlatform);
  if (!stats) return null;

  return (
    <>
      <div className="fk-grid" data-cols="stats">
        <Stat label="Accounts" value={stats.users} note={`${stats.newUsers} in the last week`} />
        <Stat label="Forms" value={stats.forms} note={`${stats.live} collecting`} />
        <Stat
          label="Responses"
          value={stats.responses}
          note={`${stats.responsesWeek} in the last week`}
        />
        <Stat
          label="On the AI allow-list"
          value={stats.aiAllowed}
          note={`${stats.aiUsed} credits used this month`}
        />
      </div>

      <section className="fk-panel">
        <h3>Ask Formkit, platform-wide</h3>
        <p className="fk-panel-lede">
          Pausing suspends it for everyone at once without forgetting who was allowed. Nobody on the
          allow-list loses their place.
        </p>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ flex: 1, fontSize: 14.5 }}>
            {stats.aiPaused ? "Paused for everyone" : "Running"}
          </span>
          <Switch
            checked={!stats.aiPaused}
            label="Ask Formkit is running"
            onChange={async (on) => {
              await setAiPlatform({ paused: !on });
              toast(on ? "Ask Formkit is running" : "Ask Formkit is paused for everyone");
            }}
          />
        </div>
      </section>

      <div className="fk-grid" data-cols="two">
        <Stat label="Open reports" value={stats.openReports} />
        <Stat label="Open tickets" value={stats.openTickets} />
        <Stat label="Suspended accounts" value={stats.deactivated} />
        <Stat label="Staff" value={stats.staff} note="People who can reach this console" />
      </div>
    </>
  );
}
