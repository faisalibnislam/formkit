"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState } from "react";
import { ArrowRight, Lock, Mail, RotateCcw, User } from "lucide-react";
import { useAuthActions } from "@convex-dev/auth/react";
import { NightSky } from "@/components/brand/NightSky";
import { SiteNav } from "@/components/site/SiteNav";
import { Button, Checkbox, Field, Input, ProgressBar } from "@/components/ui";

/**
 * Sign in, sign up, email verification, password reset and reactivation.
 *
 * Every state is one card on the Night Sky. Errors name the fix rather than
 * saying "Invalid input".
 */
type View = "signin" | "signup" | "verify" | "forgot" | "reset" | "reactivate";

const STRENGTH_LABEL = ["Too short", "Weak", "Getting there", "Good", "Strong"];

function strength(password: string) {
  if (password.length < 10) return 0;
  let n = 1;
  if (/[A-Z]/.test(password)) n++;
  if (/[0-9]/.test(password)) n++;
  if (/[^A-Za-z0-9]/.test(password)) n++;
  return Math.min(4, n);
}

/** Convex Auth errors arrive as opaque strings; translate the ones we cause. */
function readableError(err: unknown, fallback: string) {
  const raw = err instanceof Error ? err.message : String(err);
  if (/InvalidSecret|InvalidAccountId/i.test(raw)) {
    return "That email and password do not match an account. Check the address, or reset the password.";
  }
  if (/already.*exist|Account.*exists/i.test(raw)) {
    return "There is already an account on that address — sign in instead, or reset the password.";
  }
  if (/Passwords need at least/i.test(raw)) return raw.replace(/^.*Error:\s*/, "");
  if (/Could not verify code|InvalidVerificationCode/i.test(raw)) {
    return "That code did not match. Check the six digits, or send a new one.";
  }
  // The code was real but belonged to another address — a different message,
  // because retyping the digits will not help.
  if (/sent to a different address|matching `email`/i.test(raw)) {
    return "That code was sent to a different address. Check the email above, or send a new code.";
  }
  if (/expired/i.test(raw)) {
    return "That code has expired. Send a new one — they last fifteen minutes.";
  }
  if (/could not send the code/i.test(raw)) {
    return "Formkit could not send the code. Try again in a moment.";
  }
  return fallback;
}

