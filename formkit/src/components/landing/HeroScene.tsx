"use client";

import Link from "next/link";
import { ArrowRight, Check, ChevronDown, Paperclip, Star } from "lucide-react";
import { NightSky } from "@/components/brand/NightSky";
import { FLOATIES } from "@/content/landing";

/**
 * The hero: the headline in the night sky, with small form pieces floating
 * around it that lean in 3D with the pointer (scrollEngine.floaties).
 */
export function HeroScene() {
  return (
    <section id="ask" data-scene="hero" data-nav-hide style={{ position: "relative", height: "100vh" }}>
      <div className="fk-shell fk-hero-stage">
        <NightSky />
        <div className="fk-hero-paper" aria-hidden />

        <div className="fk-hero-marketing">
          <p className="fk-hero-eyebrow">
            <span>Form builder</span>
            <span style={{ opacity: 0.82 }}>
              Build with AI, add logic, act on every answer. Free to start.
            </span>
          </p>

          <h1 className="fk-hero-head">
            What will your next{" "}
            <span className="fk-hero-pill" data-float="16">
              <span>
                <Check size={20} strokeWidth={2.4} aria-hidden />
              </span>
              form
            </span>{" "}
            <span style={{ display: "inline-block", verticalAlign: "middle" }}>do?</span>
          </h1>

          <p className="fk-hero-sub">
            Describe it and Formkit builds it. Branch the journey. Answer every response.
          </p>

          <div className="fk-hero-cta">
            <Link
              href="/signup"
              className="fk-pill fk-pill-light"
              style={{ height: 54, padding: "0 26px", fontSize: 16 }}
            >
              Build a form
              <ArrowRight size={18} strokeWidth={1.8} aria-hidden />
            </Link>
            <a href="#product" className="fk-ghost-pill" style={{ height: 54, padding: "0 24px" }}>
              Explore Formkit
            </a>
          </div>
        </div>

        <div className="fk-floaties" aria-hidden>
          {FLOATIES.map((f) => (
            <span key={f.kind} className="fk-floaty" data-float={f.depth} style={f.pos}>
              <FloatyContents kind={f.kind} />
            </span>
          ))}
        </div>

        <div className="fk-hero-cue">
          <span>Scroll down</span>
          <span>
            <ChevronDown size={30} strokeWidth={1.8} aria-hidden />
          </span>
        </div>

      </div>
    </section>
  );
}

function FloatyContents({ kind }: { kind: (typeof FLOATIES)[number]["kind"] }) {
  const bar = (width: number, alpha: number) => (
    <span
      style={{
        width,
        height: 8,
        borderRadius: 8,
        background: `rgba(255,255,255,${alpha})`,
      }}
    />
  );

  switch (kind) {
    case "check":
      return (
        <>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 22,
              height: 22,
              borderRadius: 7,
              background: "var(--green-400)",
              color: "var(--neutral-900)",
            }}
          >
            <Check size={15} strokeWidth={2.4} aria-hidden />
          </span>
          {bar(54, 0.4)}
        </>
      );
    case "toggle":
      return (
        <span
          style={{
            position: "relative",
            width: 46,
            height: 26,
            borderRadius: 999,
            background: "var(--blue-400)",
          }}
        >
          <span
            style={{
              position: "absolute",
              top: 3,
              right: 3,
              width: 20,
              height: 20,
              borderRadius: "50%",
              background: "#ffffff",
            }}
          />
        </span>
      );
    case "radio":
      return (
        <>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 22,
              height: 22,
              borderRadius: "50%",
              boxShadow: "inset 0 0 0 2px rgba(255,255,255,.7)",
            }}
          >
            <span
              style={{ width: 10, height: 10, borderRadius: "50%", background: "#ffffff" }}
            />
          </span>
          {bar(44, 0.4)}
        </>
      );
    case "stars":
      return (
        <span style={{ display: "inline-flex", gap: 5, color: "var(--yellow-300)" }}>
          <Star size={17} strokeWidth={1.8} aria-hidden />
          <Star size={17} strokeWidth={1.8} aria-hidden />
          <Star size={17} strokeWidth={1.8} aria-hidden />
        </span>
      );
    case "field":
      return (
        <>
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: "rgba(255,255,255,.55)",
            }}
          />
          <span
            style={{
              width: 86,
              height: 9,
              borderRadius: 9,
              background: "rgba(255,255,255,.35)",
            }}
          />
        </>
      );
    case "upload":
      return (
        <>
          <span style={{ display: "inline-flex", color: "rgba(255,255,255,.8)" }}>
            <Paperclip size={16} strokeWidth={1.8} aria-hidden />
          </span>
          {bar(60, 0.35)}
        </>
      );
  }
}
