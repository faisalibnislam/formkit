"use client";

import Link from "next/link";
import { ArrowDownRight, ArrowUpRight, Check, FileText, X } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";

/**
 * The design system's data and navigation components, ported.
 *
 * These are the pieces the signed-in application is drawn from — the record
 * tabs docked under the sky band, the metric cards, the tick meter and the
 * account capsule. They are ports of
 * `_ds/formkit-design-system-e346e922-…/_ds_bundle.js`, not approximations of
 * it: where the bundle fixes a number, the number is here. Styling that does
 * not vary lives in src/styles/app.css.
 */

/* ---------- StatDot ---------- */

/** The small round arrow that annotates a figure. `up` is good, `down` is not. */
export function StatDot({
  tone = "up",
  size = 18,
  label,
}: {
  tone?: "up" | "down" | "success" | "warning";
  size?: number;
  label?: string;
}) {
  const Icon = { up: ArrowUpRight, down: ArrowDownRight, success: Check, warning: X }[tone];
  return (
    <span
      className="fk-statdot"
      data-tone={tone}
      style={{ width: size, height: size }}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      title={label}
    >
      <Icon size={Math.round(size * 0.62)} strokeWidth={2.1} />
    </span>
  );
}

/* ---------- TickBars ---------- */

/**
 * The horizontal tick meter: a run of hairlines, the leading share coloured and
 * the remainder left in the track grey, so it reads as measurement rather than
 * as a filled pill.
 */
export function TickBars({
  value = 0,
  tone = "positive",
  ticks = 72,
  height = 26,
  labelLeft,
  labelRight,
  footLeft,
  footRight,
}: {
  value?: number;
  tone?: "positive" | "negative" | "neutral" | "info";
  ticks?: number;
  height?: number;
  labelLeft?: ReactNode;
  labelRight?: ReactNode;
  footLeft?: ReactNode;
  footRight?: ReactNode;
}) {
  const filled = Math.round((Math.max(0, Math.min(100, value)) / 100) * ticks);
  return (
    <div
      className="fk-tickbars"
      role="img"
      aria-label={`${typeof labelLeft === "string" ? labelLeft : ""} ${Math.round(value)}%`}
    >
      {(labelLeft || labelRight) && (
        <div className="fk-tickbars-row" data-kind="label">
          <span>{labelLeft}</span>
          <span>{labelRight}</span>
        </div>
      )}
      <div className="fk-tickbars-plot" style={{ height }}>
        {Array.from({ length: ticks }, (_, i) => (
          <span key={i} data-on={i < filled ? "true" : undefined} data-tone={tone} />
        ))}
      </div>
      {(footLeft || footRight) && (
        <div className="fk-tickbars-row" data-kind="foot">
          <span>{footLeft}</span>
          <span>{footRight}</span>
        </div>
      )}
    </div>
  );
}

/* ---------- MetricCard ---------- */

/**
 * The unit the dashboard is built from: a floating white card whose number is
 * set large and light, annotated by a single state dot, with a tick chart along
 * the bottom and one drill-in affordance in the top-right corner.
 */
export function MetricCard({
  icon,
  title,
  eyebrow,
  value,
  valueTone,
  unit,
  chart,
  children,
  href,
  expandLabel,
  tone = "default",
}: {
  icon?: ReactNode;
  title: string;
  eyebrow?: ReactNode;
  value?: ReactNode;
  valueTone?: "up" | "down";
  unit?: string;
  chart?: ReactNode;
  children?: ReactNode;
  href?: string;
  expandLabel?: string;
  tone?: "default" | "sunken";
}) {
  return (
    <section className="fk-metric" data-tone={tone}>
      <header className="fk-metric-head">
        <div className="fk-metric-title">
          {icon}
          <h3>{title}</h3>
        </div>
        {href && (
          <Link href={href} className="fk-ring-btn" aria-label={expandLabel ?? `Open ${title}`}>
            <ArrowUpRight size={17} strokeWidth={1.9} aria-hidden />
          </Link>
        )}
      </header>
      {eyebrow && <p className="fk-metric-eyebrow">{eyebrow}</p>}
      {value != null && (
        <div className="fk-metric-value">
          <span>{value}</span>
          {unit && <span className="fk-metric-unit">{unit}</span>}
          {valueTone && <StatDot tone={valueTone} size={20} />}
        </div>
      )}
      {children}
      {chart && <div className="fk-metric-chart">{chart}</div>}
    </section>
  );
}

