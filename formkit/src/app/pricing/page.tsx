import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  BarChart3,
  Bell,
  Check,
  CreditCard,
  FileDown,
  GitBranch,
  Globe,
  Hash,
  Inbox,
  KeyRound,
  LayoutTemplate,
  Link2,
  Lock,
  Minus,
  Palette,
  ScrollText,
  ShieldCheck,
  Sparkles,
  Users,
  Webhook,
} from "lucide-react";
import { NightSky } from "@/components/brand/NightSky";
import { PublicPage } from "@/components/site/PublicPage";
import { PricingPlans } from "@/components/site/PricingPlans";
import { JsonLd, breadcrumb, faqPage } from "@/components/site/JsonLd";
import { SHARE_IMAGE, SITE_URL } from "@/lib/site";
import { FEATURES, PLANS, type Feature, type PlanId } from "../../../convex/model/plans";

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

/** What every plan has, Free included. */
const EVERYONE: { icon: typeof Check; title: string; line: string }[] = [
  { icon: Inbox, title: "Unlimited forms and responses", line: "No caps, no counting, no surprise upgrade." },
  { icon: GitBranch, title: "Pages and conditional logic", line: "Sixteen question types, skips, shows and hides." },
  { icon: Palette, title: "Themes and your logo", line: "Colours, type and layout that look like you." },
  { icon: Link2, title: "Your own link", line: "formkit.app/you, embeds and QR codes." },
  { icon: Bell, title: "Notifications and routing", line: "The right answers to the right inbox." },
  { icon: BarChart3, title: "Analytics and drop-off", line: "Views, completions and where people stop." },
  { icon: FileDown, title: "Partial responses and CSV", line: "Half-finished answers kept, exports any time." },
  { icon: ShieldCheck, title: "Spam protection", line: "A quiet check, plus limits on floods." },
];

const ALLOWANCES: { label: string; unit?: string; value: (p: PlanId) => number | null; show: (p: PlanId) => string }[] = [
  { label: "Ask Formkit credits a month", value: (p) => PLANS[p].aiCredits, show: (p) => String(PLANS[p].aiCredits) },
  { label: "Largest upload", value: (p) => PLANS[p].uploadMb, show: (p) => `${PLANS[p].uploadMb} MB` },
  {
    label: "Collaborators on a form",
    value: (p) => PLANS[p].collaborators,
    show: (p) => (PLANS[p].collaborators === null ? "Unlimited" : String(PLANS[p].collaborators)),
  },
  {
    label: "Companies and brands",
    value: (p) => PLANS[p].companies,
    show: (p) => (PLANS[p].companies === null ? "Unlimited" : String(PLANS[p].companies)),
  },
  {
    label: "Version history",
    value: (p) => PLANS[p].historyDays,
    show: (p) => (PLANS[p].historyDays === null ? "Forever" : PLANS[p].historyDays === 365 ? "1 year" : `${PLANS[p].historyDays} days`),
  },
];

/** A bar's length: unlimited is full, the rest against the largest finite value in the row. */
function barFor(row: (typeof ALLOWANCES)[number], p: PlanId) {
  const v = row.value(p);
  if (v === null) return 100;
  const finite = (["free", "pro", "business"] as const).map((x) => row.value(x)).filter((x): x is number => x !== null);
  const max = Math.max(...finite, 1) * (finite.length < 3 ? 1.25 : 1);
  return Math.max(8, Math.round((v / max) * 100));
}

