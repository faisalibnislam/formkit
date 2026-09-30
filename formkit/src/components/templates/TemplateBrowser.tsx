"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowRight, Search, Sparkles, X } from "lucide-react";
import { Glyph } from "@/components/brand/Glyph";

/**
 * /templates: search and filter every template in place, each card showing a
 * miniature of the form itself (its welcome line and first questions, drawn
 * by answer type) rather than an icon alone.
 */

export type BrowserTemplate = {
  slug: string;
  name: string;
  blurb: string;
  category: string;
  icon: string;
  count: number;
  time: string;
  logic: boolean;
  accent: string;
  welcome: string;
  first: { title: string; type: string; options?: string[] }[];
  /** Question titles, for search. */
  words: string;
};

export function TemplateBrowser({ templates, categories }: { templates: BrowserTemplate[]; categories: string[] }) {
  const [query, setQuery] = useState("");
  const [cat, setCat] = useState<string | null>(null);
  const q = query.trim().toLowerCase();

  const shown = useMemo(
    () =>
      templates.filter(
        (t) =>
          (!cat || t.category === cat) &&
          (!q || `${t.name} ${t.blurb} ${t.category} ${t.words}`.toLowerCase().includes(q)),
      ),
    [templates, cat, q],
  );
  const grouped = !q && !cat;

  return (
    <div className="fk-tb">
      <div className="fk-tb-bar">
        <label className="fk-tb-search">
          <Search size={18} strokeWidth={1.8} aria-hidden />
          <input
            type="search"
            placeholder="Search templates and their questions"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search templates"
          />
          {query && (
            <button type="button" onClick={() => setQuery("")} aria-label="Clear search">
              <X size={15} strokeWidth={2} />
            </button>
          )}
        </label>
        <div className="fk-tb-cats" role="radiogroup" aria-label="Category">
          <button type="button" role="radio" aria-checked={!cat} onClick={() => setCat(null)}>
            All <span>{templates.length}</span>
          </button>
          {categories.map((c) => (
            <button key={c} type="button" role="radio" aria-checked={cat === c} onClick={() => setCat(cat === c ? null : c)}>
              {c} <span>{templates.filter((t) => t.category === c).length}</span>
            </button>
          ))}
        </div>
      </div>

      {shown.length === 0 ? (
        <div className="fk-tb-empty">
          <p>
            No template matches “{query.trim()}”
            {cat ? ` in ${cat}` : ""}.
          </p>
          <AiCard query={query.trim()} />
        </div>
      ) : grouped ? (
        <>
          {categories.map((c, i) => {
            const list = shown.filter((t) => t.category === c);
            if (!list.length) return null;
            return (
              <section key={c} id={c.toLowerCase()} className="fk-tpl-group">
                <h2 className="fk-tpl-group-head">
                  {c} <span>{list.length}</span>
                </h2>
                <div className="fk-tb-grid">
                  {i === 0 && <AiCard />}
                  {list.map((t) => (
                    <TemplateCard key={t.slug} t={t} />
                  ))}
                </div>
              </section>
            );
          })}
        </>
      ) : (
        <>
          <p className="fk-tb-count" aria-live="polite">
            {shown.length} {shown.length === 1 ? "template" : "templates"}
          </p>
          <div className="fk-tb-grid">
            {shown.map((t) => (
              <TemplateCard key={t.slug} t={t} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function AiCard({ query }: { query?: string }) {
  return (
    <Link href="/signup" className="fk-tb-ai">
      <span className="fk-tb-ai-icon">
        <Sparkles size={20} strokeWidth={2} aria-hidden />
      </span>
      <b>{query ? "Describe it instead" : "Not here? Describe it."}</b>
      <span className="fk-tb-ai-prompt">
        “{query ? `A ${query} form` : "A booking form for my photography studio, with a deposit"}”
      </span>
      <span className="fk-tb-ai-copy">Ask Formkit writes the whole form from one sentence. 3 AI builds a month on Free.</span>
      <span className="fk-tb-go">
        Build it with AI <ArrowRight size={15} strokeWidth={2} aria-hidden />
      </span>
    </Link>
  );
}

export function TemplateCard({ t }: { t: BrowserTemplate }) {
  return (
    <Link href={`/templates/${t.slug}`} className="fk-tb-card">
      <span className="fk-tb-mini" style={{ ["--accent" as string]: t.accent }} aria-hidden>
        <span className="fk-tb-sheet">
          <span className="fk-tb-sheet-top">
            <Glyph name={t.icon} size={13} />
            {t.welcome}
          </span>
          {t.first.map((q) => (
            <span key={q.title} className="fk-tb-mq">
              <span className="fk-tb-mq-title">{q.title}</span>
              <Mini q={q} />
            </span>
          ))}
        </span>
      </span>
      <span className="fk-tb-copy">
        <span className="fk-tb-cat">{t.category}</span>
        <b>{t.name}</b>
        <span className="fk-tb-blurb">{t.blurb}</span>
        <span className="fk-tb-meta">
          {t.count} questions · {t.time}
          {t.logic && " · Logic"}
        </span>
      </span>
    </Link>
  );
}

/** A question's answer area, drawn small by type. */
function Mini({ q }: { q: BrowserTemplate["first"][number] }) {
  if ((q.type === "single-choice" || q.type === "multi-choice") && q.options?.length) {
    return (
      <span className="fk-tb-mopts">
        {q.options.slice(0, 3).map((o, i) => (
          <span key={o} data-on={i === 0 || undefined} data-multi={q.type === "multi-choice" || undefined}>
            <i />
            {o}
          </span>
        ))}
      </span>
    );
  }
  if (q.type === "yes-no") {
    return (
      <span className="fk-tb-mpair">
        <span data-on>Yes</span>
        <span>No</span>
      </span>
    );
  }
  if (q.type === "scale" || q.type === "rating") {
    return (
      <span className="fk-tb-mscale">
        {[1, 2, 3, 4, 5].map((n) => (
          <span key={n} data-on={n === 4 || undefined}>
            {n}
          </span>
        ))}
      </span>
    );
  }
  return <span className="fk-tb-mline" data-tall={q.type === "long-text" || undefined} />;
}
