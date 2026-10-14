"use client";

import { useEffect } from "react";
import { reportError } from "@/lib/reportError";

/**
 * The last resort, when the root layout itself fails. It replaces the whole
 * document, so it brings its own <html>, <body> and styles: none of the
 * site's CSS has loaded.
 */
export default function GlobalError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    reportError(error);
  }, [error]);

  return (
    <html lang="en-US">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          padding: "48px 20px",
          background: "#f7fbff",
          color: "#21282E",
          font: "16px/1.55 system-ui, -apple-system, Segoe UI, sans-serif",
          textAlign: "center",
        }}
      >
        <title>Something went wrong | Formkit</title>
        <main role="alert" style={{ maxWidth: 420 }}>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 600 }}>Formkit could not load</h1>
          <p style={{ margin: "10px 0 22px", color: "#5f666c" }}>
            Try again in a moment{error.digest ? ` (reference ${error.digest})` : ""}.
          </p>
          <button
            type="button"
            onClick={() => retry()}
            style={{
              height: 44,
              padding: "0 20px",
              border: "none",
              borderRadius: 999,
              background: "#21282E",
              color: "#fff",
              font: "inherit",
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
