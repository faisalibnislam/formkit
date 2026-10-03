"use client";

import { useViewer } from "@/lib/seed";
import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { KeyRound, LogOut, RotateCcw, ShieldCheck } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import { NightSky } from "@/components/brand/NightSky";
import { Logo } from "@/components/brand/Logo";
import { Button, Field, Input } from "@/components/ui";
import { clearViewerHint } from "@/lib/viewerHint";

/**
 * The two screens that stand between a signed-in session and the app: the
 * two-factor code a new session owes, and the restore offer for an account
 * deleted inside the last 30 days. Both sit on the Night Sky, like sign-in.
 */

function Frame({ children }: { children: ReactNode }) {
  return (
    <div className="fk-gate">
      <NightSky />
      <div className="fk-gate-inner">
        <Logo tone="inverse" />
        <div className="fk-gate-card">{children}</div>
      </div>
    </div>
  );
}

function Head({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <>
      <span className="fk-gate-mark" aria-hidden>
        {icon}
      </span>
      <h1 className="fk-gate-title">{title}</h1>
      <p className="fk-gate-lede">{children}</p>
    </>
  );
}

function TwoFactorGate({ email, onSignOut }: { email: string; onSignOut: () => void }) {
  const verify = useMutation(api.security.verifySession);
  const [code, setCode] = useState("");
  const [recovery, setRecovery] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!code.trim()) return;
    setBusy(true);
    setError("");
    try {
      const result = await verify({ code: code.trim() });
      if (!result.ok) setError(result.message ?? "That code did not match.");
    } catch {
      setError("Formkit could not check the code. Try again in a moment.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Frame>
      <Head icon={<ShieldCheck size={20} strokeWidth={1.8} />} title="One more step">
        {recovery
          ? "Type one of the recovery codes you saved when you turned on two-factor. Each works once."
          : `Open your authenticator app and type the six-digit code for Formkit${email ? ` (${email})` : ""}.`}
      </Head>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
        style={{ display: "flex", flexDirection: "column", gap: 16 }}
      >
        <Field label={recovery ? "Recovery code" : "Six-digit code"} error={error || undefined}>
          <Input
            autoFocus
            value={code}
            onChange={(e) => setCode(recovery ? e.target.value : e.target.value.replace(/\D/g, "").slice(0, 6))}
            inputMode={recovery ? "text" : "numeric"}
            autoComplete="one-time-code"
            placeholder={recovery ? "abcd-efgh" : "123456"}
            invalid={!!error}
            icon={<KeyRound size={17} strokeWidth={1.8} aria-hidden />}
          />
        </Field>
        <Button type="submit" fullWidth disabled={busy || (!recovery && code.length < 6)}>
          {busy ? "Checking…" : "Continue"}
        </Button>
      </form>
      <div className="fk-gate-foot">
        <button
          type="button"
          className="fk-gate-link"
          onClick={() => {
            setRecovery((r) => !r);
            setCode("");
            setError("");
          }}
        >
          {recovery ? "Use the app instead" : "Use a recovery code"}
        </button>
        <button type="button" className="fk-gate-link" onClick={onSignOut}>
          <LogOut size={14} strokeWidth={1.8} aria-hidden />
          Sign out
        </button>
      </div>
    </Frame>
  );
}

function DeactivatedGate({ restoreUntil, onSignOut }: { restoreUntil: number | null; onSignOut: () => void }) {
  const reactivate = useMutation(api.security.reactivate);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [now] = useState(() => Date.now());
  const days = restoreUntil ? Math.max(0, Math.ceil((restoreUntil - now) / (24 * 60 * 60 * 1000))) : 0;

  return (
    <Frame>
      <Head icon={<RotateCcw size={20} strokeWidth={1.8} />} title="Your account is deactivated">
        Everything is still here: forms, responses and templates.
      </Head>
      <div className="fk-gate-note">
        <strong>
          {days} {days === 1 ? "day" : "days"} left to restore it.
        </strong>{" "}
        Reactivate and your forms come back the way you left them, collecting again. After that the account
        is erased for good.
      </div>
      {error && <p className="ui-error" style={{ margin: "0 0 12px" }}>{error}</p>}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <Button
          fullWidth
          disabled={busy || days === 0}
          iconLeft={<RotateCcw size={16} strokeWidth={1.8} aria-hidden />}
          onClick={async () => {
            setBusy(true);
            try {
              await reactivate({});
            } catch (e) {
              setError(e instanceof Error ? e.message.replace(/^.*?Error:\s*/, "") : "That did not work.");
              setBusy(false);
            }
          }}
        >
          Reactivate my account
        </Button>
        <Button variant="secondary" fullWidth onClick={onSignOut}>
          Not now
        </Button>
      </div>
    </Frame>
  );
}

/** Suspended by Formkit staff: nothing to restore from here. */
function SuspendedGate({ onSignOut }: { onSignOut: () => void }) {
  return (
    <Frame>
      <Head icon={<ShieldCheck size={20} strokeWidth={1.8} />} title="This account is suspended">
        Formkit has paused this account. If you think this is a mistake, write to support@formkit.app from
        the address you sign in with.
      </Head>
      <Button variant="secondary" fullWidth onClick={onSignOut}>
        Sign out
      </Button>
    </Frame>
  );
}

/**
 * Put in front of anything a signed-in person uses - the app, the admin
 * console, onboarding, join links. A session that owes its two-factor code,
 * or an account inside its restore window, sees that screen instead; a guest
 * passes through to whatever the page does for guests.
 */
export function SessionGate({ children }: { children: ReactNode }) {
  const viewer = useViewer();
  const { signOut } = useAuthActions();
  const router = useRouter();
  const leave = () => {
    clearViewerHint();
    void signOut().then(() => router.push("/signin"));
  };
  if (viewer?.suspended) return <SuspendedGate onSignOut={leave} />;
  if (viewer?.deactivated) return <DeactivatedGate restoreUntil={viewer.restoreUntil} onSignOut={leave} />;
  if (viewer?.twoFactorNeeded) return <TwoFactorGate email={viewer.email} onSignOut={leave} />;
  return <>{children}</>;
}
