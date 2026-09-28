"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { Search } from "lucide-react";
import { api } from "../../../../convex/_generated/api";
import { Badge, Button, EmptyState, Field, Input, PillTabs, ProgressBar } from "@/components/ui";
import { StatCard } from "@/components/app/ds";
import { useToast } from "@/components/ui/Toast";

/**
 * Ask Formkit across the platform.
 *
 * It is on for every account, with monthly credits set by plan (Free's
 * allowance is the default below). Staff can turn it off for one account, set
 * a personal limit, grant extra credits, or pause it for everyone.
 */
export function AdminAi() {
  const toast = useToast();
  const router = useRouter();
  const [term, setTerm] = useState("");
  const [show, setShow] = useState<"on" | "off" | "all">("on");
  const [draftDefault, setDraftDefault] = useState<string | null>(null);

  const stats = useQuery(api.admin.overview, {});
  const ai = useQuery(api.admin.aiStats, { search: term || undefined, show });
  const setAiAccess = useMutation(api.admin.setAiAccess);
  const setAiPlatform = useMutation(api.admin.setAiPlatform);

  const def = stats?.aiDefault ?? 5;
  const typed = draftDefault ?? String(def);

  return (
    <>
      <div className="fk-grid" data-cols="stats-sm">
        <StatCard label="Accounts with it on" value={stats ? stats.aiAllowed.toLocaleString() : "—"} />
        <StatCard label="Credits used this month" value={stats ? stats.aiUsed.toLocaleString() : "—"} caption={`of ${(stats?.aiCapacity ?? 0).toLocaleString()} they could spend`} />
        <StatCard label="Out of credits" value={stats ? stats.aiOutOfCredits.toLocaleString() : "—"} />
        <StatCard label="AI forms built" value={stats ? stats.aiFormsBuilt.toLocaleString() : "—"} caption="Last 30 days" />
      </div>

      <section className="fk-panel">
        <h3>Platform</h3>
        <p className="fk-panel-lede">
          Pausing stops every request at once, for everyone. Resuming brings it back with the credits people had left.
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="fk-admin-row">
            <span style={{ flex: 1 }}>
              Model: Gemini
              <span className="fk-admin-sub" style={{ whiteSpace: "normal" }}>
                {stats?.aiModelReady
                  ? "Connected. The key is set on the deployment."
                  : "Not connected. Set GEMINI_API_KEY in the Convex deployment's environment variables."}
              </span>
            </span>
            {stats && <Badge tone={stats.aiModelReady ? "success" : "warning"}>{stats.aiModelReady ? "Connected" : "No key"}</Badge>}
          </div>
          <div className="fk-admin-row">
            <span style={{ flex: 1 }}>
              {stats?.aiPaused ? "Paused for everyone" : "Running"}
              <span className="fk-admin-sub">{stats?.aiPaused ? "Nobody can use it until you resume." : "Every account can use it, within its credits."}</span>
            </span>
            <Button
              variant={stats?.aiPaused ? "primary" : "secondary"}
              size="sm"
              onClick={async () => {
                const pause = !stats?.aiPaused;
                await setAiPlatform({ paused: pause });
                toast(pause ? "Ask Formkit is paused for everyone" : "Ask Formkit is running again");
              }}
            >
              {stats?.aiPaused ? "Resume" : "Pause"}
            </Button>
          </div>

          <Field
            label="Free plan monthly credits"
            help="For Free accounts without a limit of their own (Pro gets 50, Business 200). Apply to all also clears every personal limit."
          >
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Input
                type="number"
                min={0}
                value={typed}
                onChange={(e) => setDraftDefault(e.target.value)}
                style={{ maxWidth: 120 }}
              />
              <Button
                size="sm"
                disabled={typed === "" || Number(typed) === def}
                onClick={async () => {
                  await setAiPlatform({ defaultLimit: Number(typed) });
                  setDraftDefault(null);
                  toast(`The default is now ${typed} a month`);
                }}
              >
                Save
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={async () => {
                  await setAiPlatform({ defaultLimit: Number(typed), applyToAll: true });
                  setDraftDefault(null);
                  toast(`Everyone is on ${typed} a month`, { detail: "Personal limits were cleared." });
                }}
              >
                Apply to all
              </Button>
              {stats?.aiDefaultPrevious != null && stats.aiDefaultPrevious !== def && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={async () => {
                    await setAiPlatform({ revert: true });
                    setDraftDefault(null);
                    toast(`Back to ${stats.aiDefaultPrevious} a month`);
                  }}
                >
                  Revert to {stats.aiDefaultPrevious}
                </Button>
              )}
            </div>
          </Field>
        </div>
      </section>

      <div className="fk-grid" data-cols="two">
        <section className="fk-panel">
          <h3>Heaviest use this month</h3>
          {ai && ai.heaviest.length === 0 ? (
            <p className="fk-admin-quiet" style={{ margin: 0 }}>Nobody has built a form with it yet this month.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {(ai?.heaviest ?? []).map((u) => (
                <div key={u._id}>
                  <div className="fk-admin-standing-row">
                    <span>{u.name || u.email}</span>
                    <strong>
                      {u.used} of {u.limit}
                    </strong>
                  </div>
                  <ProgressBar value={u.limit ? (u.used / u.limit) * 100 : 100} color={u.used >= u.limit ? "var(--red-400)" : undefined} />
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="fk-panel">
          <h3>Personal limits</h3>
          {ai && ai.overrides.length === 0 ? (
            <p className="fk-admin-quiet" style={{ margin: 0 }}>Everyone shown is on their plan&rsquo;s allowance.</p>
          ) : (
            <div className="fk-rows">
              {(ai?.overrides ?? []).map((u) => (
                <div key={u._id} className="fk-row" data-static="true">
                  <span className="fk-row-main">
                    <span className="fk-row-title">{u.name || u.email}</span>
                    <span className="fk-row-meta">
                      {u.override} a month{u.granted ? ` + ${u.granted} granted` : ""}
                    </span>
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={async () => {
                      await setAiAccess({ userId: u._id, useDefault: true });
                      toast("Back on the default", { detail: u.name || u.email });
                    }}
                  >
                    Use default
                  </Button>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <section className="fk-panel" data-pad="none">
        <div style={{ padding: "22px 24px 12px" }}>
          <h3 style={{ margin: 0 }}>Who is using it</h3>
          <p className="fk-panel-lede" style={{ margin: "6px 0 14px" }}>
            Change someone&rsquo;s limit or turn it off for them here, or from their entry under Users.
          </p>
          <div className="fk-toolbar" style={{ flexWrap: "wrap" }}>
            <PillTabs
              ariaLabel="Show"
              value={show}
              onChange={setShow}
              tabs={[
                { value: "on", label: "Used this month" },
                { value: "off", label: "Turned off" },
                { value: "all", label: "All with changes" },
              ]}
            />
            <span className="fk-toolbar-spacer" />
            <Input
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              placeholder="Search by name or email"
              icon={<Search size={17} strokeWidth={1.8} aria-hidden />}
              style={{ width: 240 }}
            />
          </div>
        </div>
        {ai && ai.rows.length === 0 ? (
          <div style={{ padding: "8px 24px 24px" }}>
            <EmptyState
              title={term ? "Nobody matches" : show === "on" ? "Nobody yet this month" : "Nobody here"}
              description={
                show === "on" && !term
                  ? "Nobody has built a form with Ask Formkit since the first of the month."
                  : "Try another search or filter."
              }
            />
          </div>
        ) : (
          <div className="fk-rows">
            {(ai?.rows ?? []).map((u) => (
              <div key={u._id} className="fk-row" data-static="true">
                <span className="fk-row-main">
                  <span className="fk-row-title">{u.name || u.email}</span>
                  <span className="fk-row-meta">
                    {u.email} · {u.enabled ? `${u.used} of ${u.limit} used this month` : "Turned off"}
                  </span>
                </span>
                <span className="fk-row-side">
                  {u.enabled && u.used >= u.limit && <Badge tone="warning">Out of credits</Badge>}
                  {u.enabled && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={async () => {
                        await setAiAccess({ userId: u._id, grant: 5 });
                        toast(`Five credits granted to ${u.name || u.email}`);
                      }}
                    >
                      Grant 5
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={async () => {
                      await setAiAccess({ userId: u._id, enabled: !u.enabled });
                      toast(u.enabled ? "Turned off" : "Turned on", {
                        detail: u.enabled ? "Every AI surface disappears from their app." : "It appears in their app straight away.",
                      });
                    }}
                  >
                    {u.enabled ? "Turn off" : "Turn on"}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => router.push(`/admin?section=users&open=${u._id}`)}>
                    Open
                  </Button>
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
