"use client";

import { useState } from "react";
import { Check, Plus } from "lucide-react";

/**
 * What a feature does, as cards that open one at a time: the chosen one
 * widens to show the whole story, the rest stay as their number and title.
 * On a phone they stack and open in place.
 */
export function StoryChapters({ sections }: { sections: { title: string; body: string; points?: string[] }[] }) {
  const [open, setOpen] = useState(0);
  return (
    <div className="fk-ch">
      {sections.map((s, i) => {
        const on = i === open;
        return (
          <div key={s.title} className="fk-ch-card" data-on={on || undefined} data-tone={i % 4}>
            <button
              type="button"
              id={`ch-tab-${i}`}
              aria-expanded={on}
              aria-controls={`ch-panel-${i}`}
              onClick={() => setOpen(i)}
              className="fk-ch-head"
            >
              <span className="fk-ch-num">{String(i + 1).padStart(2, "0")}</span>
              <span className="fk-ch-title">{s.title}</span>
              <Plus size={18} strokeWidth={2} aria-hidden className="fk-ch-plus" />
            </button>
            <div className="fk-ch-panel" id={`ch-panel-${i}`} role="region" aria-labelledby={`ch-tab-${i}`} hidden={!on}>
              <p>{s.body}</p>
              {s.points && (
                <ul>
                  {s.points.map((p) => (
                    <li key={p}>
                      <Check size={14} strokeWidth={2.4} aria-hidden /> {p}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