export function AuthCard({ initialView }: { initialView: View }) {
  const { signIn } = useAuthActions();
  const router = useRouter();
  const params = useSearchParams();

  const [view, setView] = useState<View>(initialView);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [code, setCode] = useState("");
  const [show, setShow] = useState(false);
  const [remember, setRemember] = useState(true);
  const [terms, setTerms] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  /** Where to land after a successful sign-in. */
  const landing = useCallback(() => {
    const template = params.get("template");
    const question = params.get("q");
    if (template) return `/app?template=${encodeURIComponent(template)}`;
    if (question) return `/app?q=${encodeURIComponent(question)}`;
    return "/app";
  }, [params]);

  const run = useCallback(
    async (fn: () => Promise<unknown>, fallback: string) => {
      setBusy(true);
      setError("");
      try {
        await fn();
        return true;
      } catch (err) {
        setError(readableError(err, fallback));
        return false;
      } finally {
        setBusy(false);
      }
    },
    [],
  );

  // The server stores the address lowercased and trimmed, and the verification
  // step compares against that. Send the same spelling every time, or a code
  // that is perfectly correct gets rejected.
  const address = email.trim().toLowerCase();

  const onSignIn = () =>
    run(async () => {
      await signIn("password", { email: address, password, flow: "signIn" });
      router.push(landing());
    }, "Formkit could not sign you in. Try again in a moment.");

  const onSignUp = async () => {
    if (!terms) {
      setError("Tick the box to accept the terms and the privacy policy.");
      return;
    }
    const ok = await run(async () => {
      await signIn("password", { email: address, password, name, flow: "signUp" });
    }, "Formkit could not create the account. Try again in a moment.");
    if (ok) setView("verify");
  };

  const onVerify = () =>
    run(async () => {
      await signIn("password", { email: address, code, flow: "email-verification" });
      router.push("/onboarding");
    }, "Formkit could not check that code. Try again in a moment.");

  const onSendReset = async () => {
    const ok = await run(async () => {
      await signIn("password", { email: address, flow: "reset" });
    }, "Formkit could not send the reset code. Try again in a moment.");
    if (ok) setView("reset");
  };

  const onDoReset = async () => {
    if (password !== confirm) {
      setError("The two passwords do not match. Retype the second one.");
      return;
    }
    const ok = await run(async () => {
      await signIn("password", {
        email: address,
        code,
        newPassword: password,
        flow: "reset-verification",
      });
    }, "Formkit could not reset the password. Try again in a moment.");
    if (ok) router.push(landing());
  };

  return (
    <div
      className="fk-page"
      style={{ position: "relative", background: "#0a3d6f", minHeight: "100vh" }}
    >
      <NightSky />
      <SiteNav />

      <div
        style={{
          position: "relative",
          zIndex: 1,
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 20,
          padding: "calc(104px + 32px) 20px 48px",
        }}
      >
        <div
          style={{
            width: "min(436px, 100%)",
            padding: "clamp(26px,4vw,36px)",
            borderRadius: "var(--radius-panel)",
            background: "var(--neutral-0)",
            boxShadow: "var(--shadow-lg)",
          }}
        >
          {view === "signin" && (
            <>
              <Head title="Welcome back">
                Sign in to your forms and everything people have sent you.
              </Head>
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <Field label="Email">
                  <Input
                    icon={<Mail size={17} strokeWidth={1.8} aria-hidden />}
                    type="email"
                    autoComplete="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </Field>
                <PasswordField
                  label="Password"
                  value={password}
                  show={show}
                  onToggle={() => setShow((s) => !s)}
                  onChange={setPassword}
                  autoComplete="current-password"
                  placeholder="••••••••"
                />
                {error && <span className="ui-error">{error}</span>}
                <div
                  style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}
                >
                  <Checkbox
                    label="Keep me signed in"
                    checked={remember}
                    onChange={setRemember}
                  />
                  <span style={{ flex: 1, minWidth: 8 }} />
                  <LinkButton onClick={() => setView("forgot")}>Forgot password?</LinkButton>
                </div>
                <Button
                  fullWidth
                  disabled={busy}
                  onClick={onSignIn}
                  iconRight={<ArrowRight size={17} strokeWidth={1.8} aria-hidden />}
                >
                  {busy ? "Signing in…" : "Sign in"}
                </Button>
                <Aside>
                  New here? <LinkButton onClick={() => setView("signup")}>Create an account</LinkButton>
                </Aside>
              </div>
            </>
          )}

          {view === "signup" && (
            <>
              <Head title="Create your account">
                Free, and it stays free. No card, no plan to pick.
              </Head>
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <Field label="Your name">
                  <Input
                    icon={<User size={17} strokeWidth={1.8} aria-hidden />}
                    autoComplete="name"
                    placeholder="Maya Ortiz"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </Field>
                <Field label="Email">
                  <Input
                    icon={<Mail size={17} strokeWidth={1.8} aria-hidden />}
                    type="email"
                    autoComplete="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </Field>
                <div>
                  <PasswordField
                    label="Password"
                    value={password}
                    show={show}
                    onToggle={() => setShow((s) => !s)}
                    onChange={setPassword}
                    autoComplete="new-password"
                    placeholder="At least 10 characters"
                  />
                  {password.length > 0 && (
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        marginTop: 10,
                      }}
                    >
                      <div style={{ flex: 1 }}>
                        <ProgressBar value={strength(password) * 25} />
                      </div>
                      <span
                        style={{
                          fontSize: 12.5,
                          whiteSpace: "nowrap",
                          color: "var(--color-text-tertiary)",
                        }}
                      >
                        {STRENGTH_LABEL[strength(password)]}
                      </span>
                    </div>
                  )}
                </div>
                {error && <span className="ui-error">{error}</span>}
                <Checkbox
                  label="I agree to the terms of service and privacy policy"
                  description="Accounts you delete are kept for 30 days so you can change your mind."
                  checked={terms}
                  onChange={setTerms}
                />
                <Button
                  fullWidth
                  disabled={busy}
                  onClick={onSignUp}
                  iconRight={<ArrowRight size={17} strokeWidth={1.8} aria-hidden />}
                >
                  {busy ? "Creating…" : "Create account"}
                </Button>
                <Aside>
                  Already have one? <LinkButton onClick={() => setView("signin")}>Sign in</LinkButton>
                </Aside>
              </div>
            </>
          )}

          {view === "verify" && (
            <>
              <Head title="Check your email">
                We sent a six-digit code to {email || "your address"}.
              </Head>
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <Field label="Code">
                  <Input
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    placeholder="000000"
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    style={{ letterSpacing: ".3em" }}
                  />
                </Field>
                {error && <span className="ui-error">{error}</span>}
                <Button
                  fullWidth
                  disabled={busy || code.length < 6}
                  onClick={onVerify}
                  iconRight={<ArrowRight size={17} strokeWidth={1.8} aria-hidden />}
                >
                  {busy ? "Checking…" : "Verify and continue"}
                </Button>
                <Aside>
                  Nothing arrived?{" "}
                  <LinkButton
                    onClick={() =>
                      run(
                        () => signIn("password", { email: address, password, name, flow: "signUp" }),
                        "Formkit could not send another code just now.",
                      )
                    }
                  >
                    Send it again
                  </LinkButton>
                </Aside>
              </div>
            </>
          )}

          {view === "forgot" && (
            <>
              <Head title="Reset your password">
                Give us the address you signed up with and we will send a code.
              </Head>
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <Field label="Email">
                  <Input
                    icon={<Mail size={17} strokeWidth={1.8} aria-hidden />}
                    type="email"
                    autoComplete="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </Field>
                {error && <span className="ui-error">{error}</span>}
                <Button
                  fullWidth
                  disabled={busy}
                  onClick={onSendReset}
                  iconRight={<ArrowRight size={17} strokeWidth={1.8} aria-hidden />}
                >
                  {busy ? "Sending…" : "Send the code"}
                </Button>
                <div style={{ textAlign: "center" }}>
                  <LinkButton onClick={() => setView("signin")}>Back to sign in</LinkButton>
                </div>
              </div>
            </>
          )}

          {view === "reset" && (
            <>
              <Head title="Pick a new password">
                Ten characters or more. Anything you can remember beats anything you cannot.
              </Head>
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <Field label="Code" help={`Sent to ${email || "your address"}.`}>
                  <Input
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    placeholder="000000"
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    style={{ letterSpacing: ".3em" }}
                  />
                </Field>
                <PasswordField
                  label="New password"
                  value={password}
                  show={show}
                  onToggle={() => setShow((s) => !s)}
                  onChange={setPassword}
                  autoComplete="new-password"
                />
                <PasswordField
                  label="Confirm it"
                  value={confirm}
                  show={show}
                  onToggle={() => setShow((s) => !s)}
                  onChange={setConfirm}
                  autoComplete="new-password"
                />
                {error && <span className="ui-error">{error}</span>}
                <Button
                  fullWidth
                  disabled={busy}
                  onClick={onDoReset}
                  iconRight={<ArrowRight size={17} strokeWidth={1.8} aria-hidden />}
                >
                  {busy ? "Saving…" : "Save and sign in"}
                </Button>
              </div>
            </>
          )}

          {view === "reactivate" && (
            <>
              <Head title="Your account is deactivated">
                Everything is still here — forms, responses and templates.
              </Head>
              <div
                style={{
                  marginBottom: 20,
                  padding: "14px 16px",
                  borderRadius: "var(--radius-card-inner)",
                  background: "var(--yellow-100)",
                  fontSize: 14,
                  lineHeight: 1.55,
                }}
              >
                Deleted accounts are kept for 30 days. Reactivate within that window and nothing
                is lost.
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <Button
                  fullWidth
                  onClick={() => router.push("/app")}
                  iconLeft={<RotateCcw size={16} strokeWidth={1.8} aria-hidden />}
                >
                  Reactivate my account
                </Button>
                <Button variant="secondary" fullWidth onClick={() => setView("signin")}>
                  Not now
                </Button>
              </div>
            </>
          )}
        </div>

        <p
          style={{
            maxWidth: 436,
            margin: 0,
            textAlign: "center",
            fontSize: 12.5,
            lineHeight: 1.6,
            color: "#ffffff",
          }}
        >
          By continuing you agree to the Formkit{" "}
          <Link
            href="/terms"
            target="_blank"
            rel="noopener"
            style={{ color: "#ffffff", textDecoration: "underline" }}
          >
            terms of service
          </Link>{" "}
          and{" "}
          <Link
            href="/privacy"
            target="_blank"
            rel="noopener"
            style={{ color: "#ffffff", textDecoration: "underline" }}
          >
            privacy policy
          </Link>
          . Deleted accounts are kept for 30 days so you can reactivate them.
        </p>
      </div>
    </div>
  );
}

