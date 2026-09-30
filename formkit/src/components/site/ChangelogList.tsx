"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, Check, Sparkles, TrendingUp, Wallet } from "lucide-react";
import { StoryScene } from "@/components/site/scenes";
import type { ChangelogEntry } from "@/content/changelog";

/**
 * The changelog as a timeline: a day at a time, each change marked by what
 * kind it is, and the ones that shipped a feature with a live scene show it
 * playing beside the words. A filter narrows it to one kind.
 */

type Kind = NonNullable<ChangelogEntry["tag"]>;
const KINDS: { id: Kind; icon: typeof Sparkles }[] = [
  { id: "New", icon: Sparkles },
  { id: "Improved", icon: TrendingUp },
  { id: "Plans", icon: Wallet },
];

const DAY = new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", timeZone: "UTC" });
const YEAR = new Intl.DateTimeFormat("en-US", { year: "numeric", timeZone: "UTC" });

/** The feature scene an entry links to, if any: /features/<slug>. */
function sceneOf(e: ChangelogEntry) {
  const l = e.links?.find((x) => /^\/features\/[a-z-]+$/.test(x.href));
  return l ? l.href.split("/")[2]! : null;
}

export function ChangelogList({ entries }: { entries: ChangelogEntry[] }) {
  const [kind, setKind] = useState<Kind | null>(null);
  const shown = entries.filter((e) => !kind || e.tag === kind);
  const days = [...new Set(shown.map((e) => e.date))];

  return (
    <div className="fk-cl">
      <div className="fk-cl-filter" role="radiogroup" aria-label="Show">
        <button type="button" role="radio" aria-checked={!kind} onClick={() => setKind(null)}>
          Everything <span>{entries.length}</span>
        </button>
        {KINDS.map((k) => (
          <button
            key={k.id}
            type="button"
            role="radio"
            aria-checked={kind === k.id}
            data-kind={k.id}
            onClick={() => setKind(kind === k.id ? null : k.id)}
          >
            <k.icon size={14} strokeWidth={2.2} aria-hidden /> {k.id}{" "}
            <span>{entries.filter((e) => e.tag === k.id).length}</span>
          </button>
        ))}
      </div>

      <ol className="fk-cl-days" key={kind ?? "all"}>
        {days.map((d) => {
          const date = new Date(`${d}T00:00:00Z`);
          return (
            <li key={d} className="fk-cl-day">
              <time className="fk-cl-date" dateTime={d}>
                <b>{DAY.format(date)}</b>
                <small>{YEAR.format(date)}</small>
              </time>
              <div className="fk-cl-entries">
                {shown
                  .filter((e) => e.date === d)
                  .map((e) => {
                    const scene = sceneOf(e);
                    const K = KINDS.find((k) => k.id === e.tag);
                    return (
                      <article key={e.title} className="fk-cl-entry" data-kind={e.tag} data-scene={scene ? "" : undefined}>
                        <span className="fk-cl-dot" aria-hidden>
                          {K && <K.icon size={13} strokeWidth={2.4} />}
                        </span>
                        <div className="fk-cl-copy">
                          {e.tag && <span className="fk-cl-tag">{e.tag}</span>}
                          <h2>{e.title}</h2>
                          <p>{e.body}</p>
                          {e.points && (
                            <ul>
                              {e.points.map((pt) => (
                                <li key={pt}>
                                  <Check size={14} strokeWidth={2.4} aria-hidden /> {pt}
                                </li>
                              ))}
                            </ul>
                          )}
                          {e.links && (
                            <div className="fk-cl-links">
                              {e.links.map((l) => (
                                <Link key={l.href} href={l.href}>
                                  {l.label} <ArrowRight size={13} strokeWidth={2.2} aria-hidden />
                                </Link>
                              ))}
                            </div>
                          )}
                        </div>
                        {scene && (
                          <div className="fk-cl-scene" aria-hidden>
                            <StoryScene slug={scene} compact />
                          </div>
                        )}
                      </article>
                    );
                  })}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
