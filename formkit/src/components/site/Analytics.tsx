"use client";

import Link from "next/link";
import Script from "next/script";
import { useEffect, useState, useSyncExternalStore } from "react";
import {
  CONSENT_OPEN_EVENT,
  GA_ID,
  clearAnalyticsCookies,
  readConsent,
  subscribeConsent,
  writeConsent,
  type Consent,
} from "@/lib/consent";

/**
 * Google Analytics for the marketing pages, behind a consent banner.
 *
 * gtag.js is not requested at all until the visitor accepts, so a visitor who
 * declines, or never answers, sends Google nothing and gets no cookie. Ad
 * features stay denied either way: Formkit runs no advertising.
 *
 * Mounted only by the (site) layout - the app, admin, sign-in and customers'
 * published forms never load it. Renders nothing when NEXT_PUBLIC_GA_ID is
 * not set.
 */
export function Analytics() {
  if (!GA_ID) return null;
  return <ConsentedAnalytics id={GA_ID} />;
}

function ConsentedAnalytics({ id }: { id: string }) {
  // null on the server and during hydration: the static HTML never carries
  // the banner, so a returning visitor who already answered never sees it flash.
  const consent = useSyncExternalStore<Consent | null>(subscribeConsent, readConsent, () => null);
  const [reopened, setReopened] = useState(false);

  useEffect(() => {
    const open = () => setReopened(true);
    window.addEventListener(CONSENT_OPEN_EVENT, open);
    return () => window.removeEventListener(CONSENT_OPEN_EVENT, open);
  }, []);

  const choose = (value: "granted" | "denied") => {
    // gtag.js cannot be unloaded: withdrawing consent reloads the page without it.
    const withdrawing = value === "denied" && consent === "granted";
    writeConsent(value);
    setReopened(false);
    if (value === "denied") clearAnalyticsCookies();
    if (withdrawing) window.location.reload();
  };

  const showBanner = consent === "unset" || (consent !== null && reopened);

  return (
    <>
      {consent === "granted" && (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`}
            strategy="afterInteractive"
          />
          <Script id="fk-gtag" strategy="afterInteractive">
            {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}
gtag('consent','default',{analytics_storage:'granted',ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied'});
gtag('js',new Date());gtag('config',${JSON.stringify(id)});`}
          </Script>
        </>
      )}

      {showBanner && (
        <section className="fk-consent" role="region" aria-label="Cookie choice">
          <p>
            Can we use Google Analytics to count visits to these pages? It sets a few cookies. Nothing is
            loaded unless you say yes, and the app and your forms are never tracked.{" "}
            <Link href="/privacy#cookies">Privacy</Link>
          </p>
          <div className="fk-consent-actions">
            <button type="button" className="ui-btn" data-variant="secondary" data-size="sm" onClick={() => choose("denied")}>
              Decline
            </button>
            <button type="button" className="ui-btn" data-variant="primary" data-size="sm" onClick={() => choose("granted")}>
              Accept
            </button>
          </div>
        </section>
      )}
    </>
  );
}
