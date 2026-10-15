import type { Metadata } from "next";
import { NightSky } from "@/components/brand/NightSky";
import { PublicPage } from "@/components/site/PublicPage";
import { SupportThread } from "@/components/support/SupportThread";

// A private conversation: never indexed, never shared in a preview.
export const metadata: Metadata = { title: "Your message to Formkit", robots: { index: false, follow: false } };

/** The private link sent with every answer from Formkit support (convex/support.ts). */
export default async function SupportTicketPage({ params }: PageProps<"/support/[token]">) {
  const { token } = await params;
  return (
    <PublicPage>
      <section
        className="fk-hero"
        style={{ padding: "calc(104px + clamp(20px,4vw,44px)) clamp(20px,5vw,56px) clamp(36px,5vw,56px)" }}
      >
        <NightSky />
        <div className="fk-hero-inner fk-measure">
          <h1 style={{ margin: 0, fontSize: "clamp(28px,4vw,48px)", fontWeight: 700, letterSpacing: "-.035em", lineHeight: 1.05, color: "#ffffff" }}>
            Your message to Formkit
          </h1>
        </div>
      </section>
      <main id="fk-main" className="fk-main" style={{ padding: "clamp(28px,4vw,52px) clamp(20px,5vw,56px) clamp(44px,6vw,72px)" }}>
        <div className="fk-measure">
          <SupportThread token={token} />
        </div>
      </main>
    </PublicPage>
  );
}
