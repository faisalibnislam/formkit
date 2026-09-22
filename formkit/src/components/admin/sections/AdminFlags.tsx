"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Button, EmptyState, Field, Input, Switch } from "@/components/ui";
import { useToast } from "@/components/ui/Toast";

/** Feature flags: on or off, with the share of accounts that see them. */
export function AdminFlags() {
  const toast = useToast();
  const flags = useQuery(api.admin.flags, {});
  const save = useMutation(api.admin.saveFlag);
  const [key, setKey] = useState("");
  const [label, setLabel] = useState("");
  const [description, setDescription] = useState("");

  return (
    <>
      {(flags ?? []).map((f) => (
        <section key={f._id} className="fk-panel">
          <div style={{ display: "flex", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 240 }}>
              <h3>{f.label}</h3>
              <p className="fk-panel-lede" style={{ marginBottom: 0 }}>
                {f.description}
              </p>
              <p style={{ margin: "8px 0 0", fontSize: 13, color: "var(--color-text-tertiary)" }}>
                {f.key} · {f.rollout}% of accounts
              </p>
            </div>
            <Switch
              checked={f.enabled}
              label={f.label}
              onChange={async (on) => {
                await save({ ...f, flagId: f._id, enabled: on });
                toast(`${f.label} ${on ? "on" : "off"}`);
              }}
            />
          </div>
          <div style={{ marginTop: 14, maxWidth: 220 }}>
            <Field label="Rollout %">
              <Input
                type="number"
                min={0}
                max={100}
                defaultValue={f.rollout}
                onBlur={(e) => save({ ...f, flagId: f._id, rollout: Number(e.target.value) })}
              />
            </Field>
          </div>
        </section>
      ))}

      {flags && flags.length === 0 && (
        <section className="fk-panel">
          <EmptyState title="No flags" description="Add one below and it appears here." />
        </section>
      )}

      <section className="fk-panel">
        <h3>Add a flag</h3>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <Field label="Key" help="What the code checks, in lower case with dots.">
            <Input value={key} onChange={(e) => setKey(e.target.value)} placeholder="export.xlsx" />
          </Field>
          <Field label="Name">
            <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Excel export" />
          </Field>
          <Field label="What it does">
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Adds an .xlsx option beside the CSV download."
            />
          </Field>
          <div>
            <Button
              disabled={!key.trim() || !label.trim()}
              onClick={async () => {
                await save({ key, label, description, enabled: false, rollout: 0 });
                toast(`${label} added`, { detail: "It is off until you turn it on." });
                setKey("");
                setLabel("");
                setDescription("");
              }}
            >
              Add the flag
            </Button>
          </div>
        </div>
      </section>
    </>
  );
}
