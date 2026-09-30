"use client";

import { useState } from "react";
import { BadgeCheck, Check, Undo2 } from "lucide-react";

/** Business: someone asks to publish, an admin approves. Try both buttons. */
const TEAM = [
  ["MO", "Maya Ortiz", "Admin", "#2e78bb"],
  ["RM", "Ravi Menon", "Editor", "#4b9d6e"],
  ["PS", "Priya Shah", "Editor", "#c98a1e"],
  ["LK", "Leo Kim", "Viewer", "#7a5480"],
] as const;

export function ApproveDemo() {
  const [state, setState] = useState<"waiting" | "approved" | "sent-back">("waiting");
  return (
    <div className="fk-price-biz-art">
      <div className="fk-biz-card">
        <div className="fk-biz-head">
          <b>Team</b>
          <span>{TEAM.length} seats</span>
        </div>
        {TEAM.map(([i, n, r, c]) => (
          <div key={n} className="fk-biz-row">
            <span className="fk-biz-face" style={{ background: c }}>
              {i}
            </span>
            <span className="fk-biz-name">{n}</span>
            <span className="fk-biz-role">{r}</span>
          </div>
        ))}
      </div>
      <div className="fk-biz-approve" data-state={state} aria-live="polite">
        {state === "waiting" ? (
          <>
            <BadgeCheck size={16} strokeWidth={2} aria-hidden />
            <span>
              <b>Priya asked to publish Event RSVP</b>
              <span className="fk-biz-actions">
                <button type="button" onClick={() => setState("approved")}>
                  Approve and publish
                </button>
                <button type="button" data-quiet onClick={() => setState("sent-back")}>
                  Send back
                </button>
              </span>
            </span>
          </>
        ) : (
          <>
            {state === "approved" ? <Check size={16} strokeWidth={2.4} aria-hidden /> : <Undo2 size={16} strokeWidth={2} aria-hidden />}
            <span>
              <b>{state === "approved" ? "Event RSVP is live" : "Sent back to Priya with a note"}</b>
              <em>{state === "approved" ? "Approved by Maya · in the audit log" : "Nothing was published · in the audit log"}</em>
              <button type="button" className="fk-biz-again" onClick={() => setState("waiting")}>
                Try again
              </button>
            </span>
          </>
        )}
      </div>
    </div>
  );
}
