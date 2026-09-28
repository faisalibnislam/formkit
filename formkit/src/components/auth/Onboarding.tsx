"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, ArrowRight, Store, User } from "lucide-react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { NightSky } from "@/components/brand/NightSky";
import { Logo } from "@/components/brand/Logo";
import {
  Button,
  Checkbox,
  Field,
  Input,
  PillTabs,
  ProgressBar,
  Select,
  Switch,
} from "@/components/ui";
import { useToast } from "@/components/ui/Toast";

/**
 * Four steps after verification: about you, your company (optional), what you
 * will collect, and notifications. Answers write through to Settings.
 *
 * A company is optional and most people never add one - the step can be left
 * empty and passed over, and "I work on my own" does exactly that.
 */
const USES = [
  { label: "Client intake", hint: "Briefs, budgets and scope" },
  { label: "Event registration", hint: "Sign-ups and guest lists" },
  { label: "Feedback and surveys", hint: "Ratings and open questions" },
  { label: "Job applications", hint: "CVs and portfolio links" },
  { label: "Lead capture", hint: "Contact details from your site" },
  { label: "Orders and bookings", hint: "Products, dates and delivery" },
];

const ROLES = [
  "Designer",
  "Founder",
  "Product manager",
  "Marketing",
  "Operations",
  "Engineer",
  "Research",
  "Something else",
];

const SIZES = ["Just me", "2–10", "11–50", "50+"] as const;

