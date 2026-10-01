import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Glyph } from "@/components/brand/Glyph";
import { StoryScene } from "@/components/site/scenes";
import type { Story } from "@/content/features";

/** A feature as a card, its scene playing small above the words. */
export function SceneCard({
  story,
  base,
  wide,
  full,
}: {
  story: Story;
  base: "features" | "use-cases";
  wide?: boolean;
  /** Spans the whole row, for a card that would otherwise sit alone at the end. */
  full?: boolean;
}) {
  return (
    <Link href={`/${base}/${story.slug}`} className="fk-scard" data-wide={wide || full || undefined} data-full={full || undefined}>
      <span className="fk-scard-scene" aria-hidden>
        <StoryScene slug={story.slug} compact />
      </span>
      <span className="fk-scard-copy">
        <span className="fk-scard-kicker">
          <Glyph name={story.icon} size={14} /> {story.name}
        </span>
        <b>{story.title}</b>
        <span className="fk-scard-foot">
          <span className="fk-scard-plan">{story.plan}</span>
          <span className="fk-scard-go">
            Explore <ArrowRight size={14} strokeWidth={2} aria-hidden />
          </span>
        </span>
      </span>
    </Link>
  );
}
