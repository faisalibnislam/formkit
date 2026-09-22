import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { NightSky } from "@/components/brand/NightSky";
import { PublicPage } from "@/components/site/PublicPage";
import { JsonLd, breadcrumb, faqPage } from "@/components/site/JsonLd";
import { SITE_URL } from "@/lib/site";

const TITLE = "Pricing — Formkit is free";
const DESCRIPTION =
  "Formkit is free. Unlimited forms, unlimited responses, conditional logic, your own branding and link, analytics, exports and collaborators — with no paid tier holding anything back.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: `${SITE_URL}/pricing` },
  openGraph: {
    type: "website",
    siteName: "Formkit",
    url: `${SITE_URL}/pricing`,
    title: TITLE,
    description:
      "Every feature, every form, every response. No plans, no card, nothing withheld.",
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description:
      "Every feature, every form, every response. No plans, no card, nothing withheld.",
  },
};

const INCLUDED = [
  { title: "Unlimited forms", note: "Build and publish as many as you like" },
  { title: "Unlimited responses", note: "No monthly cap, no overage" },
  {
    title: "Sixteen question types",
    note: "Text, choice, scale, file, signature and more",
  },
  { title: "Conditional logic", note: "Skip a page, show or hide a question" },
  { title: "Your own branding", note: "Colours, type, logo and a two-mark lockup" },
  { title: "Your own link", note: "formkit.app/your-name, or one per company" },
  { title: "Response inbox", note: "Filters, bulk actions and partial responses" },
  { title: "Analytics", note: "Views, starts, completion and drop-off by question" },
  {
    title: "Notifications and routing",
    note: "Send each answer to the right person",
  },
  { title: "Collaborators", note: "Editor, Commenter and Viewer, at no cost" },
  { title: "Version history", note: "Every publish snapshotted and restorable" },
  { title: "CSV and Excel export", note: "Filtered, or just the rows you ticked" },
];

const LIMITS = [
  {
    title: "File uploads cap at 10 MB",
    body: "Each file a respondent sends can be up to 10 MB. A question can also restrict which extensions it accepts. The cap is fixed and shown to the respondent, so nobody wastes time on a file that will be refused.",
  },
  {
    title: "Forms are English (US) only",
    body: "The language picker was removed rather than left in place offering translations that do not exist. Your questions can of course be written in any language; the interface around them is English.",
  },
  {
    title: "AI form building is enabled per account",
    body: "Ask Formkit drafts a form from a brief. It is switched on for individual accounts by a Formkit administrator rather than being available to everyone, and it has a monthly credit allowance that only new drafts spend.",
  },
];

const FAQS = [
  {
    q: "Is Formkit really free?",
    a: "Yes. There are no plans, no billing page and no card. Every feature listed above is on every account from the moment you sign up.",
  },
  {
    q: "Will you add a paid tier later?",
    a: "Nothing is announced. If that changes, it will not be by removing something you already rely on.",
  },
  {
    q: "Is there a limit on forms or responses?",
    a: "No. Build as many forms as you like, and collect as many responses as come in.",
  },
  {
    q: "Do collaborators cost anything?",
    a: "No. Invite as many people as you need to a form as Editor, Commenter or Viewer. An Editor can change the form and read its responses from their own account.",
  },
  {
    q: "Can I export my data and leave?",
    a: "Yes, any time, to CSV or Excel. Deleting your account removes your forms, responses and uploaded files.",
  },
  {
    q: "What is the catch?",
    a: "The three limits above, stated plainly. Beyond those, the product you see is the product you get.",
  },
];

const H2: React.CSSProperties = {
  margin: 0,
  fontSize: "clamp(24px,3.2vw,40px)",
  fontWeight: 700,
  letterSpacing: "-.03em",
};

