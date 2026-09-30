import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowRight, Globe, GripVertical, History } from "lucide-react";
import { Glyph } from "@/components/brand/Glyph";
import { SceneCard } from "@/components/site/SceneCard";
import { Reveal } from "@/components/site/Reveal";
import { DragScene } from "./DragScene";
import { VersionsScene } from "./VersionsScene";
import { DomainScene } from "./DomainScene";
import { FEATURE_PAGES, USE_CASES } from "@/content/features";

/**
 * Everything on /features, on the home page too: each feature as a card
 * with its scene playing, then the teams it is made for. The AI builder,
 * logic and AI replies have sections of their own above, so this grid opens
 * on the drag-and-drop builder and branding, and gives their places to
 * version history and exports, and custom domains.
 */
const pick = (slug: string) => FEATURE_PAGES.find((f) => f.slug === slug);
const BEFORE = [pick("branding"), pick("quizzes")].filter((f) => f !== undefined);
const AFTER = [pick("insights"), pick("payments"), pick("integrations")].filter((f) => f !== undefined);

/** A card for something with no feature page of its own; it opens the help article instead. */
function HelpCard({
  href,
  scene,
  kicker,
  title,
  plan,
}: {
  href: string;
  scene: ReactNode;
  kicker: ReactNode;
  title: string;
  plan: string;
}) {
  return (
    <Link href={href} className="fk-scard" data-wide>
      <span className="fk-scard-scene" aria-hidden>
        {scene}
      </span>
      <span className="fk-scard-copy">
        <span className="fk-scard-kicker">{kicker}</span>
        <b>{title}</b>
        <span className="fk-scard-foot">
          <span className="fk-scard-plan">{plan}</span>
          <span className="fk-scard-go">
            Explore <ArrowRight size={14} strokeWidth={2} aria-hidden />
          </span>
        </span>
      </span>
    </Link>
  );
}

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
            <HelpCard
              href="/help/add-reorder"
              scene={<DragScene compact />}
              kicker={
                <>
                  <GripVertical size={14} strokeWidth={1.8} aria-hidden /> Drag-and-drop builder
                </>
              }
              title="Drag a question in. Drop it where it goes."
              plan="Every plan"
            />
            {BEFORE.map((s) => (
              <SceneCard key={s.slug} story={s} base="features" />
            ))}
            <HelpCard
              href="/help/version-history"
              scene={<VersionsScene compact />}
              kicker={
                <>
                  <History size={14} strokeWidth={1.8} aria-hidden /> Version history and exports
                </>
              }
              title="Go back to any version. Take your answers anywhere."
              plan="Every plan · Excel on Pro"
            />
            {AFTER.map((s, i) => (
              <SceneCard key={s.slug} story={s} base="features" wide={i === 0} />
            ))}
            <HelpCard
              href="/help/custom-domain"
              scene={<DomainScene compact />}
              kicker={
                <>
                  <Globe size={14} strokeWidth={1.8} aria-hidden /> Custom domain
                </>
              }
              title="Your forms on forms.yourcompany.com."
              plan="Pro"
            />
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
