"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { ArrowRight } from "lucide-react";
import { Glyph } from "@/components/brand/Glyph";
import { StoryScene } from "@/components/site/scenes";
import { useInView, useReducedMotion, useStep } from "@/components/site/scenes/shared";

export type ShowcaseItem = { slug: string; name: string; icon: string; title: string; lead: string; plan: string };

const DWELL = 9000;

/**
 * /features opens on this: every feature as a tab, and the chosen one playing
 * beside what it does. It moves on by itself until someone picks a tab.
 */
export function FeatureShowcase({ items, base = "features" }: { items: ShowcaseItem[]; base?: string }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const seen = useInView(ref, 0.25);
  const still = useReducedMotion();
  const [at, setAt] = useState(0);
  const [held, setHeld] = useState(false);
  const item = items[at]!;

  useStep(seen && !still && !held, DWELL, () => setAt((at + 1) % items.length), [at]);

  return (
    <div ref={ref} className="fk-show">
      <div className="fk-show-tabs" role="tablist" aria-label="Features">
        {items.map((it, i) => (
          <button
            key={it.slug}
            type="button"
            role="tab"
            id={`show-tab-${it.slug}`}
            aria-selected={i === at}
            aria-controls="show-panel"
            onClick={() => {
              setHeld(true);
              setAt(i);
            }}
          >
            <span className="fk-show-icon">
              <Glyph name={it.icon} size={16} />
            </span>
            {it.name}
            {i === at && !held && !still && seen && (
              <i className="fk-show-timer" style={{ animationDuration: `${DWELL}ms` }} aria-hidden />
            )}
          </button>
        ))}
      </div>
      <div id="show-panel" role="tabpanel" aria-labelledby={`show-tab-${item.slug}`} className="fk-show-panel" key={item.slug}>
        <div className="fk-show-copy">
          <span className="fk-show-plan">{item.plan}</span>
          <h2>{item.title}</h2>
          <p>{item.lead}</p>
          <Link href={`/${base}/${item.slug}`} className="fk-pill fk-pill-dark fk-pill-lg">
            See how it works <ArrowRight size={16} strokeWidth={1.8} aria-hidden />
          </Link>
        </div>
        <div className="fk-show-scene">
          <StoryScene slug={item.slug} hint />
        </div>
      </div>
    </div>
  );
}
