import { Fragment } from "react";

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

export function HelpArticleBody({ body }: { body: string }) {
  return (
    <div className="fk-article">
      {parse(body).map((block, i) => (
        <Fragment key={i}>
          {block.kind === "heading" && <h2>{block.text}</h2>}
          {block.kind === "para" && <p>{block.text}</p>}
          {block.kind === "callout" && (
            <aside className="fk-callout">{block.text}</aside>
          )}
          {block.kind === "list" && (
            <ul>
              {block.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          )}
        </Fragment>
      ))}
    </div>
  );
}
