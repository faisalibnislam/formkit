"use client";

import type { ReactNode } from "react";
import { ConvexError } from "convex/values";

/** One white panel of settings: a heading, an optional line under it, then rows. */
export function Panel({
  title,
  lede,
  aside,
  children,
}: {
  title: string;
  lede?: ReactNode;
  aside?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <section className="fk-panel fk-setpanel">
      <div className="fk-setpanel-head">
        <div style={{ flex: 1, minWidth: 0 }}>
          <h3>{title}</h3>
          {lede && <p className="fk-panel-lede">{lede}</p>}
        </div>
        {aside}
      </div>
      {children}
    </section>
  );
}

/** A label and its hint on the left, the control on the right. */
export function Row({ label, hint, children }: { label: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <div className="fk-proprow">
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14.5 }}>{label}</div>
        {hint && <div className="fk-proprow-hint">{hint}</div>}
      </div>
      {children}
    </div>
  );
}

/** What a failed call should say: the server's own words when it chose them. */
export function errorText(e: unknown, fallback: string) {
  if (e instanceof ConvexError) {
    const d = e.data as unknown;
    if (typeof d === "string") return d;
    if (d && typeof d === "object" && "message" in d) return String((d as { message: unknown }).message);
    return fallback;
  }
  if (e instanceof Error) {
    const line = e.message
      .replace(/^\[CONVEX[^\]]*\]\s*/, "")
      .replace(/^\[Request ID:[^\]]*\]\s*/, "")
      .replace(/^Server Error\s*/, "")
      .replace(/^Uncaught (Convex)?Error:\s*/, "")
      .split("\n")[0]!
      .trim();
    return line || fallback;
  }
  return fallback;
}

/** 0–4, as the design's password meter reads it. */
export function passwordScore(value: string) {
  let n = 0;
  if (value.length >= 8) n++;
  if (value.length >= 12) n++;
  if (/[A-Z]/.test(value) && /[a-z]/.test(value)) n++;
  if (/[0-9]/.test(value) || /[^A-Za-z0-9]/.test(value)) n++;
  return Math.min(4, n);
}
export const SCORE_LABEL = ["Too short", "Weak", "Getting there", "Good", "Strong"];
