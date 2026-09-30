"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, ArrowUpRight, GitBranch } from "lucide-react";
import { Glyph } from "@/components/brand/Glyph";
import { TemplatePreviewer } from "@/components/templates/TemplatePreviewer";
import type { TemplatePreview } from "@/content/templatePreview";

/**
 * A team's forms, live: pick one of its templates and fill it in on the
 * phone, the real questions as a respondent meets them. Everything it needs
 * is worked out on the server and passed in.
 */

export type BenchTemplate = {
  slug: string;
  name: string;
  blurb: string;
  icon: string;
  count: number;
  time: string;
  logic: boolean;
  preview: TemplatePreview;
};

export function TemplateWorkbench({
  templates,
  compact,
}: {
  templates: BenchTemplate[];
  compact?: boolean;
}) {
  const [at, setAt] = useState(0);
  const t = templates[at];
  if (!t) return null;

  return (
    <div className="fk-wb" data-compact={compact || undefined}>
      <div className="fk-wb-list" role="tablist" aria-label="Templates">
        {templates.map((x, i) => (
          <button
            key={x.slug}
            type="button"
            role="tab"
            aria-selected={i === at}
            aria-controls="fk-wb-panel"
            onClick={() => setAt(i)}
          >
            <span
              className="fk-wb-icon"
              style={{ ["--accent" as string]: x.preview.accent }}
            >
              <Glyph name={x.icon} size={17} />
            </span>
            <span className="fk-wb-name">
              <b>{x.name}</b>
              <small>
                {x.count} questions · {x.time}
                {x.logic && (
                  <>
                    {" · "}
                    <GitBranch size={11} strokeWidth={2.2} aria-hidden /> Logic
                  </>
                )}
              </small>
            </span>
          </button>
        ))}
      </div>

      <div className="fk-wb-stage" id="fk-wb-panel" role="tabpanel">
        <div className="fk-wb-phone" key={t.slug}>
          <TemplatePreviewer preview={t.preview} slug={t.slug} name={t.name} />
        </div>
        {!compact && (
          <div className="fk-wb-about" key={`${t.slug}-about`}>
            <span className="fk-wb-live">Live preview · try it</span>
            <h3>{t.name}</h3>
            <p>{t.blurb}</p>
            <ol className="fk-wb-pages">
              {t.preview.pages.map((p, i) => (
                <li key={p}>
                  <em>{i + 1}</em> {p}
                </li>
              ))}
            </ol>
            <div className="fk-wb-ctas">
              <Link
                href={`/signup?template=${t.slug}`}
                className="fk-pill fk-pill-dark fk-pill-md"
              >
                Use this template{" "}
                <ArrowRight size={16} strokeWidth={1.8} aria-hidden />
              </Link>
              <Link href={`/templates/${t.slug}`} className="fk-wb-more">
                Every question{" "}
                <ArrowUpRight size={15} strokeWidth={2} aria-hidden />
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
