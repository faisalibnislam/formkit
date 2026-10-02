import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { NightSky } from "@/components/brand/NightSky";
import { PublicPage } from "@/components/site/PublicPage";
import { SiteSession } from "@/components/site/SiteSession";

export const metadata: Metadata = {
  title: "Page not found",
  description: "The link is wrong, or the page moved.",
  // Follow the links out, but keep the page itself out of the index.
  robots: { index: false, follow: true },
};

const TRY_THESE = [
  { label: "Templates", href: "/templates" },
  { label: "Pricing", href: "/pricing" },
  { label: "Compare", href: "/compare" },
  { label: "Getting started", href: "/help/create-first-form" },
  { label: "Dashboard", href: "/app" },
  { label: "Sign in", href: "/signin" },
];

export default function NotFound() {
  return (
    <SiteSession>
      <PublicPage>
        <section
          id="fk-main"
          className="fk-hero"
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            padding:
              "calc(104px + clamp(28px,6vw,64px)) clamp(20px,5vw,56px) clamp(56px,8vw,96px)",
          }}
        >
          <NightSky />
          <div
            className="fk-hero-inner"
            style={{
              width: "100%",
              maxWidth: 820,
              margin: "0 auto",
              textAlign: "center",
            }}
          >
            <span
              style={{
                fontSize: 11.5,
                letterSpacing: ".16em",
                color: "rgba(255,255,255,.7)",
              }}
            >
              404
            </span>
            <h1
              style={{
                margin: "16px 0 0",
                fontSize: "clamp(32px,5.2vw,62px)",
                fontWeight: 700,
                letterSpacing: "-.04em",
                lineHeight: 1.02,
                color: "#ffffff",
              }}
            >
              This page has no answers.
            </h1>
            <p
              style={{
                margin: "18px auto 0",
                maxWidth: "48ch",
                fontSize: 16.5,
                lineHeight: 1.6,
                color: "#ffffff",
                opacity: 0.86,
                textWrap: "pretty",
              }}
            >
              The link is wrong, or the page moved. If you were opening
              someone&rsquo;s form, check the address against the one they sent.
              A changed handle or slug is the usual cause.
            </p>

            <div
              style={{
                display: "flex",
                gap: 10,
                flexWrap: "wrap",
                justifyContent: "center",
                marginTop: 30,
              }}
            >
              <Link
                href="/"
                className="fk-pill fk-pill-light"
                style={{ height: 50, padding: "0 24px", fontSize: 15.5 }}
              >
                Formkit home
                <ArrowRight size={17} strokeWidth={1.8} aria-hidden />
              </Link>
              <Link href="/help" className="fk-ghost-pill">
                Search the help center
              </Link>
            </div>

            <div
              style={{
                marginTop: "clamp(36px,5vw,56px)",
                paddingTop: "clamp(24px,3vw,36px)",
                boxShadow: "inset 0 1px 0 rgba(255,255,255,.2)",
              }}
            >
              <div
                style={{
                  fontSize: 11.5,
                  letterSpacing: ".14em",
                  color: "rgba(255,255,255,.55)",
                }}
              >
                TRY ONE OF THESE
              </div>
              <div
                style={{
                  display: "flex",
                  gap: 9,
                  flexWrap: "wrap",
                  justifyContent: "center",
                  marginTop: 16,
                }}
              >
                {TRY_THESE.map((l) => (
                  <Link key={l.href} href={l.href} className="fk-chip-on-sky">
                    {l.label}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </section>
      </PublicPage>
    </SiteSession>
  );
}
