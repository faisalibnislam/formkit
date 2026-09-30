"use client";

import { useRef, useState } from "react";
import { Check, Download, FileSpreadsheet, FileText, History, RotateCcw } from "lucide-react";
import { SceneFrame, useInView, useReducedMotion, useStep, type SceneProps } from "@/components/site/scenes/shared";

/**
 * Version history and exports, playing by themselves: an older version is
 * picked and restored (the current questions are kept first), then the
 * responses go out as a spreadsheet. The same moves the app makes.
 */

const VERSIONS = [
  { id: "v12", when: "Today, 10:42", who: "Sam", live: true },
  { id: "v11", when: "Yesterday, 16:05", who: "Priya", live: false },
  { id: "v10", when: "24 Sep, 09:18", who: "Sam", live: false },
];
const PICKED = 1;

const ROWS = [
  { name: "Priya Shah", need: "New website", at: "10:31" },
  { name: "Marcus Lee", need: "Redesign", at: "09:54" },
  { name: "Hana Kim", need: "Pricing", at: "Yesterday" },
];

/** 0 rest, 1 a version picked, 2 restored, 3 export menu open, 4 downloaded. */
const PHASE_MS = [1400, 1500, 1900, 1400, 2400];

export function VersionsScene({ compact }: SceneProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const seen = useInView(ref, 0.25);
  const still = useReducedMotion();
  const [phase, setPhase] = useState(0);
  const shown = still ? 4 : phase;

  useStep(seen && !still, PHASE_MS[phase]!, () => setPhase((phase + 1) % PHASE_MS.length), [phase]);

  return (
    <div ref={ref} className="fk-vx" data-compact={compact || undefined}>
      <SceneFrame title="Client intake" label="Restoring an earlier version of a form, then exporting its responses" right={<span className="fk-vx-draft" data-on={shown >= 2 || undefined}>{shown >= 2 ? "Unpublished changes" : "Live"}</span>}>
        <div className="fk-vx-body">
          <div className="fk-vx-pane">
            <span className="fk-vx-head">
              <History size={13} strokeWidth={2} aria-hidden /> Version history
            </span>
            <ul className="fk-vx-list">
              {VERSIONS.map((v, i) => (
                <li key={v.id} data-on={(i === PICKED && shown >= 1) || undefined}>
                  <span className="fk-vx-when">
                    <b>{v.when}</b>
                    <small>Published by {v.who}</small>
                  </span>
                  {v.live ? (
                    <span className="fk-vx-live">Live</span>
                  ) : i === PICKED && shown >= 1 ? (
                    <span className="fk-vx-restore" data-done={shown >= 2 || undefined}>
                      {shown >= 2 ? <Check size={12} strokeWidth={2.4} aria-hidden /> : <RotateCcw size={12} strokeWidth={2.2} aria-hidden />}
                      {shown >= 2 ? "Restored" : "Restore"}
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>

          <div className="fk-vx-pane">
            <span className="fk-vx-head">
              Responses <small>38</small>
              <span className="fk-vx-export" data-on={shown === 3 || undefined}>
                <Download size={12} strokeWidth={2.2} aria-hidden /> Export
              </span>
            </span>
            <ul className="fk-vx-rows">
              {ROWS.map((r) => (
                <li key={r.name}>
                  <b>{r.name}</b>
                  <span>{r.need}</span>
                  <small>{r.at}</small>
                </li>
              ))}
            </ul>
            <span className="fk-vx-menu" data-on={shown === 3 || undefined} aria-hidden>
              <span>
                <FileText size={13} strokeWidth={2} /> CSV
              </span>
              <span data-pick>
                <FileSpreadsheet size={13} strokeWidth={2} /> Excel
              </span>
            </span>
            <span className="fk-vx-file" data-on={shown >= 4 || undefined}>
              <FileSpreadsheet size={15} strokeWidth={2} aria-hidden />
              <span>
                <b>client-intake.xlsx</b>
                <small>38 rows, one column per question</small>
              </span>
              <Check size={14} strokeWidth={2.4} aria-hidden />
            </span>
          </div>
        </div>
      </SceneFrame>
    </div>
  );
}
