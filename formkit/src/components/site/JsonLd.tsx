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
    logo: `${siteUrl}/icon.svg`,
    description:
      "A form builder for client-facing work: design the questions, shape the journey, and use what comes back.",
  };
}
