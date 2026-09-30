"use client";

import { useRef, useState } from "react";
import { Check, CreditCard, Lock, Minus, Plus, RotateCcw } from "lucide-react";
import { SceneFrame, useInView, useReducedMotion, useStep, type SceneProps } from "./shared";

/**
 * A booking form works out the total, checkout takes the card, and the
 * response in the inbox turns from Awaiting payment to Paid.
 */

const PRICE = 120;
const LUNCH = 15;

type Stage = "form" | "checkout" | "paying" | "paid";

export function PaymentScene({ compact }: SceneProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const seen = useInView(ref);
  const still = useReducedMotion();
  const [places, setPlaces] = useState(2);
  const [lunch, setLunch] = useState(true);
  const [stage, setStage] = useState<Stage>("form");
  const on = seen && !still;
  const total = places * (PRICE + (lunch ? LUNCH : 0));

  useStep(on && stage === "paying", 1300, () => setStage("paid"), [stage]);
  // On the index: pay, wait, start again with a different booking.
  useStep(on && !!compact && stage === "form", 2200, () => setStage("checkout"), [stage]);
  useStep(on && !!compact && stage === "checkout", 1500, () => setStage("paying"), [stage]);
  useStep(on && !!compact && stage === "paid", 3000, () => {
    setPlaces(places === 2 ? 3 : 2);
    setLunch(!lunch);
    setStage("form");
  }, [stage]);

  const shown: Stage = still ? "paid" : stage;
  const status = shown === "paid" ? "Paid" : "Awaiting payment";

  return (
    <SceneFrame
      innerRef={ref}
      compact={compact}
      title="Workshop booking"
      label={`A booking form totals ${places} places at $${PRICE}, takes payment by card, and marks the response as paid.`}
      right={
        !compact &&
        shown === "paid" && (
          <button type="button" className="fk-sc-icon" onClick={() => setStage("form")} aria-label="Start again">
            <RotateCcw size={14} strokeWidth={2} />
          </button>
        )
      }
    >
      <div className="fk-py">
        <div className="fk-py-form" data-dim={shown !== "form" || undefined}>
          <div className="fk-py-row">
            <span>
              Places <em>${PRICE} each</em>
            </span>
            <span className="fk-py-step">
              <button
                type="button"
                aria-label="One fewer place"
                disabled={shown !== "form" || compact || places <= 1}
                onClick={() => setPlaces(places - 1)}
              >
                <Minus size={14} strokeWidth={2.2} />
              </button>
              <b>{places}</b>
              <button
                type="button"
                aria-label="One more place"
                disabled={shown !== "form" || compact || places >= 6}
                onClick={() => setPlaces(places + 1)}
              >
                <Plus size={14} strokeWidth={2.2} />
              </button>
            </span>
          </div>
          <label className="fk-py-row fk-py-check">
            <span>
              Add lunch <em>+${LUNCH} a place</em>
            </span>
            <input
              type="checkbox"
              checked={lunch}
              disabled={shown !== "form" || compact}
              onChange={(e) => setLunch(e.target.checked)}
            />
            <i aria-hidden>{lunch && <Check size={13} strokeWidth={2.6} />}</i>
          </label>
          <div className="fk-py-total">
            <span>
              Total <em>places × (price + lunch)</em>
            </span>
            <b key={total}>${total}</b>
          </div>
          <button
            type="button"
            className="fk-py-pay"
            disabled={shown !== "form" || compact}
            onClick={() => setStage("checkout")}
          >
            Book and pay ${total}
          </button>
        </div>

        <div className="fk-py-side">
          <div className="fk-py-checkout" data-stage={shown}>
            {shown === "form" ? (
              <span className="fk-py-wait">
                <CreditCard size={18} strokeWidth={1.8} aria-hidden />
                Checkout opens when they send the form
              </span>
            ) : shown === "paid" ? (
              <span className="fk-py-done">
                <span className="fk-py-tick">
                  <Check size={20} strokeWidth={2.6} aria-hidden />
                </span>
                <b>${total} paid</b>
                <em>Straight to your Stripe account</em>
              </span>
            ) : (
              <>
                <span className="fk-py-ch">
                  <Lock size={13} strokeWidth={2} aria-hidden /> Checkout · Stripe
                </span>
                <b className="fk-py-amt">${total}.00</b>
                <span className="fk-py-card">
                  <CreditCard size={15} strokeWidth={1.8} aria-hidden /> •••• 4242
                </span>
                <button
                  type="button"
                  disabled={shown === "paying" || compact}
                  onClick={() => setStage("paying")}
                  data-busy={shown === "paying" || undefined}
                >
                  {shown === "paying" ? "Paying…" : `Pay $${total}`}
                </button>
              </>
            )}
          </div>

          <div className="fk-py-inbox">
            <span className="fk-py-h">Responses</span>
            {shown === "form" ? (
              <div className="fk-py-empty">Their answers land here, saved before checkout.</div>
            ) : (
            <div className="fk-py-resp">
              <span className="fk-rp-av" aria-hidden>
                AK
              </span>
              <span>
                <b>Alex Kim</b>
                <em>
                  {places} places{lunch ? ", lunch" : ""}
                </em>
              </span>
              <span className="fk-py-status" data-status={status}>
                {status}
              </span>
            </div>
            )}
          </div>
        </div>
      </div>
    </SceneFrame>
  );
}
