import Link from "next/link";
import { ArrowRight, GripVertical } from "lucide-react";
import { Glyph } from "@/components/brand/Glyph";
import { SceneCard } from "@/components/site/SceneCard";
import { Reveal } from "@/components/site/Reveal";
import { DragScene } from "./DragScene";
import { FEATURE_PAGES, USE_CASES } from "@/content/features";

/**
 * Everything on /features, on the home page too: each feature as a card
 * with its scene playing, then the teams it is made for. The AI builder and
 * logic have sections of their own above, so this grid opens on the
 * drag-and-drop builder and branding, and logic is left to its section.
 */
const pick = (slug: string) => FEATURE_PAGES.find((f) => f.slug === slug);
const ORDER = [
  pick("branding"),
  pick("quizzes"),
  pick("ai-replies"),
  pick("insights"),
  pick("payments"),
  pick("integrations"),
  pick("ai-form-builder"),
].filter((f) => f !== undefined);

/** The builder itself has no feature page; its card opens the help article instead. */
function BuilderCard() {
  return (
    <Link href="/help/add-reorder" className="fk-scard" data-wide>
      <span className="fk-scard-scene" aria-hidden>
        <DragScene compact />
      </span>
      <span className="fk-scard-copy">
        <span className="fk-scard-kicker">
          <GripVertical size={14} strokeWidth={1.8} aria-hidden /> Drag-and-drop builder
        </span>
        <b>Drag a question in. Drop it where it goes.</b>
        <span className="fk-scard-foot">
          <span className="fk-scard-plan">Every plan</span>
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
            <BuilderCard />
            {ORDER.map((s, i) => (
              <SceneCard key={s.slug} story={s} base="features" wide={(i + 1) % 4 === 0 || (i + 1) % 4 === 3} />
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
