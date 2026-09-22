"use client";

import { useMutation, useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { Field, Input, PillTabs, Select, Switch } from "@/components/ui";
import { useToast } from "@/components/ui/Toast";
import { SIZE_SCALE, THEME_PRESETS, type Theme, themeOf } from "./themes";

/**
 * Design: the theme, and which identity the form goes out under.
 *
 * The preview beside the controls is the real published form's shell, painted
 * with the same values — not a picture of one.
 */
export function DesignTab({ formId }: { formId: Id<"forms"> }) {
  const toast = useToast();
  const form = useQuery(api.forms.get, { formId });
  const viewer = useQuery(api.users.viewer, {});
  const update = useMutation(api.forms.update);

  if (!form) return null;
  const theme = themeOf(form.theme);

  const set = (patch: Partial<Theme>) =>
    update({ formId, patch: { theme: { ...theme, ...patch } } });

  const scale = SIZE_SCALE[theme.size];

  return (
    <div className="fk-grid" data-cols="two">
      <div className="fk-settings">
        <section className="fk-panel">
          <h3>Theme</h3>
          <p className="fk-panel-lede">
            A starting point. Everything below stays yours to change afterwards.
          </p>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(104px, 1fr))",
              gap: 10,
            }}
          >
            {THEME_PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() =>
                  set({
                    preset: p.id,
                    bg: p.bg,
                    surface: p.surface,
                    text: p.text,
                    primary: p.primary,
                    radius: p.radius,
                  })
                }
                aria-pressed={theme.preset === p.id}
                style={{
                  padding: 10,
                  border: "none",
                  borderRadius: 18,
                  background: p.bg,
                  cursor: "pointer",
                  font: "inherit",
                  textAlign: "left",
                  boxShadow:
                    theme.preset === p.id
                      ? "0 0 0 2px var(--neutral-900)"
                      : "inset 0 0 0 1px var(--neutral-200)",
                }}
              >
                <span
                  style={{
                    display: "block",
                    height: 32,
                    borderRadius: Math.min(p.radius, 16),
                    background: p.surface,
                  }}
                />
                <span
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    marginTop: 8,
                    fontSize: 13,
                    color: p.text,
                  }}
                >
                  <span
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: "50%",
                      background: p.primary,
                    }}
                  />
                  {p.name}
                </span>
              </button>
            ))}
          </div>
        </section>

        <section className="fk-panel">
          <h3>Colours</h3>
          <p className="fk-panel-lede">
            Three values decide the look: the page, the ink and the accent on buttons.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {(
              [
                ["Background", "bg"],
                ["Text", "text"],
                ["Accent", "primary"],
              ] as const
            ).map(([label, key]) => (
              <div key={key} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ flex: 1, fontSize: 14.5 }}>{label}</span>
                <input
                  type="color"
                  value={theme[key]}
                  aria-label={label}
                  onChange={(e) => set({ [key]: e.target.value } as Partial<Theme>)}
                  style={{
                    width: 46,
                    height: 34,
                    padding: 0,
                    border: "none",
                    borderRadius: 10,
                    background: "transparent",
                    cursor: "pointer",
                  }}
                />
                <Input
                  inputSize="sm"
                  value={theme[key]}
                  aria-label={`${label} hex`}
                  onChange={(e) => set({ [key]: e.target.value } as Partial<Theme>)}
                  style={{ width: 110 }}
                />
              </div>
            ))}
          </div>
        </section>

        <section className="fk-panel">
          <h3>Type and layout</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <Field label="Text size">
              <Select
                value={theme.size}
                ariaLabel="Text size"
                onChange={(v) => set({ size: v as Theme["size"] })}
                options={[
                  { value: "Small", label: "Small" },
                  { value: "Medium", label: "Medium" },
                  { value: "Large", label: "Large" },
                ]}
              />
            </Field>
            <Field label="Corner radius">
              <Select
                value={String(theme.radius)}
                ariaLabel="Corner radius"
                onChange={(v) => set({ radius: Number(v) })}
                options={[
                  { value: "4", label: "Square-ish", note: "4 pixels" },
                  { value: "12", label: "Soft", note: "12 pixels" },
                  { value: "20", label: "Rounded", note: "20 pixels" },
                  { value: "28", label: "Very rounded", note: "28 pixels" },
                  { value: "999", label: "Pill", note: "Fully round" },
                ]}
              />
            </Field>
            <Field label="Width">
              <PillTabs
                ariaLabel="Width"
                value={theme.layout}
                onChange={(v) => set({ layout: v })}
                tabs={[
                  { value: "centered", label: "Centred" },
                  { value: "wide", label: "Wide" },
                  { value: "full", label: "Full screen" },
                ]}
              />
            </Field>
          </div>
        </section>

        <section className="fk-panel">
          <h3>Branding</h3>
          <p className="fk-panel-lede">
            A form goes out under you, or under one of your companies. Companies are optional —
            you are the account, they are hats you wear.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <Field label="Publish under" help={`This form is at ${form.url}`}>
              <Select
                value={form.brand}
                ariaLabel="Publish under"
                onChange={async (v) => {
                  await update({
                    formId,
                    patch: { brand: v === "me" ? "me" : (v as Id<"companies">) },
                  });
                  toast(
                    v === "me"
                      ? "Published under your own name"
                      : "Published under that company",
                  );
                }}
                options={[
                  { value: "me", label: `${viewer?.name ?? "You"} (you)`, note: viewer?.handle ? `formkit.app/${viewer.handle}` : "No link claimed yet" },
                  ...(viewer?.companies ?? []).map((c) => ({
                    value: c._id,
                    label: c.name,
                    note: c.handle ? `formkit.app/${c.handle}` : "No link claimed yet",
                  })),
                ]}
              />
            </Field>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ flex: 1, fontSize: 14.5 }}>Show the logo on the form</span>
              <Switch
                checked={theme.showLogo}
                label="Show the logo on the form"
                onChange={(on) => set({ showLogo: on })}
              />
            </div>
          </div>
        </section>
      </div>

      {/* ---------- preview ---------- */}
      <section className="fk-panel" data-pad="tight" style={{ position: "sticky", top: 90 }}>
        <div style={{ fontSize: 13.5, color: "var(--color-text-tertiary)", marginBottom: 10 }}>
          What people see
        </div>
        <div
          style={{
            background: theme.bg,
            color: theme.text,
            borderRadius: 20,
            padding: "clamp(22px,3vw,32px)",
            overflow: "hidden",
          }}
        >
          <div style={{ maxWidth: theme.layout === "wide" ? 520 : theme.layout === "full" ? "none" : 380, margin: theme.layout === "full" ? 0 : "0 auto" }}>
            <h2
              style={{
                margin: 0,
                fontSize: 28 * scale,
                fontWeight: 600,
                letterSpacing: "-.024em",
                lineHeight: 1.1,
              }}
            >
              {form.welcome?.title || form.title}
            </h2>
            <p style={{ margin: "10px 0 0", fontSize: 15 * scale, lineHeight: 1.6, opacity: 0.72 }}>
              {form.welcome?.message || "A few questions — it should take about two minutes."}
            </p>

            <div style={{ marginTop: 26 }}>
              <div style={{ fontSize: 16 * scale, fontWeight: 500 }}>
                {form.blocks.find((b) => b.kind === "field")?.title ?? "Your first question"}
              </div>
              <div
                style={{
                  marginTop: 12,
                  height: 46,
                  borderRadius: Math.min(theme.radius, 23),
                  background: theme.surface,
                  boxShadow: "inset 0 0 0 1px rgba(0,0,0,.08)",
                }}
              />
            </div>

            <button
              type="button"
              disabled
              style={{
                marginTop: 22,
                padding: "13px 24px",
                border: "none",
                borderRadius: Math.min(theme.radius, 999),
                background: theme.primary,
                color: theme.bg === theme.primary ? theme.text : "#ffffff",
                font: "inherit",
                fontSize: 15 * scale,
                fontWeight: 500,
              }}
            >
              {form.welcome?.button ?? "Start"}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
