"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { ArrowLeft, ArrowRight, CircleCheck, Lock, Paperclip } from "lucide-react";
import { BRAND_CHOICES, LIVE_QUESTIONS } from "@/content/landing";

/**
 * ANSWER. The real form, answered here.
 *
 * It walks itself through the three steps roughly every three seconds while on
 * screen, and hands control over permanently the moment the visitor touches it.
 * Reduced motion skips the auto-advance entirely.
 */
export const STEP_PROGRESS = [72, 82, 100];
export const STEP_QUESTION = [8, 9, 11];

/**
 * The live form's state, shared by the desktop scene and the phone layout: it
 * walks itself through the steps while on screen and stops for good the moment
 * the visitor touches it.
 */
export function useLiveForm(section: RefObject<HTMLElement | null>) {
  const [step, setStep] = useState(0);
  const [chosen, setChosen] = useState<string | null>(null);
  const [attached, setAttached] = useState(false);
  const [manual, setManual] = useState(false);

  const reset = useCallback(() => {
    setChosen(null);
    setAttached(false);
  }, []);

  const advance = useCallback(() => {
    setStep((s) => {
      const next = s >= 2 ? 0 : s + 1;
      if (next === 0) reset();
      return next;
    });
  }, [reset]);

  const takeOver = useCallback(() => setManual(true), []);

  useEffect(() => {
    if (manual) return;
    if (window.matchMedia("(prefers-reduced-motion:reduce)").matches) return;

    const id = window.setInterval(() => {
      const el = section.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      // A hidden layout measures as an empty box at the origin.
      const onScreen = r.height > 0 && r.bottom > 0 && r.top < window.innerHeight;
      if (!onScreen) return;
      // On the choice step the demo picks an option before moving on, so the
      // visitor sees the selection happen rather than a bare page turn.
      setChosen((c) => {
        if (step === 0 && !c) return BRAND_CHOICES[0]!.id;
        advance();
        return c;
      });
    }, 3000);
    return () => window.clearInterval(id);
  }, [advance, manual, section, step]);

  return {
    step,
    chosen,
    attached,
    nextLabel: step === 1 ? "Submit" : step === 2 ? "Start again" : "Continue",
    choose: (id: string) => {
      takeOver();
      setChosen(id);
    },
    attach: () => {
      takeOver();
      setAttached(true);
    },
    back: () => {
      takeOver();
      setStep((s) => Math.max(0, s - 1));
    },
    next: () => {
      takeOver();
      advance();
    },
  };
}

