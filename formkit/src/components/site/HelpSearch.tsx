"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { HELP_ARTICLES } from "@/content/help";

/**
 * Search over article titles, summaries and body text, with a snippet showing
 * where the match landed. Client-side because the whole corpus is 37KB and
 * ships with the page anyway.
 */
function snippet(body: string, term: string) {
  const at = body.toLowerCase().indexOf(term);
  if (at === -1) return null;
  const from = Math.max(0, at - 60);
  const to = Math.min(body.length, at + term.length + 90);
  return `${from > 0 ? "…" : ""}${body.slice(from, to).replace(/\n/g, " ")}${to < body.length ? "…" : ""}`;
}

export function HelpSearch() {
  const [term, setTerm] = useState("");
  const query = term.trim().toLowerCase();

  const results = useMemo(() => {
    if (query.length < 2) return [];
    return HELP_ARTICLES.filter(
      (a) =>
        a.title.toLowerCase().includes(query) ||
        a.summary.toLowerCase().includes(query) ||
        a.body.toLowerCase().includes(query),
    )
      .slice(0, 12)
      .map((a) => ({ article: a, match: snippet(a.body, query) }));
  }, [query]);

  return (
    <div>
      <div className="fk-help-search">
        <Search size={18} strokeWidth={1.8} aria-hidden style={{ opacity: 0.7 }} />
        <input
          type="search"
          aria-label="Search the help center"
          placeholder="Search the help center"
          value={term}
          onChange={(e) => setTerm(e.target.value)}
        />
      </div>

      {query.length >= 2 && (
        <div
          style={{
            marginTop: 20,
            padding: "4px 22px 18px",
            borderRadius: "var(--radius-card)",
            background: "var(--neutral-0)",
            color: "var(--neutral-900)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "16px 0 0", flexWrap: "wrap" }}>
            <p style={{ flex: 1, margin: 0, fontSize: 13.5, color: "var(--color-text-tertiary)" }}>
              {results.length === 0
                ? `Nothing matches “${term.trim()}”. Try a shorter word, or browse the categories below.`
                : `${results.length} article${results.length === 1 ? "" : "s"} match “${term.trim()}”`}
            </p>
            <button type="button" className="fk-help-clear" onClick={() => setTerm("")}>
              Clear search
            </button>
          </div>
          {results.map(({ article, match }) => (
            <Link key={article.id} href={`/help/${article.id}`} className="fk-help-result">
              <span
                style={{
                  display: "block",
                  fontSize: 11.5,
                  letterSpacing: ".12em",
                  color: "var(--color-text-tertiary)",
                }}
              >
                {article.category.name.toUpperCase()}
              </span>
              <span
                className="fk-help-result-title"
                style={{
                  display: "block",
                  marginTop: 5,
                  fontSize: 16,
                  fontWeight: 500,
                }}
              >
                {article.title}
              </span>
              <span
                style={{
                  display: "block",
                  marginTop: 4,
                  fontSize: 14,
                  lineHeight: 1.6,
                  color: "var(--color-text-secondary)",
                }}
              >
                {match ?? article.summary}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