/* ---------- StatCard ---------- */

/** The compact sibling of MetricCard: one figure, one label, no chart. */
export function StatCard({
  label,
  value,
  delta,
  deltaTone = "up",
  caption,
  tone = "default",
  icon,
}: {
  label: string;
  value: ReactNode;
  delta?: string;
  deltaTone?: "up" | "down";
  caption?: string;
  tone?: "default" | "sunken" | "ink" | "sky";
  icon?: ReactNode;
}) {
  return (
    <div className="fk-statcard" data-tone={tone}>
      <div className="fk-statcard-label">
        {icon}
        <span>{label}</span>
      </div>
      <div className="fk-statcard-value">
        <span>{value}</span>
        {delta && <StatDot tone={deltaTone} />}
        {delta && <span className="fk-statcard-delta">{delta}</span>}
      </div>
      {caption && <span className="fk-statcard-caption">{caption}</span>}
    </div>
  );
}

/* ---------- FormCard ---------- */

/**
 * A form as a floating card, with a tinted preview plate standing in for the
 * form's own published theme.
 */
export function FormCard({
  href,
  title,
  description,
  status,
  responses,
  fields,
  updated,
  accent = "var(--blue-300)",
  actions,
}: {
  href: string;
  title: string;
  description?: string | null;
  status: ReactNode;
  responses: number;
  fields: number;
  updated: string;
  accent?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="fk-formcard">
      <Link href={href} className="fk-formcard-plate" style={{ background: accent }} aria-label={title}>
        <span className="fk-formcard-preview" aria-hidden>
          <span />
          <span />
          <span />
        </span>
      </Link>
      <div className="fk-formcard-body">
        <div className="fk-formcard-head">
          <h3>
            <Link href={href}>{title}</Link>
          </h3>
          {status}
        </div>
        {description && <p>{description}</p>}
        <div className="fk-formcard-foot">
          <span data-strong="true">{responses.toLocaleString()} responses</span>
          <span>
            {fields} {fields === 1 ? "question" : "questions"}
          </span>
          <span className="fk-formcard-updated">{updated}</span>
        </div>
        {actions && <div className="fk-formcard-actions">{actions}</div>}
      </div>
    </div>
  );
}

/* ---------- ClientTab ---------- */

/*  LOCKED DESIGN — the record tabs docked along the bottom of the sky band.
    Do not alter the geometry without an explicit instruction (project notes,
    "ClientTab is a locked design"). Signed off by Faisal.

    The active tab is a connected tab with curved bottom shoulders. Its top
    corners are convex and its bottom corners INVERTED: the surface flares
    outward as it reaches the band edge, so the tab reads as fused into the
    plane below rather than as a floating rounded box.

    border-radius cannot express a concave corner, so each shoulder is a
    SHOULDER-square parked just outside the tab's bottom corner, filled with a
    radial gradient whose transparent disc is centred on the outer-top corner.
    Everything beyond that disc paints in --paper, leaving a quarter-circle
    cut-out above the flare.

    The dock that hosts these must keep SHOULDER-wide gutters, or the first and
    last tab's flare is clipped by its scroll box. */
export const COLLAR = 20; /* bottom padding on an inactive tab */
export const MIN_WIDTH = 216; /* below this the name truncates, so the dock scrolls */
export const SHOULDER = 20; /* radius of the bottom corner flare — LOCKED */

function Shoulder({ side }: { side: "left" | "right" }) {
  const style: CSSProperties = {
    [side]: -SHOULDER,
    width: SHOULDER,
    height: SHOULDER,
    background: `radial-gradient(circle at ${side === "left" ? "0 0" : "100% 0"},rgba(0,0,0,0) ${SHOULDER - 0.5}px,var(--paper) ${SHOULDER}px)`,
  } as CSSProperties;
  return <span className="fk-tab-shoulder" aria-hidden style={style} />;
}

