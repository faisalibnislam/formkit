"use client";

import type { FunctionReturnType } from "convex/server";
import type { api } from "../../../convex/_generated/api";
import { downloadSheets, type Format } from "./exporting";

/**
 * The analytics export, shared by the Analytics screen and Settings → Exports
 * (which fetches the same range again when a past export is downloaded).
 */

export type AnalyticsData = FunctionReturnType<typeof api.analytics.overview>;

/** yyyy-mm-dd in local time, for a date input or a file name. */
export function ymd(at: number) {
  const d = new Date(at);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function signed(value: number | null | undefined, suffix = "%") {
  if (value === null || value === undefined || value === 0) return undefined;
  return `${value > 0 ? "+" : "−"}${Math.abs(value)}${suffix}`;
}

export function duration(seconds: number | null) {
  if (seconds === null) return "—";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m ? `${m}m ${String(s).padStart(2, "0")}s` : `${s}s`;
}

export function downloadAnalytics(data: AnalyticsData, title: string, format: Format) {
  const overTime = {
    name: "Over time",
    columns: ["Date", "Views", "Started", "Responses", "Completed"],
    rows: data.daily.map((d) => [ymd(d.at), String(d.views), String(d.starts), String(d.responses), String(d.completed)]),
  };
  const sheets = [
    {
      name: "Summary",
      columns: ["Measure", "Value", "Change against the period before"],
      rows: [
        ["Range", `${ymd(data.from)} to ${ymd(data.to - 1)}`, ""],
        ["Forms", title, ""],
        ["Views", String(data.views), signed(data.change.views) ?? ""],
        ["Started", String(data.starts), signed(data.change.starts) ?? ""],
        ["Completed", String(data.completed), signed(data.change.completed) ?? ""],
        ["Partial", String(data.partial), ""],
        [
          "Completion rate",
          data.completionRate === null ? "" : `${data.completionRate}%`,
          signed(data.change.completionRate, " pts") ?? "",
        ],
        ["Average time", duration(data.medianSeconds), signed(data.change.medianSeconds, "s") ?? ""],
      ],
    },
    overTime,
    ...(data.dropOff.length
      ? [
          {
            name: "Drop-off",
            columns: ["Question", "Left here", "Share of starts"],
            rows: data.dropOff.map((q, i) => [`${i + 1}. ${q.title}`, String(q.left), `${q.share}%`]),
          },
        ]
      : []),
    {
      name: "Sources",
      columns: ["Source", "Views", "Responses", "Completed", "Completion"],
      rows: data.sources.map((s) => [
        s.name,
        String(s.views),
        String(s.responses),
        String(s.completed),
        s.completion === null ? "" : `${s.completion}%`,
      ]),
    },
  ];
  const base = `analytics-${ymd(data.from)}-to-${ymd(data.to - 1)}`;
  // A CSV holds one table; the day-by-day figures are the one worth having.
  return downloadSheets(format === "xlsx" ? sheets : [overTime], base, format);
}
