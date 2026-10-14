"use client";

import Link from "next/link";
import { useEffect } from "react";
import { reportError } from "@/lib/reportError";

/**
 * What a page shows when something under it throws, in place of a blank
 * screen. The layout above it (nav, app shell) stays; only the page area is
 * replaced, and "Try again" re-renders it.
 */
export default function PageError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    reportError(error);
  }, [error]);

  return (
    <main
      id="fk-main"
      role="alert"
      style={{
        minHeight: "60vh",
        display: "grid",
        placeItems: "center",
        padding: "48px 20px",
        textAlign: "center",
      }}
    >
      <div style={{ maxWidth: 420 }}>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 600, letterSpacing: "-.02em" }}>Something went wrong here</h1>
        <p style={{ margin: "10px 0 22px", color: "var(--color-text-secondary)", lineHeight: 1.55 }}>
          Your work is saved. Try again, and if it keeps happening, let us know at hello@formkit.app
          {error.digest ? ` and mention ${error.digest}` : ""}.
        </p>
        <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
          <button type="button" className="ui-btn" data-variant="primary" onClick={() => retry()}>
            Try again
          </button>
          <Link className="ui-btn" data-variant="secondary" href="/">
            Go home
          </Link>
        </div>
      </div>
    </main>
  );
}
