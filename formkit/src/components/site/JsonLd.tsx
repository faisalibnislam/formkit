/**
 * Structured data. Emitted as a plain script tag rather than through the
 * metadata API so a page can ship several graphs at once.
 */
export function JsonLd({ data }: { data: object }) {
  return (
    <script
      type="application/ld+json"
      // The payload is authored in this repo, never user input.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

export function breadcrumb(trail: { name: string; url: string }[]) {
  return {
    "@type": "BreadcrumbList",
    itemListElement: trail.map((t, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: t.name,
      item: t.url,
    })),
  };
}

export function faqPage(faqs: { q: string; a: string }[]) {
  return {
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };
}

export function organization(siteUrl: string) {
  return {
    "@type": "Organization",
    name: "Formkit",
    url: siteUrl,
    logo: `${siteUrl}/icon.png`,
    description:
      "An online form builder: build with AI, add logic that reads answers, take payments, and reply to every response.",
  };
}

/** Formkit as an app, with its plans: Free, and Pro and Business per seat. */
export function softwareApp(siteUrl: string) {
  const perSeat = (name: string, monthly: number) => ({
    "@type": "Offer",
    name,
    price: String(monthly),
    priceCurrency: "USD",
    priceSpecification: {
      "@type": "UnitPriceSpecification",
      price: String(monthly),
      priceCurrency: "USD",
      referenceQuantity: { "@type": "QuantitativeValue", value: 1, unitText: "seat per month" },
    },
    url: `${siteUrl}/pricing`,
  });
  return {
    "@type": "SoftwareApplication",
    name: "Formkit",
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    url: `${siteUrl}/`,
    description:
      "Online form builder: build forms with AI, conditional and AI logic, quizzes, payments, AI replies to every response, analytics and exports. Free to start.",
    offers: [
      { "@type": "Offer", name: "Free", price: "0", priceCurrency: "USD", url: `${siteUrl}/pricing` },
      perSeat("Pro", 6),
      perSeat("Business", 19),
    ],
    featureList: [
      "AI form builder",
      "Conditional logic and AI logic",
      "Calculations, scoring and quizzes",
      "Payments with Stripe",
      "AI replies to every response",
      "AI insights on responses",
      "Custom domains and branding",
      "Slack, Google Sheets, Zapier, Make and webhooks",
      "Companies with members and roles",
      "Response inbox, analytics and exports",
    ],
  };
}

/** A help article, with when it last changed. */
export function article(a: { headline: string; description: string; url: string; updated: string; section?: string }) {
  return {
    "@type": "TechArticle",
    headline: a.headline,
    description: a.description,
    url: a.url,
    dateModified: a.updated,
    ...(a.section ? { articleSection: a.section } : {}),
    author: { "@type": "Organization", name: "Formkit" },
    publisher: { "@type": "Organization", name: "Formkit" },
  };
}