function Head({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <>
      <h1
        style={{
          margin: 0,
          fontSize: "var(--text-h3-size)",
          fontWeight: "var(--text-h3-weight)" as never,
          letterSpacing: "var(--text-h3-tracking)",
        }}
      >
        {title}
      </h1>
      <p
        style={{
          margin: "8px 0 22px",
          fontSize: 15,
          lineHeight: 1.55,
          color: "var(--color-text-tertiary)",
        }}
      >
        {children}
      </p>
    </>
  );
}

function Aside({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 14, textAlign: "center", color: "var(--color-text-tertiary)" }}>
      {children}
    </div>
  );
}

function LinkButton({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        border: "none",
        background: "none",
        padding: 0,
        font: "inherit",
        fontSize: 14,
        color: "var(--blue-700)",
        cursor: "pointer",
      }}
    >
      {children}
    </button>
  );
}

function PasswordField({
  label,
  value,
  show,
  onToggle,
  onChange,
  autoComplete,
  placeholder,
}: {
  label: string;
  value: string;
  show: boolean;
  onToggle: () => void;
  onChange: (next: string) => void;
  autoComplete?: string;
  placeholder?: string;
}) {
  return (
    <Field
      label={label}
      action={<LinkButton onClick={onToggle}>{show ? "Hide" : "Show"}</LinkButton>}
    >
      <Input
        icon={<Lock size={17} strokeWidth={1.8} aria-hidden />}
        type={show ? "text" : "password"}
        autoComplete={autoComplete}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </Field>
  );
}
