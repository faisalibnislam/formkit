import { Fragment, type ReactNode } from "react";
import Link from "next/link";
import { HELP_ARTICLES } from "@/content/help";

/**
 * Renders a help article body.
 *
 * The bodies use a deliberately small Markdown subset, so this is a parser
 * rather than a dependency: `## ` is a heading, `- ` a bullet, `> ` a callout,
 * and anything else a paragraph. Consecutive bullets group into one list.
 */
type Block =
  | { kind: "heading"; text: string }
  | { kind: "para"; text: string }
  | { kind: "callout"; text: string }
  | { kind: "list"; items: string[] };

function parse(body: string): Block[] {
  const blocks: Block[] = [];
  for (const raw of body.split("\n")) {
    const line = raw.trim();
    if (!line) continue;

    if (line.startsWith("## ")) {
      blocks.push({ kind: "heading", text: line.slice(3) });
    } else if (line.startsWith("- ")) {
      const last = blocks[blocks.length - 1];
      if (last?.kind === "list") last.items.push(line.slice(2));
      else blocks.push({ kind: "list", items: [line.slice(2)] });
    } else if (line.startsWith("> ")) {
      blocks.push({ kind: "callout", text: line.slice(2) });
    } else {
      blocks.push({ kind: "para", text: line });
    }
  }
  return blocks;
}

/** A heading's anchor: "Turning auto-renew off" → "turning-auto-renew-off". */
function slugify(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/** The article's ## headings, for "On this page". */
export function headingsOf(body: string) {
  return body
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.startsWith("## "))
    .map((l) => ({ text: l.slice(3), id: slugify(l.slice(3)) }));
}

/** Minutes to read, at about 220 words a minute. */
export function readingMinutes(body: string) {
  return Math.max(1, Math.round(body.split(/\s+/).length / 220));
}

/** "See <article title>." becomes a link to that article. */
const BY_TITLE = new Map(HELP_ARTICLES.map((a) => [a.title, a.id]));
const SEE = /(See |see )([A-Z][^.]*?[.?])(?=\s|$)/g;

function inline(text: string): ReactNode {
  const parts: ReactNode[] = [];
  let at = 0;
  for (const m of text.matchAll(SEE)) {
    const raw = m[2]!;
    const title = raw.endsWith("?") ? raw : raw.slice(0, -1);
    const id = BY_TITLE.get(title);
    if (!id) continue;
    const start = m.index! + m[1]!.length;
    parts.push(text.slice(at, start), <Link key={start} href={`/help/${id}`}>{title}</Link>);
    at = start + title.length;
  }
  if (at === 0) return text;
  parts.push(text.slice(at));
  return parts;
}

export function HelpArticleBody({ body }: { body: string }) {
  return (
    <div className="fk-article">
      {parse(body).map((block, i) => (
        <Fragment key={i}>
          {block.kind === "heading" && (
            <h2 id={slugify(block.text)}>
              <a href={`#${slugify(block.text)}`} className="fk-article-anchor" aria-hidden tabIndex={-1}>
                #
              </a>
              {block.text}
            </h2>
          )}
          {block.kind === "para" && <p>{inline(block.text)}</p>}
          {block.kind === "callout" && (
            <aside className="fk-callout">{inline(block.text)}</aside>
          )}
          {block.kind === "list" && (
            <ul>
              {block.items.map((item) => (
                <li key={item}>{inline(item)}</li>
              ))}
            </ul>
          )}
        </Fragment>
      ))}
    </div>
  );
}
