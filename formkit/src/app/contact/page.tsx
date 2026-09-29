import type { Metadata } from "next";
import Link from "next/link";
import { LifeBuoy, Mail, ShieldCheck } from "lucide-react";
import { NightSky } from "@/components/brand/NightSky";
import { PublicPage } from "@/components/site/PublicPage";
import { JsonLd, breadcrumb, organization } from "@/components/site/JsonLd";
import { SupportForm } from "@/components/support/ContactSupport";
import { SHARE_IMAGE, SITE_URL } from "@/lib/site";

const TITLE = "Contact";
const DESCRIPTION =
  "Write to Formkit: support for your forms and account, privacy and data requests, and everything else. A person reads every message.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: `${SITE_URL}/contact` },
  openGraph: {
    images: [SHARE_IMAGE],
    type: "website",
    siteName: "Formkit",
    url: `${SITE_URL}/contact`,
    title: `${TITLE} | Formkit`,
    description: DESCRIPTION,
  },
};

/** Who to write to, for what. */
const INBOXES = [
  {
    icon: LifeBuoy,
    name: "Support",
    email: "support@formkit.app",
    what: "Help with a form, your account, billing or anything that is not working.",
  },
  {
    icon: ShieldCheck,
    name: "Privacy",
    email: "privacy@formkit.app",
    what: "Data requests, a copy of what we hold about you, and privacy questions. Answered within five working days.",
  },
  {
    icon: Mail,
    name: "Everything else",
    email: "hello@formkit.app",
    what: "Partnerships, press, the DPA, or just saying hello.",
  },
];

export default function ContactPage() {
  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@graph": [
            organization(SITE_URL),
            breadcrumb([
              { name: "Formkit", url: `${SITE_URL}/` },
              { name: "Contact", url: `${SITE_URL}/contact` },
            ]),
          ],
        }}
      />

      <PublicPage>
        <section
          className="fk-hero"
          style={{
            padding: "calc(104px + clamp(20px,4vw,44px)) clamp(20px,5vw,56px) clamp(48px,6vw,72px)",
          }}
        >
          <NightSky />
          <div className="fk-hero-inner fk-measure">
            <h1
              style={{
                margin: 0,
                maxWidth: "16ch",
                fontSize: "clamp(32px,5vw,60px)",
                fontWeight: 700,
                letterSpacing: "-.04em",
                lineHeight: 1.02,
                color: "#ffffff",
              }}
            >
              Talk to a person
            </h1>
            <p
              style={{
                margin: "16px 0 0",
                maxWidth: "56ch",
                fontSize: 17,
                lineHeight: 1.6,
                color: "#ffffff",
                opacity: 0.88,
                textWrap: "pretty",
              }}
            >
              Every message is read by someone who works on Formkit. Most answers are already in the{" "}
              <Link href="/help" style={{ color: "#ffffff", fontWeight: 600 }}>
                help center
              </Link>
              , if you would rather not wait.
            </p>
          </div>
        </section>

        <main
          id="fk-main"
          className="fk-main"
          style={{ padding: "clamp(34px,5vw,64px) clamp(20px,5vw,56px) clamp(44px,6vw,72px)" }}
        >
          <div className="fk-measure fk-contact">
            <section className="fk-contact-inboxes" aria-labelledby="c-email">
              <h2 id="c-email" className="fk-support-title">
                Email us
              </h2>
              {INBOXES.map((box) => (
                <a key={box.email} href={`mailto:${box.email}`} className="fk-contact-inbox">
                  <span className="fk-help-cat-tile">
                    <box.icon size={18} strokeWidth={1.8} aria-hidden />
                  </span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span className="fk-contact-name">{box.name}</span>
                    <span className="fk-contact-email">{box.email}</span>
                    <span className="fk-contact-what">{box.what}</span>
                  </span>
                </a>
              ))}
            </section>
            <SupportForm />
          </div>
        </main>
      </PublicPage>
    </>
  );
}
