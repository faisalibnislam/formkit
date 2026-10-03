"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { ArrowRight } from "lucide-react";
import { api } from "../../../../convex/_generated/api";
import { Button, ProgressBar, Segmented, Switch } from "@/components/ui";
import { relativeTime } from "@/components/app/bits";
import { StatCard } from "@/components/app/ds";
import { useToast } from "@/components/ui/Toast";

/**
 * What the platform is doing, from the hourly count (convex/adminTally.ts) and,
 * for what staff act on, live: the headline numbers
 * over 30 or 90 days, who is in what standing, sign-ups a day, Ask Formkit
 * against what accounts could spend, and the things waiting on staff.
 */
export function AdminOverview() {
  const toast = useToast();
  const router = useRouter();
  const [range, setRange] = useState<30 | 90>(30);
  const stats = useQuery(api.admin.overview, { range });
  const setAiPlatform = useMutation(api.admin.setAiPlatform);
  const refresh = useMutation(api.admin.refreshOverview);
  const [counting, setCounting] = useState(false);

  // Nothing counted yet (a fresh deployment): count now rather than wait an hour.
  const asked = useRef(false);
  useEffect(() => {
    if (stats?.asOf !== null || asked.current) return;
    asked.current = true;
    void refresh({}).catch(() => {});
  }, [stats?.asOf, refresh]);

  if (!stats) return null;

  const peak = Math.max(1, ...stats.signups);
  const total = stats.standing.active + stats.standing.suspended + stats.standing.deleting || 1;
  const go = (href: string) => router.push(href, { scroll: false });

  const waiting = [
    { label: "Forms reported", count: stats.openReports, href: "/admin?section=moderation" },
    { label: "Support waiting", count: stats.openTickets, href: "/admin?section=support" },
    { label: "Suspended users", count: stats.standing.suspended, href: "/admin?section=users&status=suspended" },
    { label: "Out of AI credits", count: stats.aiOutOfCredits, href: "/admin?section=ai" },
  ];

  return (
    <>
      <div className="fk-admin-bar">
        <Segmented
          ariaLabel="Range"
          value={String(range) as "30" | "90"}
          onChange={(v) => setRange(Number(v) as 30 | 90)}
          options={[
            { value: "30", label: "30 days" },
            { value: "90", label: "90 days" },
          ]}
        />
        <span className="fk-admin-quiet">Everything below counts the last {range} days unless it says otherwise.</span>
        <span className="fk-section-spacer" />
        <span className="fk-admin-quiet">
          {stats.asOf ? `Counted ${relativeTime(stats.asOf)}` : "Counting for the first time…"}
        </span>
        <Button
          variant="secondary"
          size="sm"
          disabled={counting || !stats.asOf}
          onClick={async () => {
            setCounting(true);
            try {
              await refresh({});
              toast("Counting again", { detail: "The numbers update in a minute or so." });
            } finally {
              setCounting(false);
            }
          }}
        >
          Refresh
        </Button>
      </div>

      <div className="fk-grid" data-cols="stats-sm">
        <StatCard label="New users" value={stats.newInRange.toLocaleString()} caption={`${stats.users.toLocaleString()} accounts in all`} />
        <StatCard label="Live forms" value={stats.live.toLocaleString()} caption={`of ${stats.forms.toLocaleString()} forms`} />
        <StatCard label="Responses" value={stats.responsesInRange.toLocaleString()} caption={`${stats.responses.toLocaleString()} in all`} />
        <StatCard label="AI forms built" value={stats.aiFormsBuilt.toLocaleString()} caption={`${stats.aiAllowed} accounts have Ask Formkit`} />
      </div>

      <div className="fk-grid" data-cols="two">
        <section className="fk-panel">
          <h3>Sign-ups a day</h3>
          <p className="fk-panel-lede">{stats.newInRange.toLocaleString()} new accounts in {range} days, not counting staff.</p>
          <div className="fk-admin-bars" role="img" aria-label={`Sign-ups a day over the last ${range} days, peaking at ${peak}`}>
            {stats.signups.map((n, i) => (
              <span key={i} style={{ height: `${Math.max(2, (n / peak) * 100)}%` }} data-zero={n === 0 ? "true" : undefined} />
            ))}
          </div>
          <div className="fk-admin-axis">
            <span>{range} days ago</span>
            <span>Today</span>
          </div>
        </section>

        <section className="fk-panel">
          <h3>Accounts by standing</h3>
          <p className="fk-panel-lede">Customers only; staff are counted apart.</p>
          <div className="fk-admin-standing">
            {[
              { label: "Active", n: stats.standing.active, color: "var(--green-400)" },
              { label: "Suspended", n: stats.standing.suspended, color: "var(--red-400)" },
              { label: "Leaving, in their 30 days", n: stats.standing.deleting, color: "var(--yellow-400)" },
            ].map((row) => (
              <div key={row.label}>
                <div className="fk-admin-standing-row">
                  <span>{row.label}</span>
                  <strong>{row.n.toLocaleString()}</strong>
                </div>
                <ProgressBar value={(row.n / total) * 100} color={row.color} />
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="fk-grid" data-cols="two">
        <section className="fk-panel">
          <h3>Ask Formkit this month</h3>
          <p className="fk-panel-lede">
            {stats.aiUsed.toLocaleString()} of {stats.aiCapacity.toLocaleString()} credits accounts could spend this month.
          </p>
          <ProgressBar value={stats.aiCapacity ? (stats.aiUsed / stats.aiCapacity) * 100 : 0} />
          <div className="fk-admin-row" style={{ marginTop: 18 }}>
            <span style={{ flex: 1 }}>
              {stats.aiPaused ? "Paused for everyone" : "Running"}
              <span className="fk-admin-quiet" style={{ display: "block" }}>
                Pausing stops every request at once; nothing else changes.
              </span>
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

        <section className="fk-panel">
          <h3>Needs a look</h3>
          <p className="fk-panel-lede">Anything here is waiting on somebody on the team.</p>
          <div className="fk-rows">
            {waiting.map((w) => (
              <button key={w.label} type="button" className="fk-row" onClick={() => go(w.href)}>
                <span className="fk-row-main">
                  <span className="fk-row-title">{w.label}</span>
                </span>
                <span className="fk-admin-count" data-zero={w.count === 0 ? "true" : undefined}>
                  {w.count}
                </span>
                <ArrowRight size={16} strokeWidth={1.8} aria-hidden />
              </button>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}
