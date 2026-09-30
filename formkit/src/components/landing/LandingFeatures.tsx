import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Glyph } from "@/components/brand/Glyph";
import { SceneCard } from "@/components/site/SceneCard";
import { Reveal } from "@/components/site/Reveal";
import { FEATURE_PAGES, USE_CASES } from "@/content/features";

/**
 * Everything on /features, on the home page too: each feature as a card
 * with its scene playing, then the teams it is made for.
 */
export function LandingFeatures() {
  return (
    <section id="every-feature" className="fk-lf" aria-labelledby="lf-title">
      <Reveal className="fk-lf-inner">
        <div className="fk-lf-head" data-rise>
          <span className="fk-more-kicker">Every feature</span>
          <h2 id="lf-title" className="fk-lp-h2">
            Everything a form can do here.
          </h2>
          <p className="fk-lp-lede">
            Build a form by describing it, send each person down the right path, and act on
            every answer. Every feature below is live: click around and see how it works.
          </p>
        </div>

        <div data-rise>
          <div className="fk-bento">
            {FEATURE_PAGES.map((s, i) => (
              <SceneCard key={s.slug} story={s} base="features" wide={i % 4 === 0 || i % 4 === 3} />
            ))}
          </div>
        </div>

        <section className="fk-story-block" data-rise aria-labelledby="lf-teams">
          <h2 id="lf-teams" className="fk-story-h2">
            Made for your team
          </h2>
          <div className="fk-teams">
            {USE_CASES.map((u) => (
              <Link key={u.slug} href={`/use-cases/${u.slug}`} className="fk-team">
                <span className="fk-tpl-tile">
                  <Glyph name={u.icon} size={20} />
                </span>
                <b>{u.name}</b>
                <span>{u.kicker}</span>
                <ArrowRight size={16} strokeWidth={1.8} aria-hidden />
              </Link>
            ))}
          </div>
        </section>
      </Reveal>
    </section>
  );
}
