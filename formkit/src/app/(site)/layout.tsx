import { SiteSession } from "@/components/site/SiteSession";

/**
 * The marketing pages: static, the same for everyone, served from the CDN.
 * Who is signed in is worked out in the browser (SiteSession).
 */
export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return <SiteSession>{children}</SiteSession>;
}