export function Onboarding() {
  const router = useRouter();
  const toast = useToast();
  const viewer = useQuery(api.users.viewer);
  const updateProfile = useMutation(api.users.updateProfile);
  const completeOnboarding = useMutation(api.users.completeOnboarding);
  const addCompany = useMutation(api.companies.add);

  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [role, setRole] = useState("Designer");
  const [size, setSize] = useState<(typeof SIZES)[number]>("Just me");
  const [company, setCompany] = useState("");
  const [tagline, setTagline] = useState("");
  const [uses, setUses] = useState<string[]>([]);
  const [notifyNew, setNotifyNew] = useState(true);
  const [notifyWeekly, setNotifyWeekly] = useState(true);
  const [busy, setBusy] = useState(false);

  const displayName = name || viewer?.name || "";

  const finish = async (skipped: boolean) => {
    setBusy(true);
    try {
      if (!skipped) {
        await updateProfile({
          ...(name.trim() ? { name: name.trim() } : {}),
          role,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        });
        if (company.trim()) {
          await addCompany({ name: company.trim(), tagline: tagline.trim() || undefined });
        }
      }
      await completeOnboarding({});
      router.push("/app");
    } catch (err) {
      toast("Formkit could not save that.", {
        detail: err instanceof Error ? err.message : undefined,
        tone: "error",
      });
      setBusy(false);
    }
  };

  const summary = (() => {
    const who = company.trim() || displayName.trim().split(" ")[0] || "your dashboard";
    return uses.length
      ? `We will open ${who} with ${uses.length} ${uses.length === 1 ? "template" : "templates"} matching what you picked.`
      : `We will open ${who} with the full template library so you can browse.`;
  })();

  return (
    <div
      style={{
        position: "relative",
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "clamp(20px,4vw,48px) clamp(16px,4vw,40px)",
        background: "#0a3d6f",
        fontFamily: "var(--font-sans)",
        color: "var(--color-text-primary)",
      }}
    >
      <a className="fk-skip" href="#fk-onb-main">
        Skip to content
      </a>
      <NightSky />

      <div
        id="fk-onb-main"
        style={{
          position: "relative",
          zIndex: 1,
          width: "100%",
          maxWidth: 620,
          padding: "32px 34px 28px",
          borderRadius: "var(--radius-panel)",
          background: "var(--color-surface-raised)",
          boxShadow: "var(--shadow-float)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
          }}
        >
          <Logo size={24} />
          <span
            style={{
              flex: "0 0 auto",
              whiteSpace: "nowrap",
              fontSize: 13,
              color: "var(--color-text-tertiary)",
            }}
          >
            Step {step + 1} of 4
          </span>
        </div>
        <div style={{ margin: "16px 0 26px" }}>
          <ProgressBar value={(step + 1) * 25} />
        </div>

        {step === 0 && (
          <>
            <StepHead title="A little about you">
              This is what your name looks like on shared forms.
            </StepHead>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <Field label="Full name">
                <Input
                  icon={<User size={17} strokeWidth={1.8} aria-hidden />}
                  placeholder="Maya Ortiz"
                  value={displayName}
                  onChange={(e) => setName(e.target.value)}
                />
              </Field>
              <Field label="What do you do">
                <Select
                  ariaLabel="What do you do"
                  value={role}
                  options={ROLES.map((r) => ({ value: r, label: r }))}
                  onChange={setRole}
                />
              </Field>
              <Field label="How many people work on your forms">
                <PillTabs
                  ariaLabel="Team size"
                  value={size}
                  onChange={setSize}
                  tabs={SIZES.map((s) => ({ value: s, label: s }))}
                />
              </Field>
            </div>
          </>
        )}

        {step === 1 && (
          <>
            <StepHead title="Your company, if you have one">
              Optional. Without one, forms go out under your own name. That is how most people
              use Formkit.
            </StepHead>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <Field label="Company name">
                <Input
                  icon={<Store size={17} strokeWidth={1.8} aria-hidden />}
                  placeholder="Studio Nine"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                />
              </Field>
              <Field label="One line about it">
                <Input
                  placeholder="Brand and product design"
                  value={tagline}
                  onChange={(e) => setTagline(e.target.value)}
                />
              </Field>
              <p
                style={{
                  margin: 0,
                  fontSize: 13.5,
                  lineHeight: 1.55,
                  color: "var(--color-text-tertiary)",
                }}
              >
                You can add a company, a logo and brand colours at any time under Settings,
                Companies. One person can hold as many as they need.
              </p>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <StepHead title="What will you collect?">
              Pick as many as you like. We put matching templates at the top of your library.
            </StepHead>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit,minmax(min(240px,100%),1fr))",
                gap: 12,
              }}
            >
              {USES.map((u) => (
                <div
                  key={u.label}
                  style={{
                    padding: "14px 16px",
                    borderRadius: "var(--radius-card-inner)",
                    background: "var(--neutral-50)",
                  }}
                >
                  <Checkbox
                    label={u.label}
                    description={u.hint}
                    checked={uses.includes(u.label)}
                    onChange={(on) =>
                      setUses((list) =>
                        on ? [...list, u.label] : list.filter((x) => x !== u.label),
                      )
                    }
                  />
                </div>
              ))}
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <StepHead title="When should we email you?">
              Both of these are easy to change later.
            </StepHead>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <NotifyRow
                label="A new response arrives"
                hint="One email per submission"
                checked={notifyNew}
                onChange={setNotifyNew}
              />
              <NotifyRow
                label="Weekly report"
                hint="Completion rate and drop-off, every Monday"
                checked={notifyWeekly}
                onChange={setNotifyWeekly}
              />
            </div>
            <div
              style={{
                marginTop: 20,
                padding: "16px 18px",
                borderRadius: "var(--radius-card-inner)",
                background: "var(--neutral-50)",
                fontSize: 14,
                lineHeight: 1.6,
                color: "var(--color-text-secondary)",
              }}
            >
              {summary}
            </div>
          </>
        )}

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            flexWrap: "wrap",
            marginTop: 28,
          }}
        >
          {step > 0 && (
            <Button
              variant="secondary"
              onClick={() => setStep((s) => Math.max(0, s - 1))}
              iconLeft={<ArrowLeft size={16} strokeWidth={1.8} aria-hidden />}
            >
              Back
            </Button>
          )}
          <div style={{ flex: 1, minWidth: 8 }} />
          {step === 1 && (
            <Button
              variant="secondary"
              onClick={() => {
                setCompany("");
                setTagline("");
                setStep(2);
              }}
            >
              I work on my own
            </Button>
          )}
          <Button variant="ghost" disabled={busy} onClick={() => finish(true)}>
            Skip setup
          </Button>
          <Button
            disabled={busy}
            onClick={() => (step === 3 ? finish(false) : setStep((s) => s + 1))}
            iconRight={<ArrowRight size={17} strokeWidth={1.8} aria-hidden />}
          >
            {step === 3 ? (busy ? "Saving…" : "Finish setup") : "Continue"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function StepHead({ title, children }: { title: string; children: React.ReactNode }) {
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

function NotifyRow({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 16,
        padding: "16px 0",
        boxShadow: "inset 0 -1px 0 var(--neutral-200)",
      }}
    >
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: "block", fontSize: 15, color: "var(--neutral-900)" }}>
          {label}
        </span>
        <span
          style={{
            display: "block",
            marginTop: 3,
            fontSize: 13.5,
            color: "var(--color-text-tertiary)",
          }}
        >
          {hint}
        </span>
      </span>
      <Switch checked={checked} onChange={onChange} label={label} />
    </div>
  );
}
