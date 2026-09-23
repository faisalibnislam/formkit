"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAction, useMutation, useQuery } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import QRCode from "qrcode";
import {
  Copy,
  Download,
  FileText,
  KeyRound,
  Lock,
  LogOut,
  Mail,
  Monitor,
  RotateCcw,
  Shield,
  Smartphone,
  Trash2,
} from "lucide-react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { Badge, Button, Field, Input, Modal, Select, Switch } from "@/components/ui";
import { useToast } from "@/components/ui/Toast";
import { Avatar } from "../ds";
import { ImageUpload } from "../ImageUpload";
import { relativeTime } from "../bits";
import { localZone, zoneOptions } from "../time";
import { Panel, Row, SCORE_LABEL, errorText, passwordScore } from "./bits";

type Viewer = NonNullable<ReturnType<typeof useViewer>>;
function useViewer() {
  return useQuery(api.users.viewer, {});
}

export function AccountSection() {
  const viewer = useViewer();
  if (!viewer) return null;
  return (
    <>
      <Profile viewer={viewer} />
      <Password email={viewer.email} />
      <Security viewer={viewer} />
      <Panel title="Policy and terms">
        <p className="fk-setpanel-text">
          Deleting your account deactivates it straight away and closes every form you are collecting on.
          We keep your forms, responses and templates for 30 days.
        </p>
        <p className="fk-setpanel-text">
          Change your mind inside that window and you only need to sign in: a screen offers you Reactivate my
          account, and one click brings everything back the way you left it. Once the 30 days pass the data
          is erased and cannot be recovered.
        </p>
        <div className="fk-setpanel-actions">
          <Link href="/terms" target="_blank" rel="noopener">
            <Button variant="secondary" iconLeft={<FileText size={16} strokeWidth={1.8} aria-hidden />}>
              Terms of service
            </Button>
          </Link>
          <Link href="/privacy" target="_blank" rel="noopener">
            <Button variant="secondary" iconLeft={<Shield size={16} strokeWidth={1.8} aria-hidden />}>
              Privacy policy
            </Button>
          </Link>
        </div>
      </Panel>
    </>
  );
}

/* ------------------------------------------------------------------ */

function Profile({ viewer }: { viewer: Viewer }) {
  const toast = useToast();
  const updateProfile = useMutation(api.users.updateProfile);
  const setAvatar = useMutation(api.users.setAvatar);
  const [zones] = useState(() => zoneOptions());

  const save = async (patch: { name?: string; role?: string; timezone?: string }, what: string) => {
    await updateProfile(patch);
    toast(`${what} saved`);
  };

  return (
    <Panel title="Profile">
      <div className="fk-profile">
        <ImageUpload
          label="Your photo"
          help="PNG, JPEG, WebP or SVG, up to 5 MB. It appears wherever your name does."
          hasImage={!!viewer.image}
          preview={<Avatar name={viewer.name} image={viewer.image} size="xl" />}
          onUploaded={async (storageId) => {
            await setAvatar({ storageId });
            toast("Photo updated");
          }}
          onCleared={async () => {
            await setAvatar({ storageId: null });
            toast("Photo removed", { detail: "Your initials are showing again" });
          }}
        />
        <div className="fk-profile-fields">
          <Field label="Full name">
            <Input
              defaultValue={viewer.name}
              onBlur={(e) => {
                const v = e.target.value.trim();
                if (v && v !== viewer.name) void save({ name: v }, "Name");
              }}
            />
          </Field>
          <EmailField email={viewer.email} />
          <Field label="Role" help="What you do. It shows beside your name when you share a form.">
            <Input
              defaultValue={viewer.role ?? ""}
              placeholder="Independent designer"
              onBlur={(e) => {
                if (e.target.value.trim() !== (viewer.role ?? "")) void save({ role: e.target.value.trim() }, "Role");
              }}
            />
          </Field>
          <Field label="Time zone" help="Dates, closing times and the 8am summaries follow it.">
            <Select
              searchable
              ariaLabel="Time zone"
              value={viewer.timezone ?? localZone()}
              onChange={(zone) => void save({ timezone: zone }, "Time zone")}
              options={zones}
            />
          </Field>
        </div>
      </div>
    </Panel>
  );
}

