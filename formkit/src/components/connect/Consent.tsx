"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAction, useMutation, useQuery } from "convex/react";
import { ShieldCheck } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import { Button, Checkbox } from "@/components/ui";

/**
 * The consent screen an AI assistant sends someone to when it connects to
 * Formkit (convex/oauth.ts). Says who is asking and for what; anything can be
 * unticked. Nothing is shared until Allow.
 */

type Prepared = Awaited<ReturnType<ReturnType<typeof useAction<typeof api.oauth.prepare>>>>;

export function Consent() {
  const q = useSearchParams();
  const router = useRouter();
  const prepare = useAction(api.oauth.prepare);
  const approve = useMutation(api.oauth.approve);
  const viewer = useQuery(api.users.viewer, {});
  const [ask, setAsk] = useState<Prepared | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const req = {
    clientId: q.get("client_id") ?? "",
    redirectUri: q.get("redirect_uri") ?? "",
    responseType: q.get("response_type") ?? "",
    codeChallenge: q.get("code_challenge") ?? "",
    codeChallengeMethod: q.get("code_challenge_method") ?? "",
    scope: q.get("scope") ?? undefined,
    resource: q.get("resource") ?? undefined,
    state: q.get("state") ?? undefined,
  };
  const key = q.toString();

  useEffect(() => {
    let live = true;
    prepare(req)
      .then((r) => {
        if (!live) return;
        setAsk(r);
        if (r.ok) setPicked(new Set(r.scopes.map((s) => s.scope)));
      })
      .catch(() => live && setAsk({ ok: false, message: "That did not load. Start again from the app." }));
    return () => {
      live = false;
    };
    // The request is the address; it does not change while the page is open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const back = (params: Record<string, string>) => {
    const u = new URL(req.redirectUri);
    for (const [k, val] of Object.entries(params)) u.searchParams.set(k, val);
    if (req.state) u.searchParams.set("state", req.state);
    u.searchParams.set("iss", window.location.origin);
    window.location.assign(u.toString());
  };

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "48px 16px",
        background: "var(--neutral-50, #f4f4f4)",
      }}
    >
      <div
        style={{
          width: "min(460px, 100%)",
          padding: "clamp(24px,4vw,34px)",
          borderRadius: "var(--radius-panel)",
          background: "var(--neutral-0)",
          boxShadow: "var(--shadow-lg)",
        }}
      >
        {!ask ? (
          <p style={{ margin: 0, color: "var(--color-text-secondary)" }}>Checking the app…</p>
        ) : !ask.ok ? (
          <>
            <h1 style={{ margin: "0 0 8px", fontSize: "var(--text-h3-size)" }}>This app could not connect</h1>
            <p style={{ margin: 0, color: "var(--color-text-secondary)", lineHeight: 1.5 }}>{ask.message}</p>
            {ask.message.startsWith("Sign in") && (
              <div style={{ marginTop: 22 }}>
                <Button onClick={() => router.push(`/signin?next=${encodeURIComponent(window.location.pathname + window.location.search)}`)}>
                  Sign in
                </Button>
              </div>
            )}
            {ask.redirect && (
              <div style={{ marginTop: 22 }}>
                <Button variant="secondary" onClick={() => window.location.assign(ask.redirect!)}>
                  Go back to the app
                </Button>
              </div>
            )}
          </>
        ) : (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18 }}>
              {ask.client.logoUri ? (
                // eslint-disable-next-line @next/next/no-img-element -- the app's own logo, from its own address
                <img src={ask.client.logoUri} alt="" width={40} height={40} style={{ borderRadius: 10, objectFit: "cover" }} />
              ) : (
                <span
                  aria-hidden
                  style={{ width: 40, height: 40, borderRadius: 10, display: "grid", placeItems: "center", background: "var(--neutral-100, #eee)" }}
                >
                  <ShieldCheck size={20} strokeWidth={1.8} />
                </span>
              )}
              <div style={{ minWidth: 0 }}>
                <h1 style={{ margin: 0, fontSize: "var(--text-h3-size)", lineHeight: 1.25 }}>{ask.client.name} wants to use your Formkit</h1>
                <div style={{ fontSize: 13, color: "var(--color-text-tertiary)", marginTop: 2 }}>
                  {ask.client.host}
                  {!ask.client.verified && " · registered itself, so check you started this"}
                </div>
              </div>
            </div>
            <p style={{ margin: "0 0 14px", color: "var(--color-text-secondary)", lineHeight: 1.5 }}>
              Signed in as {viewer?.email ?? "you"}. It will be able to:
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {ask.scopes.map((s) => (
                <Checkbox
                  key={s.scope}
                  label={s.label}
                  description={s.detail}
                  checked={picked.has(s.scope)}
                  onChange={(on) =>
                    setPicked((p) => {
                      const next = new Set(p);
                      if (on) next.add(s.scope);
                      else next.delete(s.scope);
                      return next;
                    })
                  }
                />
              ))}
            </div>
            <p style={{ margin: "18px 0 0", fontSize: 13, color: "var(--color-text-tertiary)", lineHeight: 1.5 }}>
              It can never delete anything. New forms and edits stay drafts until something publishes them. You can disconnect it any time in
              Settings → Developers.
            </p>
            {problem && (
              <p className="ui-error" style={{ margin: "14px 0 0" }}>
                {problem}
              </p>
            )}
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 22 }}>
              <Button variant="ghost" disabled={busy} onClick={() => back({ error: "access_denied", error_description: "The person said no." })}>
                Cancel
              </Button>
              <Button
                disabled={busy || picked.size === 0}
                onClick={async () => {
                  setBusy(true);
                  setProblem(null);
                  try {
                    const code = await approve({
                      clientId: req.clientId,
                      redirectUri: req.redirectUri,
                      codeChallenge: req.codeChallenge,
                      scopes: [...picked],
                      resource: req.resource,
                    });
                    back({ code });
                  } catch {
                    setProblem("That did not go through. Start again from the app.");
                    setBusy(false);
                  }
                }}
              >
                Allow
              </Button>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
