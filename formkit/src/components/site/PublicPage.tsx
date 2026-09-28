import type { ReactNode } from "react";
import { SiteNav } from "./SiteNav";
import { SiteFooter } from "./SiteFooter";
import type { NavKey } from "@/lib/site";

/**
 * The frame every public page shares: the skip link, the floating nav, the
 * page's own inset cards, then the footer.
 *
 * Children must be `<section>`, `<main>` or `.fk-card` elements - the frame's
 * gutter, radius and sky-blue ring are applied by direct-child selector.
 */
export function PublicPage({
  current,
  children,
}: {
  current?: NavKey;
  children: ReactNode;
}) {
  return (
    <div className="fk-page">
      <a className="fk-skip" href="#fk-main">
        Skip to content
      </a>
      <SiteNav current={current} />
      {children}
      <SiteFooter />
    </div>
  );
}