/** Changing the sign-in address takes a code sent to the new one. */
function EmailField({ email }: { email: string }) {
  const toast = useToast();
  const status = useQuery(api.security.status, {});
  const request = useMutation(api.security.requestEmailChange);
  const confirm = useMutation(api.security.confirmEmailChange);
  const cancel = useMutation(api.security.cancelEmailChange);
  const [editing, setEditing] = useState(false);
  const [next, setNext] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const pending = status?.emailChange ?? null;

  if (pending) {
    return (
      <Field
        label="Email"
        help={`We sent a six-digit code to ${pending.email}. It lasts 15 minutes.`}
        error={error || undefined}
      >
        <div className="fk-inline">
          <Input
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            placeholder="123456"
            inputMode="numeric"
            autoComplete="one-time-code"
            aria-label="Code from the email"
            invalid={!!error}
            wrapStyle={{ flex: 1, minWidth: 140 }}
          />
          <Button
            disabled={code.length < 6 || busy}
            onClick={async () => {
              setBusy(true);
              setError("");
              const r = await confirm({ code });
              setBusy(false);
              if (!r.ok) setError(r.message ?? "That code did not match.");
              else {
                setCode("");
                toast("Email changed", { detail: `Sign in with ${pending.email} from now on` });
              }
            }}
          >
            Confirm
          </Button>
          <Button variant="ghost" onClick={() => void cancel({})}>
            Cancel
          </Button>
        </div>
      </Field>
    );
  }

  if (editing) {
    return (
      <Field label="New email" help="You sign in with it. We send a code there to be sure it is yours." error={error || undefined}>
        <div className="fk-inline">
          <Input
            autoFocus
            type="email"
            value={next}
            onChange={(e) => setNext(e.target.value)}
            placeholder="you@example.com"
            icon={<Mail size={17} strokeWidth={1.8} aria-hidden />}
            invalid={!!error}
            wrapStyle={{ flex: 1, minWidth: 200 }}
          />
          <Button
            disabled={!next.includes("@") || busy}
            onClick={async () => {
              setBusy(true);
              setError("");
              try {
                await request({ email: next });
                setEditing(false);
                setNext("");
              } catch (e) {
                setError(errorText(e, "That address could not be used."));
              } finally {
                setBusy(false);
              }
            }}
          >
            Send code
          </Button>
          <Button variant="ghost" onClick={() => setEditing(false)}>
            Cancel
          </Button>
        </div>
      </Field>
    );
  }

  return (
    <Field label="Email" action={<button type="button" className="fk-textbtn" onClick={() => setEditing(true)}>Change</button>}>
      <Input readOnly value={email} icon={<Mail size={17} strokeWidth={1.8} aria-hidden />} />
    </Field>
  );
}

/* ------------------------------------------------------------------ */

