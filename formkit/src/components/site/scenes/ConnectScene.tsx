"use client";

import { useRef, useState } from "react";
import { Check, Hash, Send, Sheet, Webhook, Zap } from "lucide-react";
import { SceneFrame, useInView, useReducedMotion, useStep, type SceneProps } from "./shared";

/** Each new response travels down the wires to the tools that are switched on. */

const DESTS = [
  { key: "slack", name: "Slack", where: "#new-leads", done: "Posted to the channel", Icon: Hash },
  { key: "sheets", name: "Google Sheets", where: "Enquiries sheet", done: "A new row on its next refresh", Icon: Sheet },
  { key: "hook", name: "Webhook", where: "api.northstar.studio", done: "200 OK · signed", Icon: Webhook },
  { key: "zap", name: "Zapier and Make", where: "Add to CRM", done: "Delivered", Icon: Zap },
] as const;
type Key = (typeof DESTS)[number]["key"];

const PEOPLE = [
  ["Priya Shah", "A website · $6k"],
  ["Tom Becker", "Rebrand · $20k"],
  ["Ana Ruiz", "Support · order 1182"],
] as const;

/** Rows are 60 units tall in a 240-unit column; the wires start mid-height. */
const ys = [30, 90, 150, 210];

export function ConnectScene({ compact }: SceneProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const seen = useInView(ref);
  const still = useReducedMotion();
  const [on, setOn] = useState<Record<Key, boolean>>({ slack: true, sheets: true, hook: true, zap: false });
  const [fired, setFired] = useState(0);
  const [landed, setLanded] = useState(false);
  const live = seen && !still;
  const who = PEOPLE[fired % PEOPLE.length]!;

  useStep(live && fired > 0 && !landed, 900, () => setLanded(true), [fired]);
  // Responses keep arriving by themselves: on the index, and until someone takes over.
  useStep(live && (compact || fired < 1), fired === 0 ? 900 : 3200, () => fire(), [fired, landed]);

  function fire() {
    setFired(fired + 1);
    setLanded(false);
  }

  const delivered = still || landed;

  return (
    <SceneFrame
      innerRef={ref}
      compact={compact}
      title="Connections"
      label="A new response is sent to Slack, Google Sheets, a webhook and Zapier as soon as it arrives."
      right={
        !compact && (
          <button type="button" className="fk-sc-btn" onClick={fire} disabled={fired > 0 && !landed}>
            <Send size={13} strokeWidth={2} aria-hidden /> Send a test
          </button>
        )
      }
    >
      <div className="fk-cn">
        <div className="fk-cn-src" key={fired}>
          <span className="fk-cn-new">New response</span>
          <b>{who[0]}</b>
          <span>{who[1]}</span>
        </div>

        <svg className="fk-cn-wires" viewBox="0 0 90 240" preserveAspectRatio="none" aria-hidden>
          {DESTS.map((d, i) => {
            const path = `M0 120 C45 120 45 ${ys[i]} 90 ${ys[i]}`;
            return (
              <g key={d.key} data-on={on[d.key] || undefined}>
                <path d={path} className="fk-cn-wire" />
                {live && on[d.key] && fired > 0 && !landed && (
                  <circle key={fired} r="4" className="fk-cn-pulse">
                    <animateMotion dur="0.85s" fill="freeze" path={path} />
                  </circle>
                )}
              </g>
            );
          })}
        </svg>

        <ul className="fk-cn-dests">
          {DESTS.map((d) => (
            <li key={d.key} data-on={on[d.key] || undefined} data-hit={(on[d.key] && delivered && fired > 0) || (still && on[d.key]) || undefined}>
              <button
                type="button"
                aria-pressed={on[d.key]}
                disabled={compact}
                tabIndex={compact ? -1 : undefined}
                onClick={() => setOn({ ...on, [d.key]: !on[d.key] })}
              >
                <span className="fk-cn-icon">
                  <d.Icon size={16} strokeWidth={2} aria-hidden />
                </span>
                <span className="fk-cn-name">
                  <b>{d.name}</b>
                  <span>{on[d.key] ? (delivered && fired > 0 ? d.done : d.where) : "Off"}</span>
                </span>
                <span className="fk-cn-state">{on[d.key] ? <Check size={13} strokeWidth={2.6} aria-hidden /> : null}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </SceneFrame>
  );
}