export function ClientTab({
  href,
  name,
  meta,
  mark,
  active = false,
  children,
}: {
  href: string;
  name: string;
  meta?: string;
  mark?: ReactNode;
  active?: boolean;
  children?: ReactNode;
}) {
  return (
    <Link
      href={href}
      className="fk-tab"
      data-active={active ? "true" : undefined}
      aria-current={active ? "page" : undefined}
      style={{ minWidth: MIN_WIDTH }}
    >
      {active && <Shoulder side="left" />}
      {active && <Shoulder side="right" />}
      <span className="fk-tab-head">
        {mark && <span className="fk-tab-mark">{mark}</span>}
        <span className="fk-tab-text">
          <span className="fk-tab-name">{name}</span>
          {meta && <span className="fk-tab-meta">{meta}</span>}
        </span>
      </span>
      {children}
    </Link>
  );
}

/** The summary line an active record tab carries. */
export function TabSummary({ label, value, tone }: { label: string; value: string; tone?: "up" | "down" }) {
  return (
    <span className="fk-tab-sum">
      <span>{label}</span>
      <strong>{value}</strong>
      {tone && <StatDot tone={tone} size={20} />}
    </span>
  );
}

/* ---------- BarChart ---------- */

/** Responses over time: one bar per bucket, the last one marked. */
export function BarChart({
  bars,
  height = 200,
}: {
  bars: { label: string; value: number; tone?: "positive" | "marker" }[];
  height?: number;
}) {
  const peak = Math.max(1, ...bars.map((b) => b.value));
  return (
    <div className="fk-barchart" style={{ height }}>
      {bars.map((b, i) => (
        <span className="fk-barchart-col" key={`${b.label}-${i}`}>
          <span className="fk-barchart-figure">{b.value}</span>
          <span
            className="fk-barchart-bar"
            data-tone={b.tone ?? "positive"}
            style={{ height: `${Math.max(2, (b.value / peak) * 100)}%` }}
          />
          <span className="fk-barchart-label">{b.label}</span>
        </span>
      ))}
    </div>
  );
}

/* ---------- Avatar and the account capsule ---------- */

export function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

export function Avatar({
  name,
  image,
  size,
}: {
  name: string;
  image?: string | null;
  size?: "sm" | "lg" | "xl";
}) {
  return (
    <span className="fk-avatar" data-size={size} aria-hidden>
      {image ? <img src={image} alt="" /> : initials(name)}
    </span>
  );
}

/**
 * The account cluster: the utility circles and one white capsule carrying the
 * person's name and face, so the top-right corner of the app reads as one
 * object rather than four.
 */
export function AvatarPill({
  name,
  image,
  onClick,
  expanded,
}: {
  name: string;
  image?: string | null;
  onClick?: () => void;
  expanded?: boolean;
}) {
  return (
    <button
      type="button"
      className="fk-avatarpill"
      aria-haspopup="menu"
      aria-expanded={expanded}
      onClick={onClick}
    >
      <span className="fk-avatarpill-name">{name || "Account"}</span>
      <Avatar name={name} image={image} />
    </button>
  );
}

/** The plain document mark a form row leads with. */
export function FormMark({ accent }: { accent?: string }) {
  return (
    <span className="fk-formmark" style={accent ? { background: accent } : undefined} aria-hidden>
      <FileText size={19} strokeWidth={1.8} />
    </span>
  );
}

/* ---------- Sparkbars ---------- */

/** A run of daily counts, drawn small enough to sit inside a metric card. */
export function Sparkbars({ values, height = 92 }: { values: number[]; height?: number }) {
  const peak = Math.max(1, ...values);
  return (
    <div className="fk-sparkbars" style={{ height }} aria-hidden>
      {values.map((v, i) => (
        <span key={i} style={{ height: `${Math.max(3, (v / peak) * 100)}%` }} data-empty={v === 0 ? "true" : undefined} />
      ))}
    </div>
  );
}

/* ---------- section heading ---------- */

/** A heading over a run of cards: the name, a count, and one way onward. */
export function SectionHead({
  title,
  count,
  action,
}: {
  title: string;
  count?: number;
  action?: ReactNode;
}) {
  return (
    <div className="fk-section-head">
      <h2>{title}</h2>
      {count != null && <span className="fk-section-count">{count}</span>}
      <span className="fk-section-spacer" />
      {action}
    </div>
  );
}
