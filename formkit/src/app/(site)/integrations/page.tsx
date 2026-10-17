import type { Metadata } from "next";
import { StoryIndex } from "@/components/site/StoryPage";
import { JsonLd, breadcrumb } from "@/components/site/JsonLd";
import { INTEGRATION_PAGES } from "@/content/integrations";
import { SITE_URL } from "@/lib/site";

const title = "Form integrations: Sheets, Notion, HubSpot, Slack";
const description =
  "Send Formkit responses to Google Sheets, Notion, Airtable, HubSpot, Slack, Discord, Microsoft Teams, Stripe and any webhook, the moment they arrive.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: `${SITE_URL}/integrations` },
  openGraph: { type: "website", siteName: "Formkit", url: `${SITE_URL}/integrations`, title: `${title} | Formkit`, description },
  twitter: { card: "summary_large_image", title: `${title} | Formkit`, description },
};

export default function IntegrationsPage() {
  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@graph": [
            breadcrumb([
              { name: "Formkit", url: `${SITE_URL}/` },
              { name: "Integrations", url: `${SITE_URL}/integrations` },
            ]),
            {
              "@type": "ItemList",
              itemListElement: INTEGRATION_PAGES.map((p, i) => ({ "@type": "ListItem", position: i + 1, name: p.name, url: `${SITE_URL}/integrations/${p.slug}` })),
            },
          ],
        }}
      />
      <StoryIndex
        stories={INTEGRATION_PAGES}
        base="integrations"
        crumb="Integrations"
        title="Every response, in the tools you already use."
        lead="Formkit sends each response where your work happens: a row in a sheet or database, a contact in your CRM, a message in your team’s channel, or a signed webhook to your own code."
      />
    </>
  );
}
