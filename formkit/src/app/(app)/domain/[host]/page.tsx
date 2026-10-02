import type { Metadata } from "next";
import Link from "next/link";
import { fetchQuery } from "convex/nextjs";
import { notFound } from "next/navigation";
import { api } from "@convex/_generated/api";

/**
 * The root of a customer's own domain (forms.acme.com): whose it is, and the
 * forms open there. The proxy rewrites the domain's "/" here; each link is
 * relative, so it stays on the customer's domain.
 */

export const dynamic = "force-dynamic";

async function load(host: string) {
  try {
    return await fetchQuery(api.domains.listing, { host });
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: PageProps<"/domain/[host]">): Promise<Metadata> {
  const { host } = await params;
  const data = await load(decodeURIComponent(host));
  return {
    title: { absolute: data ? `${data.name}: forms` : "Forms" },
    robots: { index: false },
    ...(data?.markUrl ? { icons: { icon: data.markUrl, apple: data.markUrl } } : {}),
  };
}

export default async function DomainHome({ params }: PageProps<"/domain/[host]">) {
  const { host } = await params;
  const data = await load(decodeURIComponent(host));
  if (!data) notFound();
  return (
    <main className="fk-domain">
      <header className="fk-domain-head">
        {data.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={data.logoUrl} alt={data.name} className="fk-domain-logo" />
        ) : data.markUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={data.markUrl} alt={data.name} className="fk-domain-mark" data-image="true" />
        ) : (
          <span className="fk-domain-mark" style={{ background: data.color ?? "var(--neutral-900)" }} aria-hidden>
            {data.name.charAt(0).toUpperCase()}
          </span>
        )}
        <h1>{data.name}</h1>
      </header>
      {data.forms.length === 0 ? (
        <p className="fk-domain-empty">There are no forms open here right now.</p>
      ) : (
        <ul className="fk-domain-list">
          {data.forms.map((f) => (
            <li key={f.slug}>
              <Link href={`/${f.slug}`}>
                <span className="fk-domain-title">{f.title}</span>
                {f.description && <span className="fk-domain-desc">{f.description}</span>}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
