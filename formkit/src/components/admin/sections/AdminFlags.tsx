"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Badge, Button, Field, Input, Switch } from "@/components/ui";
import { useToast } from "@/components/ui/Toast";

/**
 * Feature flags: on or off, and when on, the share of accounts that get it.
 *
 * The list is fixed - each flag is read somewhere in the product, and a flag
 * nothing reads would be a switch that does nothing. Raising the rollout keeps
 * everyone who already had it; lowering it takes the most recent away first.
 */
export function AdminFlags() {
  const flags = useQuery(api.admin.flags, {});
  return (
    <>
      {(flags ?? []).map((f) => (
        <FlagPanel key={f.key} flag={f} />
      ))}
    </>
  );
}

type Flag = {
  key: string;
  label: string;
  description: string;
  enabled: boolean;
  rollout: number;
  changed: boolean;
};

function FlagPanel({ flag }: { flag: Flag }) {
  const toast = useToast();
  const save = useMutation(api.admin.saveFlag);
  const [rollout, setRollout] = useState<string | null>(null);
  const typed = rollout ?? String(flag.rollout);
  const pct = Math.max(0, Math.min(100, Number(typed) || 0));

  return (
    <section className="fk-panel">
      <div style={{ display: "flex", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 240 }}>
          <h3 style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            {flag.label}
            {!flag.changed && <Badge tone="neutral">Default</Badge>}
          </h3>
          <p className="fk-panel-lede" style={{ marginBottom: 0 }}>
            {flag.description}
          </p>
          <p className="fk-admin-quiet" style={{ margin: "8px 0 0" }}>
            {flag.key} · {flag.enabled ? (flag.rollout >= 100 ? "every account" : `${flag.rollout}% of accounts`) : "off for everyone"}
          </p>
        </div>
        <Switch
          checked={flag.enabled}
          label={flag.label}
          onChange={async (on) => {
            await save({ key: flag.key, enabled: on, rollout: flag.rollout });
            toast(`${flag.label} ${on ? "on" : "off"}`, {
              detail: on ? `For ${flag.rollout >= 100 ? "every account" : `${flag.rollout}% of accounts`}.` : "For everyone, straight away.",
            });
          }}
        />
      </div>
      {flag.enabled && (
        <div style={{ display: "flex", alignItems: "flex-end", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
          <Field label="Rollout" help="The share of accounts that get it. The same accounts stay in as it rises.">
            <Input type="number" min={0} max={100} value={typed} onChange={(e) => setRollout(e.target.value)} wrapStyle={{ width: 110 }} />
          </Field>
          <Button
            size="sm"
            disabled={rollout === null || pct === flag.rollout}
            onClick={async () => {
              await save({ key: flag.key, enabled: true, rollout: pct });
              setRollout(null);
              toast(`${flag.label} for ${pct}% of accounts`);
            }}
          >
            Save
          </Button>
          {flag.rollout < 100 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={async () => {
                await save({ key: flag.key, enabled: true, rollout: 100 });
                setRollout(null);
                toast(`${flag.label} for every account`);
              }}
            >
              Everyone
            </Button>
          )}
        </div>
      )}
    </section>
  );
}
