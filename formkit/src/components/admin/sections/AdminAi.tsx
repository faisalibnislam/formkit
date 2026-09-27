"use client";

import { useMutation, useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Badge, Button, EmptyState, Field, Input, Switch } from "@/components/ui";
import { useToast } from "@/components/ui/Toast";

/**
 * The AI allow-list.
 *
 * Off is the default and it is a real off: an account without access sees no
 * launcher, no locked state and no mention of Ask Formkit anywhere.
 */
export function AdminAi() {
  const toast = useToast();
  const stats = useQuery(api.admin.overview, {});
  const allowed = useQuery(api.admin.users, { only: "ai" });
  const setAiAccess = useMutation(api.admin.setAiAccess);
  const setAiPlatform = useMutation(api.admin.setAiPlatform);

  return (
    <>
      <section className="fk-panel">
        <h3>Platform settings</h3>
        <p className="fk-panel-lede">
          The default limit applies to anyone without a limit of their own. Pausing stops every
          request at once and remembers the allow-list.
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Field label="Default monthly credits">
            <Input
              type="number"
              min={0}
              defaultValue={stats?.aiDefault ?? 5}
              onBlur={async (e) => {
                await setAiPlatform({ defaultLimit: Number(e.target.value) });
                toast(`The default is now ${e.target.value} a month`);
              }}
              style={{ maxWidth: 160 }}
            />
          </Field>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ flex: 1, fontSize: 14.5 }}>
              Model: Gemini
              <span style={{ display: "block", marginTop: 2, fontSize: 13, color: "var(--color-text-tertiary)" }}>
                {stats?.aiModelReady
                  ? "Connected. The key is set on the deployment."
                  : "Not connected. Set GEMINI_API_KEY in the Convex deployment's environment variables."}
              </span>
            </span>
            {stats && <Badge tone={stats.aiModelReady ? "success" : "warning"}>{stats.aiModelReady ? "Connected" : "No key"}</Badge>}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ flex: 1, fontSize: 14.5 }}>
              {stats?.aiPaused ? "Paused for everyone" : "Running"}
            </span>
            <Switch
              checked={!stats?.aiPaused}
              label="Ask Formkit is running"
              onChange={(on) => setAiPlatform({ paused: !on })}
            />
          </div>
        </div>
      </section>

      <section className="fk-panel" data-pad="none">
        <div style={{ padding: "22px 24px 8px" }}>
          <h3 style={{ margin: 0 }}>Who has it</h3>
          <p className="fk-panel-lede" style={{ margin: "6px 0 0" }}>
            Turn it on for somebody from their entry under Users.
          </p>
        </div>
        {(allowed ?? []).length === 0 ? (
          <div style={{ padding: "8px 24px 24px" }}>
            <EmptyState
              title="Nobody yet"
              description="Ask Formkit is off for every account until you turn it on for a named person."
            />
          </div>
        ) : (
          <div className="fk-rows" style={{ marginTop: 10 }}>
            {(allowed ?? []).map((u) => (
              <div key={u._id} className="fk-row" data-static="true">
                <span className="fk-row-main">
                  <span className="fk-row-title">{u.name || u.email}</span>
                  <span className="fk-row-meta">
                    {u.email} · {u.ai.used} of {u.ai.limit} used this month
                  </span>
                </span>
                <span className="fk-row-side">
                  {u.ai.used >= u.ai.limit && <Badge tone="warning">Out of credits</Badge>}
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
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={async () => {
                      await setAiAccess({ userId: u._id, enabled: false });
                      toast("Turned off", {
                        detail: "Every AI surface disappears from their app.",
                      });
                    }}
                  >
                    Turn off
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
