import { Analytics } from "@/components/site/Analytics";
import { SiteSession } from "@/components/site/SiteSession";
import "@/styles/site.css";

/**
 * The marketing pages: static, the same for everyone, served from the CDN.
 * Who is signed in is worked out in the browser (SiteSession). Google
 * Analytics, behind its consent banner, is mounted here and nowhere else.
 */
export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <SiteSession>
      {children}
      <Analytics />
    </SiteSession>
  );
}
