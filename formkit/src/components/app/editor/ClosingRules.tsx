"use client";

import { useMutation } from "convex/react";
import { Clock, Globe } from "lucide-react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { Switch } from "@/components/ui";
import { epochToZoned, formatIn, untilLabel, zoneLabel, zonedToEpoch } from "../time";
import { tracked } from "./saveStatus";

/**
 * The two rules that close a form on its own: a date and time, and a response
 * limit. The Settings tab and the Close dialog share them, so the two can
 * never disagree about what is scheduled.
 */

type Closing = { closeAt?: number | null; closeAfter?: number | null; timezone?: string | null } | null;

/** Seven days from now, at a minute to midnight, in `zone`. */
function defaultCloseAt(zone: string) {
  const week = epochToZoned(Date.now() + 7 * 24 * 60 * 60 * 1000, zone);
  return zonedToEpoch(week.date, "23:59", zone) ?? Date.now() + 7 * 24 * 60 * 60 * 1000;
}

/** How a form will close, in a sentence. */
export function closeWhenLabel(closing: Closing, responses: number, zone: string) {
  const bits: string[] = [];
  if (closing?.closeAt) {
    bits.push(
      closing.closeAt <= Date.now()
        ? `Its closing time, ${formatIn(closing.closeAt, zone)}, has passed`
        : `Closes ${formatIn(closing.closeAt, zone)} — ${untilLabel(closing.closeAt)}`,
    );
  }
  if (closing?.closeAfter) {
    const left = closing.closeAfter - responses;
    bits.push(
      left > 0
        ? `closes after ${left.toLocaleString("en-US")} more response${left === 1 ? "" : "s"}`
        : "the response limit is already met",
    );
  }
  if (!bits.length) return "";
  const s = bits.join(", or ");
  return s.charAt(0).toUpperCase() + s.slice(1) + ".";
}

export function ClosingRules({
  formId,
  closing,
  responses,
  zone,
  dateHint = "Stops accepting answers the moment it passes",
}: {
  formId: Id<"forms">;
  closing: Closing;
  responses: number;
  zone: string;
  dateHint?: string;
}) {
  const setClosing = useMutation(api.forms.setClosing);
  const save = (c: { closeAt?: number | null; closeAfter?: number | null }) =>
    tracked(setClosing({ formId, closing: { ...c, timezone: zone } }));

  const at = closing?.closeAt ?? null;
  const wall = at ? epochToZoned(at, zone) : null;
  const limit = closing?.closeAfter ?? null;
  const left = limit ? limit - responses : 0;

  return (
    <>
      <div className="fk-proprow">
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14 }}>Close on a date and time</div>
          <div className="fk-proprow-hint">{dateHint}</div>
        </div>
        <Switch
          checked={at !== null}
          label="Close on a date and time"
          onChange={(on) => save({ closeAt: on ? defaultCloseAt(zone) : null })}
        />
      </div>
      {wall && (
        <>
          <div className="fk-closing-when">
            <label>
              <span>Date</span>
              <input
                type="date"
                value={wall.date}
                aria-label="Closing date"
                onChange={(e) => {
                  const next = zonedToEpoch(e.target.value, wall.time, zone);
                  if (next) void save({ closeAt: next });
                }}
              />
            </label>
            <label>
              <span>Time</span>
              <input
                type="time"
                value={wall.time}
                aria-label="Closing time"
                onChange={(e) => {
                  const next = zonedToEpoch(wall.date, e.target.value || "23:59", zone);
                  if (next) void save({ closeAt: next });
                }}
              />
            </label>
            <div style={{ flex: 1, minWidth: 180 }}>
              <span>Time zone</span>
              <div className="fk-closing-zone" title={zone}>
                <Globe size={15} strokeWidth={1.8} aria-hidden />
                <span>{zoneLabel(zone)}</span>
              </div>
            </div>
          </div>
          <div className="fk-closing-countdown">
            <Clock size={15} strokeWidth={1.8} aria-hidden />
            <span>
              {untilLabel(at!) === "already passed"
                ? "That time has passed — it closes on the next check."
                : `Closes ${formatIn(at!, zone)} — ${untilLabel(at!)}.`}
            </span>
          </div>
        </>
      )}

      <div className="fk-proprow">
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14 }}>Close after a response limit</div>
          <div className="fk-proprow-hint">Useful for limited places</div>
        </div>
        <Switch
          checked={limit !== null}
          label="Close after a response limit"
          onChange={(on) => save({ closeAfter: on ? Math.max(responses + 50, 100) : null })}
        />
      </div>
      {limit !== null && (
        <div className="fk-closing-when" style={{ paddingBottom: 18 }}>
          <label>
            <span>Maximum responses</span>
            <input
              type="number"
              min={1}
              value={limit}
              aria-label="Maximum responses"
              style={{ width: 140 }}
              onChange={(e) => save({ closeAfter: Math.max(1, parseInt(e.target.value, 10) || 1) })}
            />
          </label>
          <div className="fk-proprow-hint" style={{ flex: 1, minWidth: 190, paddingBottom: 14, margin: 0 }}>
            {left > 0
              ? `${responses.toLocaleString("en-US")} of ${limit.toLocaleString("en-US")} collected — it closes after ${left.toLocaleString("en-US")} more.`
              : "The limit is already met, so it closes on the next check."}
          </div>
        </div>
      )}
    </>
  );
}