function Password({ email }: { email: string }) {
  const toast = useToast();
  const change = useAction(api.security.changePassword);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [again, setAgain] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const score = passwordScore(next);

  async function submit() {
    setError("");
    if (!current) return setError("Enter your current password first — we need it before changing anything.");
    if (next.length < 10) return setError("Use at least 10 characters.");
    if (next !== again) return setError("The new passwords do not match. Check the confirmation.");
    setBusy(true);
    try {
      const r = await change({ current, next });
      setCurrent("");
      setNext("");
      setAgain("");
      toast("Password updated", {
        detail: r.signedOut
          ? `You stay signed in here; ${r.signedOut} other ${r.signedOut === 1 ? "device was" : "devices were"} signed out`
          : "You stay signed in on this device",
      });
    } catch (e) {
      setError(errorText(e, "Formkit could not change the password. Try again in a moment."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Panel title="Password">
      <form
        className="fk-setpanel-form"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        {/* Lets a password manager know whose password this is. */}
        <input type="text" name="username" autoComplete="username" value={email} readOnly hidden />
        <Field label="Current password">
          <Input
            type="password"
            autoComplete="current-password"
            icon={<Lock size={17} strokeWidth={1.8} aria-hidden />}
            placeholder="••••••••"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
          />
        </Field>
        <Field label="New password">
          <Input
            type="password"
            autoComplete="new-password"
            icon={<Lock size={17} strokeWidth={1.8} aria-hidden />}
            placeholder="At least 10 characters"
            value={next}
            onChange={(e) => setNext(e.target.value)}
          />
        </Field>
        {next && (
          <div className="fk-pwmeter" aria-live="polite">
            <span className="fk-pwmeter-bars" data-score={score} aria-hidden>
              <span />
              <span />
              <span />
              <span />
            </span>
            <span>{SCORE_LABEL[score]}</span>
          </div>
        )}
        <Field label="Confirm new password" error={error || undefined}>
          <Input
            type="password"
            autoComplete="new-password"
            icon={<Lock size={17} strokeWidth={1.8} aria-hidden />}
            value={again}
            onChange={(e) => setAgain(e.target.value)}
            invalid={!!error}
          />
        </Field>
        <div>
          <Button type="submit" disabled={busy}>
            {busy ? "Updating…" : "Update password"}
          </Button>
        </div>
      </form>
    </Panel>
  );
}

/* ------------------------------------------------------------------ */

function Security({ viewer }: { viewer: Viewer }) {
  const toast = useToast();
  const router = useRouter();
  const status = useQuery(api.security.status, {});
  const setAlerts = useMutation(api.security.setSignInAlerts);
  const signOutOthers = useMutation(api.security.signOutOthers);
  const signOutSession = useMutation(api.security.signOutSession);
  const [dialog, setDialog] = useState<null | "enable" | "disable" | "recovery" | "delete">(null);

  const tf = status?.twoFactor;

  return (
    <Panel title="Security">
      <Row
        label="Two-factor authentication"
        hint={
          tf?.on
            ? `On — a code from your authenticator app at sign-in. ${tf.recoveryLeft} recovery ${tf.recoveryLeft === 1 ? "code" : "codes"} left.`
            : "A code from your authenticator app at sign-in"
        }
      >
        {tf?.on && (
          <Button variant="ghost" size="sm" onClick={() => setDialog("recovery")}>
            New recovery codes
          </Button>
        )}
        <Switch
          checked={!!tf?.on}
          label="Two-factor authentication"
          onChange={(on) => setDialog(on ? "enable" : "disable")}
        />
      </Row>
      <Row label="Sign-in alerts" hint="Email me when a new device signs in">
        <Switch
          checked={status?.signInAlerts ?? true}
          label="Sign-in alerts"
          onChange={async (on) => {
            await setAlerts({ on });
            toast("Sign-in alerts", { detail: on ? "Turned on" : "Turned off" });
          }}
        />
      </Row>

      <div className="fk-sessions">
        {(status?.sessions ?? []).map((s) => (
          <div key={s._id} className="fk-session">
            <span className="fk-session-mark" aria-hidden>
              {/iPhone|Android|iPad/.test(s.device) ? (
                <Smartphone size={18} strokeWidth={1.7} />
              ) : (
                <Monitor size={18} strokeWidth={1.7} />
              )}
            </span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span className="fk-session-name">{s.device}</span>
              <span className="fk-session-meta">
                {s.current ? "This device · active now" : `Last active ${relativeTime(s.lastSeen)}`}
              </span>
            </span>
            {s.current ? (
              <Badge tone="success">This device</Badge>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                onClick={async () => {
                  await signOutSession({ sessionId: s._id as Id<"authSessions"> });
                  toast("Signed out", { detail: s.device });
                }}
              >
                Sign out
              </Button>
            )}
          </div>
        ))}
      </div>

      <div className="fk-setpanel-actions">
        <Button
          variant="secondary"
          iconLeft={<LogOut size={16} strokeWidth={1.8} aria-hidden />}
          onClick={async () => {
            const n = await signOutOthers({});
            toast("Signed out everywhere", {
              detail: n ? `${n} other ${n === 1 ? "device needs" : "devices need"} to sign in again` : "No other device was signed in",
            });
          }}
        >
          Sign out everywhere
        </Button>
        <Button
          variant="secondary"
          iconLeft={<RotateCcw size={16} strokeWidth={1.8} aria-hidden />}
          onClick={() => {
            try {
              for (const key of Object.keys(window.localStorage)) if (key.startsWith("fk.")) window.localStorage.removeItem(key);
              window.sessionStorage.clear();
            } catch {
              /* nothing saved */
            }
            toast("Reset", { detail: "Drafts and preferences saved in this browser are cleared" });
            window.setTimeout(() => router.refresh(), 400);
          }}
        >
          Reset this device
        </Button>
        <Button
          variant="destructive"
          iconLeft={<Trash2 size={16} strokeWidth={1.8} aria-hidden />}
          onClick={() => setDialog("delete")}
        >
          Delete account
        </Button>
      </div>

      {dialog === "enable" && <EnableTwoFactor email={viewer.email} onClose={() => setDialog(null)} />}
      {(dialog === "disable" || dialog === "recovery") && (
        <CodeCheck mode={dialog} onClose={() => setDialog(null)} />
      )}
      {dialog === "delete" && <DeleteAccount onClose={() => setDialog(null)} />}
    </Panel>
  );
}

function RecoveryCodes({ codes }: { codes: string[] }) {
  const toast = useToast();
  return (
    <div className="fk-recovery">
      <p className="fk-setpanel-text" style={{ margin: 0 }}>
        Keep these somewhere safe. Each one signs you in once if you lose your phone. They are shown only now.
      </p>
      <div className="fk-recovery-codes">
        {codes.map((c) => (
          <span key={c}>{c}</span>
        ))}
      </div>
      <div className="fk-setpanel-actions" style={{ marginTop: 0 }}>
        <Button
          variant="secondary"
          size="sm"
          iconLeft={<Copy size={15} strokeWidth={1.8} aria-hidden />}
          onClick={async () => {
            await navigator.clipboard.writeText(codes.join("\n"));
            toast("Recovery codes copied");
          }}
        >
          Copy
        </Button>
        <Button
          variant="secondary"
          size="sm"
          iconLeft={<Download size={15} strokeWidth={1.8} aria-hidden />}
          onClick={() => {
            const url = URL.createObjectURL(
              new Blob([`Formkit recovery codes\n\n${codes.join("\n")}\n`], { type: "text/plain" }),
            );
            const a = document.createElement("a");
            a.href = url;
            a.download = "formkit-recovery-codes.txt";
            a.click();
            URL.revokeObjectURL(url);
          }}
        >
          Download
        </Button>
      </div>
    </div>
  );
}

function EnableTwoFactor({ email, onClose }: { email: string; onClose: () => void }) {
  const toast = useToast();
  const start = useMutation(api.security.startTwoFactor);
  const enable = useMutation(api.security.enableTwoFactor);
  const [setup, setSetup] = useState<{ secret: string; uri: string; qr: string } | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [codes, setCodes] = useState<string[] | null>(null);

  useEffect(() => {
    let alive = true;
    start({})
      .then(async (s) => {
        const qr = await QRCode.toString(s.uri, { type: "svg", margin: 1, color: { dark: "#21282E", light: "#ffffff" } });
        if (alive) setSetup({ ...s, qr });
      })
      .catch((e) => alive && setError(errorText(e, "Formkit could not start the setup.")));
    return () => {
      alive = false;
    };
  }, [start]);

  if (codes) {
    return (
      <Modal title="Two-factor is on" description="From now on, signing in asks for a code from your app." onClose={onClose} width={500}
        footer={<Button onClick={onClose}>I have saved them</Button>}>
        <RecoveryCodes codes={codes} />
      </Modal>
    );
  }

  return (
    <Modal
      title="Turn on two-factor"
      description="Scan the code with an authenticator app — 1Password, Google Authenticator, Authy — then type the six digits it shows."
      onClose={onClose}
      width={520}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={code.length < 6 || !setup}
            onClick={async () => {
              setError("");
              const r = await enable({ code });
              if (!r.ok) setError(r.message);
              else {
                setCodes(r.recovery);
                toast("Two-factor is on", { detail: email });
              }
            }}
          >
            Turn it on
          </Button>
        </>
      }
    >
      <div className="fk-tfa">
        <span className="fk-tfa-qr" aria-label="QR code for your authenticator app" role="img">
          {setup ? <span dangerouslySetInnerHTML={{ __html: setup.qr }} /> : null}
        </span>
        <div style={{ flex: 1, minWidth: 200, display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <div className="fk-proprow-hint" style={{ marginBottom: 6 }}>
              Cannot scan? Type this key instead:
            </div>
            <span className="fk-tfa-key">{setup?.secret.match(/.{1,4}/g)?.join(" ") ?? "…"}</span>
          </div>
          <Field label="Six-digit code" error={error || undefined}>
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="123456"
              icon={<KeyRound size={17} strokeWidth={1.8} aria-hidden />}
              invalid={!!error}
            />
          </Field>
        </div>
      </div>
    </Modal>
  );
}

function CodeCheck({ mode, onClose }: { mode: "disable" | "recovery"; onClose: () => void }) {
  const toast = useToast();
  const disable = useMutation(api.security.disableTwoFactor);
  const regenerate = useMutation(api.security.newRecoveryCodes);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [codes, setCodes] = useState<string[] | null>(null);

  if (codes) {
    return (
      <Modal title="New recovery codes" description="The old ones no longer work." onClose={onClose} width={500}
        footer={<Button onClick={onClose}>I have saved them</Button>}>
        <RecoveryCodes codes={codes} />
      </Modal>
    );
  }
  return (
    <Modal
      title={mode === "disable" ? "Turn off two-factor?" : "Make new recovery codes"}
      description={
        mode === "disable"
          ? "Signing in will ask only for your password. Type a code from your app to confirm."
          : "Type a code from your app. The codes you have now stop working."
      }
      onClose={onClose}
      width={480}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant={mode === "disable" ? "destructive" : "primary"}
            disabled={!code.trim()}
            onClick={async () => {
              setError("");
              if (mode === "disable") {
                const r = await disable({ code: code.trim() });
                if (!r.ok) return setError(r.message ?? "That code did not match.");
                toast("Two-factor is off");
                onClose();
              } else {
                const r = await regenerate({ code: code.trim() });
                if (!r.ok) return setError(r.message);
                setCodes(r.recovery);
              }
            }}
          >
            {mode === "disable" ? "Turn it off" : "Make new codes"}
          </Button>
        </>
      }
    >
      <Field label="Code from your app, or a recovery code" error={error || undefined}>
        <Input
          autoFocus
          value={code}
          onChange={(e) => setCode(e.target.value)}
          autoComplete="one-time-code"
          placeholder="123456"
          icon={<KeyRound size={17} strokeWidth={1.8} aria-hidden />}
          invalid={!!error}
        />
      </Field>
    </Modal>
  );
}

function DeleteAccount({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const { signOut } = useAuthActions();
  const remove = useMutation(api.security.deleteAccount);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const ready = text.trim().toLowerCase() === "delete";

  return (
    <Modal title="Delete your account?" description="Every form, response and template goes with it." onClose={onClose} width={460}>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div className="fk-alert" data-tone="warning">
          <strong>We keep your data for 30 days</strong>
          <span>
            Sign in any time in the next 30 days and click Reactivate my account to bring it all back. After
            that it is erased for good.
          </span>
        </div>
        <Field label="Type delete to confirm" error={error || undefined}>
          <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="delete" autoComplete="off" />
        </Field>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, flexWrap: "wrap" }}>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            disabled={!ready || busy}
            iconLeft={<Trash2 size={16} strokeWidth={1.8} aria-hidden />}
            onClick={async () => {
              setBusy(true);
              try {
                await remove({ confirm: text });
                await signOut().catch(() => undefined);
                router.push("/signin");
              } catch (e) {
                setError(errorText(e, "Formkit could not delete the account."));
                setBusy(false);
              }
            }}
          >
            Delete my account
          </Button>
        </div>
      </div>
    </Modal>
  );
}
