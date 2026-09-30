"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { EmptyState } from "@/components/ui";
import { relativeTime } from "@/components/app/bits";
import { helpArticle } from "@/content/help";

/**
 * Admin → Help centre. What people searched for and did not find (the
 * articles to write next), and the articles people said did not help (the
 * ones to rewrite).
 */
export function AdminHelp() {
  const data = useQuery(api.helpSignals.summary, {});
  if (!data) return null;

  return (
    <>
      <section className="fk-panel">
        <h3>Searches that found nothing</h3>
        {data.missed.length === 0 ? (
          <EmptyState title="Nothing yet" description="Terms people search for in the help centre without a match appear here." />
        ) : (
          <div className="fk-rows">
            {data.missed.map((m) => (
              <div key={m.term} className="fk-row">
                <span className="fk-row-main">
                  <span className="fk-row-title">“{m.term}”</span>
                  <span className="fk-row-meta">Last searched {relativeTime(m.lastAt)}</span>
                </span>
                <span className="fk-row-side">
                  {m.count} {m.count === 1 ? "search" : "searches"}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="fk-panel">
        <h3>Was this helpful?</h3>
        {data.articles.length === 0 ? (
          <EmptyState title="No answers yet" description="Yes and No on each article appear here, least helpful first." />
        ) : (
          <div className="fk-rows">
            {data.articles.map((a) => {
              const article = helpArticle(a.id);
              return (
                <div key={a.id} className="fk-row">
                  <span className="fk-row-main">
                    <span className="fk-row-title">
                      {article ? (
                        <Link href={`/help/${a.id}`} target="_blank">
                          {article.title}
                        </Link>
                      ) : (
                        a.id
                      )}
                    </span>
                    <span className="fk-row-meta">
                      {article?.category.name ?? "Removed article"} · last answer {relativeTime(a.lastAt)}
                    </span>
                  </span>
                  <span className="fk-row-side">
                    {a.yes} yes · {a.no} no
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </>
  );
}