export function AnswerScene() {
  const section = useRef<HTMLElement | null>(null);
  const { step, chosen, attached, nextLabel, choose, attach, back, next } = useLiveForm(section);

  return (
    <section
      ref={section}
      id="answer"
      style={{
        position: "relative",
        background: "var(--blue-50)",
        padding: "clamp(60px,8vw,110px) 0",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
          gap: 28,
          flexWrap: "wrap",
          padding: "0 clamp(24px,7vw,110px)",
        }}
      >
        <div>
          <span style={{ fontSize: 11.5, letterSpacing: ".16em", color: "var(--blue-700)" }}>
            ANSWER
          </span>
          <h2
            style={{
              margin: "14px 0 0",
              maxWidth: "14ch",
              fontSize: "clamp(28px,4.6vw,62px)",
              fontWeight: 700,
              letterSpacing: "-.035em",
              lineHeight: 1,
            }}
          >
            Filling it in should feel like talking to you.
          </h2>
        </div>
        <p
          style={{
            margin: 0,
            maxWidth: "30ch",
            fontSize: 15.5,
            lineHeight: 1.6,
            color: "var(--neutral-700)",
          }}
        >
          This is the real form. Answer it here; it works the way it does for your client.
        </p>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: "clamp(18px,3vw,44px)",
          flexWrap: "wrap",
          marginTop: "clamp(32px,4vw,56px)",
          padding: "0 clamp(24px,7vw,110px)",
        }}
      >
        <div
          style={{
            flex: "1 1 520px",
            minWidth: 0,
            background: "#ffffff",
            border: "1px solid var(--neutral-200)",
            borderRadius: 20,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "12px 18px",
              borderBottom: "1px solid var(--neutral-200)",
              fontSize: 12.5,
              color: "var(--color-text-tertiary)",
            }}
          >
            <Lock size={13} strokeWidth={1.8} aria-hidden />
            formkit.app/studio-nine/client-onboarding
            <span style={{ flex: 1 }} />
            <span>
              {step === 2 ? "Submitted" : `Question ${STEP_QUESTION[step]} of 11`}
            </span>
          </div>

          <div style={{ padding: "clamp(24px,3.4vw,46px)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 32,
                  height: 32,
                  borderRadius: 9,
                  background: "var(--neutral-900)",
                  color: "var(--neutral-0)",
                  fontSize: 13,
                  fontWeight: 600,
                }}
              >
                S9
              </span>
              <span style={{ fontSize: 13.5, color: "var(--neutral-700)" }}>Studio Nine</span>
              <span style={{ flex: 1 }} />
              <span
                style={{
                  flex: "0 0 120px",
                  height: 4,
                  borderRadius: 4,
                  background: "var(--neutral-150)",
                  overflow: "hidden",
                }}
              >
                <span
                  style={{
                    display: "block",
                    height: "100%",
                    width: `${STEP_PROGRESS[step]}%`,
                    background: "var(--blue-500)",
                    transition: "width .4s cubic-bezier(.22,.8,.24,1)",
                  }}
                />
              </span>
            </div>

            <div style={{ marginTop: "clamp(22px,3vw,38px)" }}>
              {step === 0 && (
                <>
                  <div
                    style={{
                      maxWidth: "22ch",
                      fontSize: "clamp(20px,2.4vw,30px)",
                      fontWeight: 600,
                      letterSpacing: "-.02em",
                      color: "var(--neutral-900)",
                    }}
                  >
                    {LIVE_QUESTIONS[0]}
                  </div>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fit,minmax(min(190px,100%),1fr))",
                      gap: 10,
                      marginTop: 20,
                    }}
                  >
                    {BRAND_CHOICES.map((b) => (
                      <button
                        key={b.id}
                        type="button"
                        className="fk-live-choice"
                        data-on={chosen === b.id}
                        onClick={() => choose(b.id)}
                      >
                        <BrandMark brand={b} size={22} />
                        <span
                          style={{
                            flex: 1,
                            minWidth: 0,
                            fontSize: 15,
                            color: "var(--neutral-900)",
                          }}
                        >
                          {b.name}
                        </span>
                        <span
                          style={{
                            display: "inline-flex",
                            color: "var(--blue-700)",
                            opacity: chosen === b.id ? 1 : 0,
                            transition: "opacity .2s ease",
                          }}
                        >
                          <CircleCheck size={18} strokeWidth={1.8} aria-hidden />
                        </span>
                      </button>
                    ))}
                  </div>
                </>
              )}

              {step === 1 && (
                <>
                  <div
                    style={{
                      maxWidth: "22ch",
                      fontSize: "clamp(20px,2.4vw,30px)",
                      fontWeight: 600,
                      letterSpacing: "-.02em",
                      color: "var(--neutral-900)",
                    }}
                  >
                    {LIVE_QUESTIONS[1]}
                  </div>
                  <button
                    type="button"
                    onClick={attach}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 14,
                      width: "100%",
                      marginTop: 20,
                      padding: 20,
                      border: `1px dashed ${attached ? "var(--blue-500)" : "var(--neutral-300)"}`,
                      borderRadius: 12,
                      background: attached ? "var(--blue-50)" : "var(--neutral-50)",
                      cursor: "pointer",
                      textAlign: "left",
                      transition: "border-color .2s ease,background .2s ease",
                    }}
                  >
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        width: 38,
                        height: 38,
                        borderRadius: 10,
                        background: "#ffffff",
                        color: "var(--neutral-700)",
                        boxShadow: "inset 0 0 0 1px var(--neutral-200)",
                      }}
                    >
                      <Paperclip size={17} strokeWidth={1.8} aria-hidden />
                    </span>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span
                        style={{ display: "block", fontSize: 14.5, color: "var(--neutral-900)" }}
                      >
                        {attached
                          ? "northstar-brand-2026.pdf · 2.4 MB"
                          : "Select a file, or drop it here"}
                      </span>
                      <span
                        style={{
                          display: "block",
                          marginTop: 3,
                          fontSize: 12.5,
                          color: "var(--color-text-tertiary)",
                        }}
                      >
                        Up to 10 MB · .pdf .png .docx
                      </span>
                    </span>
                  </button>
                </>
              )}

              {step === 2 && (
                <div style={{ display: "flex", alignItems: "center", gap: 13 }}>
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      width: 44,
                      height: 44,
                      borderRadius: "50%",
                      background: "var(--green-100)",
                      color: "var(--green-600)",
                    }}
                  >
                    <CircleCheck size={20} strokeWidth={1.8} aria-hidden />
                  </span>
                  <span>
                    <span
                      style={{
                        display: "block",
                        fontSize: "clamp(19px,2.2vw,26px)",
                        fontWeight: 600,
                        letterSpacing: "-.02em",
                        color: "var(--neutral-900)",
                      }}
                    >
                      {LIVE_QUESTIONS[2]}
                    </span>
                    <span
                      style={{
                        display: "block",
                        marginTop: 5,
                        fontSize: 14,
                        color: "var(--neutral-600)",
                      }}
                    >
                      Studio Nine will be in touch within two working days.
                    </span>
                  </span>
                </div>
              )}
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                marginTop: "clamp(22px,3vw,34px)",
              }}
            >
              <button
                type="button"
                onClick={back}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  height: 44,
                  padding: "0 16px",
                  border: "1px solid var(--neutral-200)",
                  borderRadius: "var(--radius-pill)",
                  background: "#ffffff",
                  color: "var(--neutral-700)",
                  fontSize: 14,
                  cursor: "pointer",
                  opacity: step === 0 ? 0.5 : 1,
                }}
              >
                <ArrowLeft size={15} strokeWidth={1.8} aria-hidden />
                Back
              </button>
              <button
                type="button"
                onClick={next}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 9,
                  height: 44,
                  padding: "0 20px",
                  border: "none",
                  borderRadius: "var(--radius-pill)",
                  background: "var(--neutral-900)",
                  color: "var(--neutral-0)",
                  fontSize: 14.5,
                  cursor: "pointer",
                }}
              >
                {nextLabel}
                <ArrowRight size={15} strokeWidth={1.8} aria-hidden />
              </button>
              <span style={{ flex: 1 }} />
              <span
                style={{
                  fontSize: 12.5,
                  color: "var(--color-text-tertiary)",
                  opacity: step > 0 ? 1 : 0,
                  transition: "opacity .3s ease",
                }}
              >
                Answers saved
              </span>
            </div>
          </div>
        </div>

        {/* The same form on a phone, tracking every state. */}
        <div
          style={{
            flex: "0 0 250px",
            maxWidth: "100%",
            padding: 9,
            border: "1px solid var(--neutral-200)",
            borderRadius: 30,
            background: "#ffffff",
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              minHeight: 420,
              padding: "20px 16px 22px",
              borderRadius: 22,
              background: "var(--mint-100)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 24,
                  height: 24,
                  borderRadius: 7,
                  background: "var(--neutral-900)",
                  color: "var(--neutral-0)",
                  fontSize: 10.5,
                  fontWeight: 600,
                }}
              >
                S9
              </span>
              <span style={{ fontSize: 11, color: "var(--neutral-700)" }}>Studio Nine</span>
              <span style={{ flex: 1 }} />
              <span style={{ fontSize: 11, color: "var(--neutral-600)" }}>
                {step === 2 ? "Done" : `${STEP_QUESTION[step]}/11`}
              </span>
            </div>
            <div
              style={{
                marginTop: 18,
                fontSize: 15.5,
                fontWeight: 500,
                letterSpacing: "-.01em",
                color: "var(--neutral-900)",
              }}
            >
              {LIVE_QUESTIONS[step]}
            </div>
            {step === 0 && (
              <div
                style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 14 }}
              >
                {BRAND_CHOICES.map((b) => (
                  <span
                    key={b.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 9,
                      padding: "11px 12px",
                      borderRadius: 11,
                      background: "#ffffff",
                      boxShadow:
                        chosen === b.id
                          ? "inset 0 0 0 1.5px var(--neutral-900)"
                          : "inset 0 0 0 1px var(--neutral-200)",
                      fontSize: 13,
                      color: "var(--neutral-800)",
                      transition: "box-shadow .2s ease",
                    }}
                  >
                    <BrandMark brand={b} size={16} />
                    {b.name}
                  </span>
                ))}
              </div>
            )}
            <span style={{ flex: 1 }} />
            <span
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                height: 42,
                marginTop: 16,
                borderRadius: "var(--radius-pill)",
                background: "var(--neutral-900)",
                color: "var(--neutral-0)",
                fontSize: 13.5,
              }}
            >
              Continue
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}

/** An invented mark, shown only as a selectable answer inside this question. */
export function BrandMark({
  brand,
  size,
}: {
  brand: (typeof BRAND_CHOICES)[number];
  size: number;
}) {
  return (
    <span
      aria-hidden
      style={{
        flex: "0 0 auto",
        width: size,
        height: size,
        borderRadius: brand.radius,
        background: brand.mark,
        clipPath: brand.clip,
        border: brand.border
          ? size > 18
            ? brand.border
            : brand.border.replace("3px", "2.5px")
          : undefined,
      }}
    />
  );
}
