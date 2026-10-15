"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuthActions } from "@convex-dev/auth/react";
import { NightSky } from "@/components/brand/NightSky";

/**
 * Back from the company's identity provider: trades WorkOS's code for a
 * session (the "saml" provider in convex/auth.ts), then on into Formkit.
 */
export function SamlCallback({ code, state, error }: { code: string; state: string; error: string }) {
  const { signIn } = useAuthActions();
  const router = useRouter();
  const [problem, setProblem] = useState<string | null>(error || (!code || !state ? "That sign-in link is incomplete." : null));
  const asked = useRef(false);

  useEffect(() => {
    if (asked.current || problem) return;
    asked.current = true;
    signIn("saml", { code, state })
      .then(() => router.replace("/app"))
      .catch((e: unknown) => {
        const data = (e as { data?: { message?: string } } | null)?.data;
        setProblem(data?.message ?? "Your company's sign-in didn't go through. Try again.");
      });
  }, [code, state, problem, signIn, router]);

  return (
    <div className="fk-page" style={{ position: "relative", background: "#0a3d6f", minHeight: "100vh" }}>
      <NightSky />
      <main
        style={{
          position: "relative",
          zIndex: 1,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "48px 20px",
          margin: 0,
          borderRadius: 0,
          boxShadow: "none",
        }}
      >
        <div
          role="status"
          aria-live="polite"
          style={{
            width: "min(436px, 100%)",
            padding: "clamp(26px,4vw,36px)",
            borderRadius: "var(--radius-panel)",
            background: "var(--neutral-0)",
            boxShadow: "var(--shadow-lg)",
            textAlign: "center",
          }}
        >
          <h1 style={{ fontSize: 22, margin: "0 0 8px" }}>{problem ? "Single sign-on didn't work" : "Signing you in…"}</h1>
          <p style={{ margin: 0 }}>{problem ?? "One moment while your company's sign-in finishes."}</p>
          {problem && (
            <p style={{ margin: "16px 0 0" }}>
              <Link href="/signin" className="fk-pill">
                Back to sign in
              </Link>
            </p>
          )}
        </div>
      </main>
    </div>
  );
}
