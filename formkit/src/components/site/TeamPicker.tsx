"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, Check } from "lucide-react";
import { Glyph } from "@/components/brand/Glyph";
import { TemplateWorkbench, type BenchTemplate } from "@/components/site/TemplateWorkbench";

/**
 * /use-cases opens on this: pick a team and see what it runs on Formkit,
 * with its templates live on a phone to fill in.
 */

export type Team = {
  slug: string;
  name: string;
  icon: string;
  kicker: string;
  title: string;
  lead: string;
  plan: string;
  points: string[];
  bench: BenchTemplate[];
};

export function TeamPicker({ teams }: { teams: Team[] }) {
  const [at, setAt] = useState(0);
  const t = teams[at]!;
  return (
    <div className="fk-team-pick">
      <div className="fk-team-tabs" role="tablist" aria-label="Pick your team">
        {teams.map((x, i) => (
          <button
            key={x.slug}
            type="button"
            role="tab"
            id={`team-tab-${x.slug}`}
            aria-selected={i === at}
            aria-controls="team-panel"
            onClick={() => setAt(i)}
          >
            <span className="fk-team-tab-ic">
              <Glyph name={x.icon} size={16} />
            </span>
            {x.name}
          </button>
        ))}
      </div>
      <div className="fk-team-panel" id="team-panel" role="tabpanel" aria-labelledby={`team-tab-${t.slug}`} key={t.slug}>
        <div className="fk-team-copy">
          <span className="fk-team-kicker">{t.kicker}</span>
          <h2>{t.title}</h2>
          <p>{t.lead}</p>
          <ul>
            {t.points.map((p) => (
              <li key={p}>
                <Check size={15} strokeWidth={2.4} aria-hidden /> {p}
              </li>
            ))}
          </ul>
          <span className="fk-team-plan">{t.plan}</span>
          <Link href={`/use-cases/${t.slug}`} className="fk-pill fk-pill-dark fk-pill-lg">
            See the full story <ArrowRight size={16} strokeWidth={1.8} aria-hidden />
          </Link>
        </div>
        <TemplateWorkbench templates={t.bench} compact />
      </div>
    </div>
  );
}