const FAQS = [
  {
    q: "Is the Free plan really free?",
    a: "Yes, for as long as you like, with no card. Unlimited forms and responses, every question type, logic, partial responses, drop-off, themes and your own formkit.app link are all on Free.",
  },
  {
    q: "What does Pro add?",
    a: "Looking like your own brand — a custom domain, no “Made with Formkit”, emails from your domain, your fonts and CSS — plus webhooks, Slack, Google Sheets, payments, smarter forms, unlimited collaborators and up to five companies.",
  },
  {
    q: "Who is Business for?",
    a: "Teams and agencies: AI replies written for every person who answers (30 a month, then $5 for 100 more that roll over), AI insights on responses, AI logic that reads answers, quizzes and exams with a timer and marking, a team with unlimited seats, unlimited brands, shared templates, approval before publishing, an audit log, retention rules, API access and company sign-in.",
  },
  {
    q: "Can I switch between monthly and yearly?",
    a: "Yes. Yearly works out cheaper — Pro is $35 instead of $36, Business $99 instead of $120. Change it from Settings → Plan whenever you like.",
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
  {
    q: "Do you take a cut of payments my forms collect?",
    a: "No. Payments go straight to your own Stripe account. Formkit never touches the money and takes nothing.",
  },
];

const groups = [...new Set(Object.values(FEATURES).map((f) => f.group))];

const GROUP_ICON: Record<string, typeof Check> = {
  "Your brand": Palette,
  Responses: Inbox,
  "Smarter forms": Sparkles,
  Teams: Users,
  Connections: Webhook,
  Control: ShieldCheck,
};

function Yes() {
  return (
    <span className="fk-cmp-yes" aria-label="Included">
      <Check size={13} strokeWidth={2.6} aria-hidden />
    </span>
  );
}
function No() {
  return (
    <span className="fk-cmp-no" aria-label="Not included">
      <Minus size={14} strokeWidth={2} aria-hidden />
    </span>
  );
}

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
        <section className="fk-hero fk-price-hero">
          <NightSky />
          <div className="fk-hero-inner fk-price-hero-inner">
            <span className="fk-price-eyebrow">Pricing</span>
            <h1 className="fk-price-title">
              Free to start.
              <br />
              <span>Simple when you grow.</span>
            </h1>
            <p className="fk-price-sub">
              Unlimited forms and responses on Free, for as long as you like. Pro puts your own brand and tools on it;
              Business brings your whole team.
            </p>
            <ul className="fk-price-trust">
              <li>
                <Check size={14} strokeWidth={2.4} aria-hidden /> No card for Free
              </li>
              <li>
                <Check size={14} strokeWidth={2.4} aria-hidden /> Cancel any time
              </li>
              <li>
                <Check size={14} strokeWidth={2.4} aria-hidden /> Nothing deleted on a downgrade
              </li>
            </ul>
            <PricingPlans />
          </div>
        </section>

        <main id="fk-main" className="fk-main fk-price-main">
          <div className="fk-measure">

            {/* Every plan */}
            <section className="fk-price-section fk-price-everyone">
              <div className="fk-price-section-head">
                <span className="fk-price-kicker">On every plan</span>
                <h2 className="fk-price-h2">The whole form builder, free.</h2>
                <p className="fk-price-lede">Nothing below is a trial. It is what Free is.</p>
              </div>
              <div className="fk-price-tiles">
                {EVERYONE.map((t) => (
                  <div key={t.title} className="fk-price-tile">
                    <span className="fk-price-tile-icon">
                      <t.icon size={18} strokeWidth={1.8} aria-hidden />
                    </span>
                    <strong>{t.title}</strong>
                    <span>{t.line}</span>
                  </div>
                ))}
              </div>
            </section>

            {/* Spotlights */}
            <section className="fk-price-section">
              <div className="fk-price-section-head">
                <span className="fk-price-kicker">Pro</span>
                <h2 className="fk-price-h2">Look like you, and plug into everything.</h2>
              </div>
              <div className="fk-price-spots">
                <div className="fk-price-spot">
                  <div className="fk-spot-art fk-spot-domain">
                    <div className="fk-spot-browser">
                      <span className="fk-spot-dots">
                        <i />
                        <i />
                        <i />
                      </span>
                      <span className="fk-spot-url">
                        <Lock size={11} strokeWidth={2} aria-hidden /> forms.studionine.co/intake
                      </span>
                    </div>
                    <div className="fk-spot-page">
                      <b>Tell us about your project</b>
                      <i />
                      <i style={{ width: "62%" }} />
                    </div>
                  </div>
                  <h3>
                    <Globe size={16} strokeWidth={1.8} aria-hidden /> Your domain, your emails
                  </h3>
                  <p>Forms at forms.yourcompany.com, confirmations from your own address, no Formkit badge.</p>
                </div>

                <div className="fk-price-spot">
                  <div className="fk-spot-art fk-spot-pay">
                    <div className="fk-spot-checkout">
                      <span className="fk-spot-label">Workshop seat</span>
                      <b>$25.00</b>
                      <span className="fk-spot-card">
                        <CreditCard size={13} strokeWidth={1.8} aria-hidden /> •••• 4242
                      </span>
                      <span className="fk-spot-paybtn">Pay</span>
                    </div>
                    <span className="fk-spot-paid">
                      <BadgeCheck size={13} strokeWidth={2} aria-hidden /> Paid
                    </span>
                  </div>
                  <h3>
                    <CreditCard size={16} strokeWidth={1.8} aria-hidden /> Take payments
                  </h3>
                  <p>People pay after they send the form, through your own Stripe. Formkit takes nothing.</p>
                </div>

                <div className="fk-price-spot">
                  <div className="fk-spot-art fk-spot-connect">
                    <div className="fk-spot-msg">
                      <span className="fk-spot-avatar">
                        <Hash size={13} strokeWidth={2} aria-hidden />
                      </span>
                      <span>
                        <b>New response to Client intake</b>
                        <em>Budget: $5,000 · Timeline: 6 weeks</em>
                      </span>
                    </div>
                    <div className="fk-spot-chips">
                      <span>Webhooks</span>
                      <span>Zapier</span>
                      <span>Make</span>
                      <span>Sheets</span>
                    </div>
                  </div>
                  <h3>
                    <Webhook size={16} strokeWidth={1.8} aria-hidden /> Send answers anywhere
                  </h3>
                  <p>Slack, Google Sheets, Zapier, Make or your own webhook — the moment a response lands.</p>
                </div>
              </div>
            </section>

            <section className="fk-price-section fk-price-biz">
              <div className="fk-price-biz-copy">
                <span className="fk-price-kicker" data-tone="inverse">
                  Business
                </span>
                <h2 className="fk-price-h2">Built for the whole team.</h2>
                <p className="fk-price-lede">
                  Everyone on every form, with the controls an organisation needs.
                </p>
                <ul className="fk-price-biz-list">
                  <li>
                    <Users size={16} strokeWidth={1.8} aria-hidden /> Unlimited seats and brands
                  </li>
                  <li>
                    <BadgeCheck size={16} strokeWidth={1.8} aria-hidden /> Approval before publishing
                  </li>
                  <li>
                    <LayoutTemplate size={16} strokeWidth={1.8} aria-hidden /> Templates shared across the team
                  </li>
                  <li>
                    <ScrollText size={16} strokeWidth={1.8} aria-hidden /> Audit log and data retention
                  </li>
                  <li>
                    <KeyRound size={16} strokeWidth={1.8} aria-hidden /> API and company sign-in
                  </li>
                </ul>
                <Link href="/app/settings?tab=plan&upgrade=business&interval=year" className="fk-pill fk-pill-lg fk-pill-light">
                  Get Business <ArrowRight size={16} strokeWidth={1.8} aria-hidden />
                </Link>
              </div>
              <div className="fk-price-biz-art" aria-hidden>
                <div className="fk-biz-card">
                  <div className="fk-biz-head">
                    <b>Team</b>
                    <span>Unlimited seats</span>
                  </div>
                  {[
                    ["MO", "Maya Ortiz", "Admin", "#2e78bb"],
                    ["RM", "Ravi Menon", "Editor", "#4b9d6e"],
                    ["PS", "Priya Shah", "Editor", "#c98a1e"],
                    ["LK", "Leo Kim", "Viewer", "#7a5480"],
                  ].map(([i, n, r, c]) => (
                    <div key={n} className="fk-biz-row">
                      <span className="fk-biz-face" style={{ background: c }}>
                        {i}
                      </span>
                      <span className="fk-biz-name">{n}</span>
                      <span className="fk-biz-role">{r}</span>
                    </div>
                  ))}
                </div>
                <div className="fk-biz-approve">
                  <BadgeCheck size={16} strokeWidth={2} aria-hidden />
                  <span>
                    <b>Priya asked to publish Event RSVP</b>
                    <em>Approve and publish · Send back</em>
                  </span>
                </div>
              </div>
            </section>

            {/* Allowances */}
            <section className="fk-price-section">
              <div className="fk-price-section-head">
                <span className="fk-price-kicker">Allowances</span>
                <h2 className="fk-price-h2">How far each plan goes.</h2>
              </div>
              <div className="fk-price-allow">
                <div className="fk-price-allow-head">
                  <span />
                  {(["free", "pro", "business"] as const).map((p) => (
                    <span key={p} data-plan={p}>
                      {PLANS[p].name}
                    </span>
                  ))}
                </div>
                {ALLOWANCES.map((row) => (
                  <div key={row.label} className="fk-price-allow-row">
                    <span className="fk-price-allow-label">{row.label}</span>
                    {(["free", "pro", "business"] as const).map((p) => (
                      <span key={p} className="fk-price-allow-cell" data-plan={p}>
                        <span className="fk-price-allow-val">{row.show(p)}</span>
                        <span className="fk-price-allow-bar">
                          <i style={{ width: `${barFor(row, p)}%` }} />
                        </span>
                      </span>
                    ))}
                  </div>
                ))}
              </div>
            </section>

            {/* Full comparison */}
            <section className="fk-price-section">
              <div className="fk-price-section-head">
                <span className="fk-price-kicker">Compare</span>
                <h2 className="fk-price-h2">Every feature, plan by plan.</h2>
              </div>
              <div className="fk-cmp-wrap">
                <table className="fk-cmp">
                  <thead>
                    <tr>
                      <th scope="col">
                        <span className="sr-only">Feature</span>
                      </th>
                      {(["free", "pro", "business"] as const).map((p) => (
                        <th key={p} scope="col" data-plan={p}>
                          <b>{PLANS[p].name}</b>
                          <span>{p === "free" ? "$0" : `$${PLANS[p].price.month}/mo`}</span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="fk-cmp-group">
                      <th scope="colgroup" colSpan={4}>
                        <span className="fk-cmp-group-label">
                          <Inbox size={15} strokeWidth={1.8} aria-hidden /> On every plan
                        </span>
                      </th>
                    </tr>
                    {EVERYONE.map((row) => (
                      <tr key={row.title}>
                        <th scope="row">{row.title}</th>
                        <td>
                          <Yes />
                        </td>
                        <td>
                          <Yes />
                        </td>
                        <td>
                          <Yes />
                        </td>
                      </tr>
                    ))}
                    {groups.map((g) => (
                      <GroupRows key={g} group={g} />
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {/* FAQ */}
            <section className="fk-price-section">
              <div className="fk-price-section-head">
                <span className="fk-price-kicker">Questions</span>
                <h2 className="fk-price-h2">About pricing.</h2>
              </div>
              <div className="fk-price-faq">
                {FAQS.map((f) => (
                  <details key={f.q} className="fk-price-q">
                    <summary>{f.q}</summary>
                    <p>{f.a}</p>
                  </details>
                ))}
              </div>
            </section>
          </div>

          <section className="fk-price-final">
            <NightSky />
            <div className="fk-price-final-inner">
              <h2>Your next form is free.</h2>
              <p>Start on Free and upgrade the day you need your own domain, payments or your team.</p>
              <div className="fk-price-final-ctas">
                <Link href="/signup" className="fk-pill fk-pill-lg fk-pill-light">
                  Start building free <ArrowRight size={16} strokeWidth={1.8} aria-hidden />
                </Link>
                <Link href="/templates" className="fk-pill fk-pill-lg fk-price-ghost">
                  Browse templates
                </Link>
              </div>
            </div>
          </section>
        </main>
      </PublicPage>
    </>
  );
}

function GroupRows({ group }: { group: string }) {
  const rows = (Object.keys(FEATURES) as Feature[]).filter((f) => FEATURES[f].group === group);
  const Icon = GROUP_ICON[group] ?? Check;
  return (
    <>
      <tr className="fk-cmp-group">
        <th scope="colgroup" colSpan={4}>
          <span className="fk-cmp-group-label">
            <Icon size={15} strokeWidth={1.8} aria-hidden /> {group}
          </span>
        </th>
      </tr>
      {rows.map((f) => (
        <tr key={f}>
          <th scope="row">{FEATURES[f].label}</th>
          <td>
            <No />
          </td>
          <td>{FEATURES[f].plan === "pro" ? <Yes /> : <No />}</td>
          <td>
            <Yes />
          </td>
        </tr>
      ))}
    </>
  );
}
