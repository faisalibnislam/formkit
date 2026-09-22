"use client";

import Link from "next/link";
import type { ReactNode } from "react";

/**
 * Small pieces the application shares: the avatar, the dock's tab cards, and
 * the plain underline tabs used inside a panel.
 */

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
  size?: "sm" | "lg";
}) {
  return (
    <span className="fk-avatar" data-size={size} aria-hidden>
      {image ? <img src={image} alt="" /> : initials(name)}
    </span>
  );
}

export function TabCard({
  href,
  name,
  meta,
  mark,
  active,
  sumLabel,
  sumValue,
}: {
  href: string;
  name: string;
  meta: string;
  mark: ReactNode;
  active: boolean;
  sumLabel: string;
  sumValue: string;
}) {
  return (
    <Link
      href={href}
      className="fk-tabcard"
      data-active={active ? "true" : undefined}
      aria-current={active ? "page" : undefined}
    >
      <span className="fk-tabcard-name">
        {mark}
        {name}
      </span>
      <span className="fk-tabcard-meta">{meta}</span>
      {active && (
        <span className="fk-tabcard-sum">
          <span>{sumLabel}</span>
          <strong>{sumValue}</strong>
        </span>
      )}
    </Link>
  );
}

/** A number that reads as a number: light, tight, large. */
export function Stat({
  label,
  value,
  note,
}: {
  label: string;
  value: ReactNode;
  note?: string;
}) {
  return (
    <div className="fk-stat">
      <div className="fk-stat-label">{label}</div>
      <div className="fk-stat-value">{value}</div>
      {note && <div className="fk-stat-note">{note}</div>}
    </div>
  );
}

export function relativeTime(at: number) {
  const seconds = Math.round((Date.now() - at) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} ${hours === 1 ? "hour" : "hours"} ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days} ${days === 1 ? "day" : "days"} ago`;
  return new Date(at).toLocaleDateString("en-US", { day: "numeric", month: "short" });
}

export function fullTime(at: number) {
  return new Date(at).toLocaleString("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
