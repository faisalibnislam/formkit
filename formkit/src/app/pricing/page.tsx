import type { Metadata } from "next";
import Link from "next/link";
import { NightSky } from "@/components/brand/NightSky";
import { PublicPage } from "@/components/site/PublicPage";
import { PricingPlans } from "@/components/site/PricingPlans";
import { JsonLd, breadcrumb, faqPage } from "@/components/site/JsonLd";
import { SHARE_IMAGE, SITE_URL } from "@/lib/site";
import { FEATURES, PLANS, type Feature } from "../../../convex/model/plans";

const TITLE = "Pricing — Free, Pro and Business";
const DESCRIPTION =
  "Formkit is free to start, with unlimited forms and responses. Pro ($3 a month) adds your own domain, branding and integrations; Business ($10 a month) adds your team.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: `${SITE_URL}/pricing` },
  openGraph: {
    images: [SHARE_IMAGE],
    type: "website",
    siteName: "Formkit",
    url: `${SITE_URL}/pricing`,
    title: TITLE,
    description: DESCRIPTION,
  },
  twitter: { images: [SHARE_IMAGE], card: "summary_large_image", title: TITLE, description: DESCRIPTION },
};

/** What every plan has, Free included — the rows above the paid features. */
const EVERYONE = [
  "Unlimited forms and responses",
  "Sixteen question types, pages and conditional logic",
  "Themes, colours, type and your logo",
  "Your own formkit.app link, embedding and QR codes",
  "Response inbox with filters and bulk actions",
  "Views, starts, completions and average time",
  "Notifications, routing and confirmation emails",
  "CSV export",
  "Spam protection",
];

const LIMIT_ROWS: { label: string; value: (p: keyof typeof PLANS) => string }[] = [
  { label: "Ask Formkit credits a month", value: (p) => String(PLANS[p].aiCredits) },
  { label: "Largest file a respondent can upload", value: (p) => `${PLANS[p].uploadMb} MB` },
  { label: "Version history", value: (p) => (PLANS[p].historyDays === null ? "All of it" : `${PLANS[p].historyDays} days`) },
  { label: "Collaborators on a form", value: (p) => (PLANS[p].collaborators === null ? "Unlimited" : String(PLANS[p].collaborators)) },
  { label: "Companies and brands", value: (p) => (PLANS[p].companies === null ? "Unlimited" : String(PLANS[p].companies)) },
];

const FAQS = [
  {
    q: "Is the Free plan really free?",
    a: "Yes, for as long as you like, with no card. Unlimited forms and unlimited responses, every question type, logic, themes and your own formkit.app link are all on Free.",
  },
  {
    q: "What does Pro add?",
    a: "Looking like your own brand — a custom domain, no “Made with Formkit”, emails from your domain, your fonts and CSS — and getting more from responses: partials, drop-off, webhooks, Slack, Google Sheets, payments and smarter forms.",
  },
  {
    q: "Who is Business for?",
    a: "Teams and agencies: unlimited seats, several brands, shared templates, approval before publishing, an audit log, retention rules, API access and company sign-in.",
  },
  {
    q: "Can I cancel any time?",
    a: "Yes, from Settings → Plan. Your plan stays on until the end of the period you have paid for, and you are not charged again.",
  },
  {
    q: "What happens to my forms if I downgrade?",
    a: "Nothing is deleted. Features outside your new plan simply stop — a custom domain goes back to your formkit.app link — and everything you built or collected stays yours and exportable.",
  },
  {
    q: "Who handles the payment?",
    a: "Polar, who act as the merchant of record. They take the card, add any sales tax or VAT that applies, and send the receipt. Prices are in US dollars.",
  },
];

const H2: React.CSSProperties = {
  margin: 0,
  fontSize: "clamp(24px,3.2vw,40px)",
  fontWeight: 700,
  letterSpacing: "-.03em",
};