export default function PricingPage() {
  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "Product",
              name: "Formkit",
              description:
                "Online form builder with conditional logic, branding, a response inbox, analytics and CSV or Excel export.",
              brand: { "@type": "Brand", name: "Formkit" },
              offers: {
                "@type": "Offer",
                price: "0",
                priceCurrency: "USD",
                availability: "https://schema.org/InStock",
                url: `${SITE_URL}/pricing`,
              },
            },
            breadcrumb([
              { name: "Formkit", url: `${SITE_URL}/` },
              { name: "Pricing", url: `${SITE_URL}/pricing` },
            ]),
            faqPage(FAQS.slice(0, 4).map((f) => ({ q: f.q, a: f.a }))),
          ],
        }}
      />

      <PublicPage current="pricing">
        <section
          className="fk-hero"
          style={{
            padding:
              "calc(104px + clamp(20px,4vw,44px)) clamp(20px,5vw,56px) clamp(52px,6vw,80px)",
          }}
        >
          <NightSky />
          <div className="fk-hero-inner fk-measure">
            <nav
              aria-label="Breadcrumb"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 9,
                marginBottom: 16,
                fontSize: 13,
                color: "rgba(255,255,255,.72)",
              }}
            >
              <Link href="/" style={{ color: "rgba(255,255,255,.8)" }}>
                Formkit
              </Link>
              <span>/</span>
              <span style={{ color: "#ffffff" }}>Pricing</span>
            </nav>

            <h1
              style={{
                margin: 0,
                maxWidth: "14ch",
                fontSize: "clamp(34px,5.4vw,66px)",
                fontWeight: 700,
                letterSpacing: "-.04em",
                lineHeight: 1,
                color: "#ffffff",
              }}
            >
              Formkit is free.
            </h1>

            <p
              style={{
                margin: "18px 0 0",
                maxWidth: "54ch",
                fontSize: 17,
                lineHeight: 1.6,
                color: "#ffffff",
                opacity: 0.88,
                textWrap: "pretty",
              }}
            >
              Not free for a while, not free up to a hundred responses, not free until you
              need the useful part. There is no paid tier, so there is nothing held back
              from you.
            </p>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                flexWrap: "wrap",
                marginTop: 30,
              }}
            >
              <Link href="/signup" className="fk-pill fk-pill-light fk-pill-lg">
                Start building free
                <ArrowRight size={17} strokeWidth={1.8} aria-hidden />
              </Link>
              <span style={{ fontSize: 14.5, color: "rgba(255,255,255,.78)" }}>
                No credit card, no trial clock
              </span>
            </div>
          </div>
        </section>

        <main
          id="fk-main"
          className="fk-main"
          style={{
            padding: "clamp(34px,5vw,64px) clamp(20px,5vw,56px) clamp(44px,6vw,72px)",
          }}
        >
          <div className="fk-measure">
            <h2 style={{ ...H2, maxWidth: "22ch" }}>
              What you get, which is everything
            </h2>

            {/* A 1px gap over a neutral-200 ground draws the hairline grid —
                no borders, which the design system reserves for nothing. */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit,minmax(min(260px,100%),1fr))",
                gap: 1,
                marginTop: "clamp(24px,3vw,40px)",
                background: "var(--neutral-200)",
              }}
            >
              {INCLUDED.map((f) => (
                <div
                  key={f.title}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 13,
                    padding: "20px 22px",
                    background: "var(--neutral-0)",
                  }}
                >
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      width: 24,
                      height: 24,
                      flex: "0 0 auto",
                      borderRadius: "50%",
                      background: "var(--green-100)",
                      color: "var(--green-600)",
                    }}
                  >
                    <Check size={14} strokeWidth={2.2} aria-hidden />
                  </span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span
                      style={{
                        display: "block",
                        fontSize: 15.5,
                        fontWeight: 500,
                        color: "var(--neutral-900)",
                      }}
                    >
                      {f.title}
                    </span>
                    <span
                      style={{
                        display: "block",
                        marginTop: 3,
                        fontSize: 13.5,
                        lineHeight: 1.5,
                        color: "var(--color-text-tertiary)",
                      }}
                    >
                      {f.note}
                    </span>
                  </span>
                </div>
              ))}
            </div>

            <h2
              style={{
                ...H2,
                margin: "clamp(44px,6vw,80px) 0 0",
                maxWidth: "22ch",
              }}
            >
              The honest limits
            </h2>
            <p
              style={{
                margin: "12px 0 0",
                maxWidth: "58ch",
                fontSize: 15.5,
                lineHeight: 1.6,
                color: "var(--color-text-secondary)",
                textWrap: "pretty",
              }}
            >
              Three things Formkit does not do yet. They are stated here rather than
              discovered later.
            </p>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit,minmax(min(280px,100%),1fr))",
                gap: 18,
                marginTop: 22,
              }}
            >
              {LIMITS.map((l) => (
                <div
                  key={l.title}
                  style={{
                    padding: 22,
                    borderRadius: "var(--radius-card)",
                    background: "var(--neutral-50)",
                  }}
                >
                  <h3 style={{ margin: 0, fontSize: 16.5, fontWeight: 500 }}>{l.title}</h3>
                  <p
                    style={{
                      margin: "8px 0 0",
                      fontSize: 14.5,
                      lineHeight: 1.6,
                      color: "var(--color-text-secondary)",
                      textWrap: "pretty",
                    }}
                  >
                    {l.body}
                  </p>
                </div>
              ))}
            </div>

            <h2 style={{ ...H2, margin: "clamp(44px,6vw,80px) 0 0" }}>
              Questions about pricing
            </h2>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                maxWidth: "70ch",
                marginTop: 14,
              }}
            >
              {FAQS.map((f) => (
                <div
                  key={f.q}
                  style={{
                    padding: "18px 0",
                    boxShadow: "inset 0 1px 0 var(--neutral-200)",
                  }}
                >
                  <h3 style={{ margin: 0, fontSize: 16.5, fontWeight: 500 }}>{f.q}</h3>
                  <p
                    style={{
                      margin: "8px 0 0",
                      fontSize: 15,
                      lineHeight: 1.6,
                      color: "var(--color-text-secondary)",
                      textWrap: "pretty",
                    }}
                  >
                    {f.a}
                  </p>
                </div>
              ))}
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 14,
                flexWrap: "wrap",
                marginTop: "clamp(36px,5vw,64px)",
                padding: 26,
                borderRadius: "var(--radius-card)",
                background: "var(--blue-50)",
              }}
            >
              <span
                style={{
                  flex: 1,
                  minWidth: 220,
                  maxWidth: "40ch",
                  fontSize: 17,
                  lineHeight: 1.5,
                  fontWeight: 500,
                }}
              >
                Still deciding? Open a template and publish it — that costs nothing
                either.
              </span>
              <Link href="/templates" className="fk-pill fk-pill-dark fk-pill-md">
                Browse templates
              </Link>
            </div>
          </div>
        </main>
      </PublicPage>
    </>
  );
}

