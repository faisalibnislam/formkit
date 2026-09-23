"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { NightSky } from "@/components/brand/NightSky";
import { Logo } from "@/components/brand/Logo";
import { Button } from "@/components/ui";

/**
 * Where an invite link lands. Signed in, one press joins the form; signed out,
 * the person signs in or makes an account and comes straight back here.
 */
const ROLE = { editor: "an Editor", commenter: "a Commenter", viewer: "a Viewer" } as const;

export function JoinForm({ token }: { token: string }) {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useConvexAuth();
  const invite = useQuery(api.collaborators.joinPreview, { token });
  const join = useMutation(api.collaborators.join);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const back = encodeURIComponent(`/j/${token}`);

  return (
    <div className="fk-join">
      <NightSky />
      <div className="fk-join-card">
        <Logo />
        {invite === undefined ? null : invite === null ? (
          <>
            <h1>That invite link has expired</h1>
            <p>Invite links last seven days. Ask whoever sent it for a new one.</p>
            <Link href="/" className="ui-btn" data-variant="secondary" data-size="md">
              Go to Formkit
            </Link>
          </>
        ) : (
          <>
            <h1>
              {invite.owner} invited you to {invite.title}
            </h1>
            <p>You would join as {ROLE[invite.role]}. It is one form, not their whole account.</p>
            {error && <p className="fk-join-error">{error}</p>}
            {isLoading ? null : isAuthenticated ? (
              <Button
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  setError("");
                  try {
                    const formId = await join({ token });
                    router.push(`/app/forms/${formId}`);
                  } catch (e) {
                    setError(e instanceof Error ? e.message.replace(/^.*Uncaught Error: /, "") : "That did not work.");
                    setBusy(false);
                  }
                }}
              >
                Join the form
              </Button>
            ) : (
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
                <Link href={`/signin?next=${back}`} className="ui-btn" data-variant="primary" data-size="md">
                  Sign in to join
                </Link>
                <Link href={`/signup?next=${back}`} className="ui-btn" data-variant="secondary" data-size="md">
                  Create an account
                </Link>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
