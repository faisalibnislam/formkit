"use client";

import { useRef, useState } from "react";
import { Check, Globe, Lock, RefreshCw } from "lucide-react";
import { SceneFrame, useInView, useReducedMotion, useStep, type SceneProps } from "@/components/site/scenes/shared";

/**
 * A custom domain being connected, playing by itself: the subdomain is
 * typed in, Formkit shows the one CNAME record to add, checks it, and the
 * form's link moves from formkit.app to the company's own domain.
 */

const DOMAIN = "forms.acme.com";

/** 0 typing, 1 the record to add, 2 checking, 3 live. */
const PHASE_MS = [1500, 1700, 1300, 3000];

export function DomainScene({ compact }: SceneProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const seen = useInView(ref, 0.25);
  const still = useReducedMotion();
  const [phase, setPhase] = useState(0);
  const [typed, setTyped] = useState(0);
  const shown = still ? 3 : phase;
  const chars = still || phase > 0 ? DOMAIN.length : typed;

  useStep(seen && !still && phase === 0 && typed < DOMAIN.length, 70, () => setTyped(typed + 1), [typed, phase]);
  useStep(seen && !still && (phase > 0 || typed >= DOMAIN.length), PHASE_MS[phase]!, () => {
    const next = (phase + 1) % PHASE_MS.length;
    setPhase(next);
    if (next === 0) setTyped(0);
  }, [phase, typed >= DOMAIN.length]);

  const live = shown === 3;
  const status = live ? "Live" : shown === 2 ? "Checking…" : "Waiting for DNS";

  return (
    <div ref={ref} className="fk-cd" data-compact={compact || undefined}>
      <SceneFrame title="Settings · Custom domains" label="Connecting forms.acme.com to Formkit with one DNS record" right={<span className="fk-cd-pro">Pro</span>}>
        <div className="fk-cd-body">
          <div className="fk-cd-pane">
            <span className="fk-cd-input" data-live={shown === 0 || undefined}>
              <Globe size={13} strokeWidth={2} aria-hidden />
              <span>
                {DOMAIN.slice(0, chars)}
                {shown === 0 && <i className="fk-rs-caret" />}
              </span>
              {shown > 0 && (
                <span className="fk-cd-status" data-state={live ? "live" : shown === 2 ? "check" : "wait"}>
                  {live ? (
                    <Check size={11} strokeWidth={2.6} aria-hidden />
                  ) : shown === 2 ? (
                    <RefreshCw size={11} strokeWidth={2.4} aria-hidden />
                  ) : null}
                  {status}
                </span>
              )}
            </span>
            <span className="fk-cd-record" data-on={shown >= 1 || undefined}>
              <span className="fk-cd-rhead">
                <span>Type</span>
                <span>Name</span>
                <span>Value</span>
              </span>
              <span className="fk-cd-rrow">
                <b>CNAME</b>
                <span>forms</span>
                <span>cname.vercel-dns.com</span>
              </span>
            </span>
          </div>

          <div className="fk-cd-browser" data-live={live || undefined}>
            <span className="fk-cd-url">
              <Lock size={11} strokeWidth={2.4} aria-hidden />
              <span key={live ? "own" : "fk"}>{live ? `${DOMAIN}/intake` : "formkit.app/acme/intake"}</span>
            </span>
            <span className="fk-cd-form">
              <span className="fk-cd-logo">A</span>
              <b>Tell us about your project</b>
              <span className="fk-cd-field" />
              <span className="fk-cd-btn">Continue</span>
            </span>
          </div>
        </div>
      </SceneFrame>
    </div>
  );
}