const groups = [...new Set(Object.values(FEATURES).map((f) => f.group))];

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
              description: "Online form builder with conditional logic, branding, a response inbox, analytics and exports.",
              brand: { "@type": "Brand", name: "Formkit" },
              offers: (["free", "pro", "business"] as const).map((p) => ({
                "@type": "Offer",
                name: PLANS[p].name,
                price: String(PLANS[p].price.month),
                priceCurrency: "USD",
                availability: "https://schema.org/InStock",
                url: `${SITE_URL}/pricing`,
              })),
            },
            breadcrumb([
              { name: "Formkit", url: `${SITE_URL}/` },
              { name: "Pricing", url: `${SITE_URL}/pricing` },
            ]),
            faqPage(FAQS.map((f) => ({ q: f.q, a: f.a }))),
          ],
        }}
      />

      <PublicPage current="pricing">
        <section
          className="fk-hero"
          style={{ padding: "calc(104px + clamp(20px,4vw,44px)) clamp(20px,5vw,56px) clamp(52px,6vw,80px)" }}
        >
          <NightSky />
          <div className="fk-hero-inner fk-measure">
            <nav
              aria-label="Breadcrumb"
              style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 16, fontSize: 13, color: "rgba(255,255,255,.72)" }}
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
                maxWidth: "16ch",
                fontSize: "clamp(34px,5.4vw,66px)",
                fontWeight: 700,
                letterSpacing: "-.04em",
                lineHeight: 1,
                color: "#ffffff",
              }}
            >
              Free to start. Simple when you grow.
            </h1>
            <p
              style={{
                margin: "18px 0 0",
                maxWidth: "56ch",
                fontSize: 17,
                lineHeight: 1.6,
                color: "#ffffff",
                opacity: 0.88,
                textWrap: "pretty",
              }}
            >
              Unlimited forms and responses on the free plan, for as long as you like. Pro puts your own brand and
              tools on it; Business brings your team.
            </p>
          </div>
        </section>

        <main
          id="fk-main"
          className="fk-main"
          style={{ padding: "clamp(34px,5vw,64px) clamp(20px,5vw,56px) clamp(44px,6vw,72px)" }}
        >
          <div className="fk-measure">
            <PricingPlans />

            <h2 style={{ ...H2, margin: "clamp(44px,6vw,80px) 0 0" }}>Every feature, plan by plan</h2>
            <div className="fk-pricing-table-wrap">
              <table className="fk-plan-table fk-pricing-table">
                <thead>
                  <tr>
                    <th scope="col">
                      <span className="sr-only">Feature</span>
                    </th>
                    <th scope="col">Free</th>
                    <th scope="col">Pro</th>
                    <th scope="col">Business</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="fk-pricing-group">
                    <th scope="colgroup" colSpan={4}>
                      On every plan
                    </th>
                  </tr>
                  {EVERYONE.map((row) => (
                    <tr key={row}>
                      <th scope="row">{row}</th>
                      <td>✓</td>
                      <td>✓</td>
                      <td>✓</td>
                    </tr>
                  ))}
                  <tr className="fk-pricing-group">
                    <th scope="colgroup" colSpan={4}>
                      Allowances
                    </th>
                  </tr>
                  {LIMIT_ROWS.map((row) => (
                    <tr key={row.label}>
                      <th scope="row">{row.label}</th>
                      <td>{row.value("free")}</td>
                      <td>{row.value("pro")}</td>
                      <td>{row.value("business")}</td>
                    </tr>
                  ))}
                  {groups.map((g) => (
                    <GroupRows key={g} group={g} />
                  ))}
                </tbody>
              </table>
            </div>

            <h2 style={{ ...H2, margin: "clamp(44px,6vw,80px) 0 0" }}>Questions about pricing</h2>
            <div style={{ display: "flex", flexDirection: "column", maxWidth: "70ch", marginTop: 14 }}>
              {FAQS.map((f) => (
                <div key={f.q} style={{ padding: "18px 0", boxShadow: "inset 0 1px 0 var(--neutral-200)" }}>
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
              <span style={{ flex: 1, minWidth: 220, maxWidth: "40ch", fontSize: 17, lineHeight: 1.5, fontWeight: 500 }}>
                Still deciding? Open a template and publish it — that costs nothing.
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

function GroupRows({ group }: { group: string }) {
  const rows = (Object.keys(FEATURES) as Feature[]).filter((f) => FEATURES[f].group === group);
  return (
    <>
      <tr className="fk-pricing-group">
        <th scope="colgroup" colSpan={4}>
          {group}
        </th>
      </tr>
      {rows.map((f) => (
        <tr key={f}>
          <th scope="row">{FEATURES[f].label}</th>
          <td aria-label="Not included">—</td>
          <td aria-label={FEATURES[f].plan === "pro" ? "Included" : "Not included"}>{FEATURES[f].plan === "pro" ? "✓" : "—"}</td>
          <td aria-label="Included">✓</td>
        </tr>
      ))}
    </>
  );
}
