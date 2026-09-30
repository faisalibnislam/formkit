"use client";

import { ArrowLeft, ArrowRight } from "lucide-react";
import { Glyph } from "@/components/brand/Glyph";
import { FEATURES } from "@/content/landing";

/**
 * A pinned horizontal scene: the feature cards ride a track driven by vertical
 * scroll, with a counter, arrows and a progress bar. Below 820px the track
 * wraps into an ordinary grid and the controls are hidden.
 */
export function FeaturesScene({ onStep }: { onStep: (direction: -1 | 1) => void }) {
  return (
    <section
      id="features"
      data-scene="features"
      data-nav-hide
      style={{ position: "relative", height: "300vh", color: "var(--neutral-0)" }}
    >
      <div
        className="fk-shell"
        style={{
          background: "var(--neutral-950)",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "space-between",
            gap: 20,
            flexWrap: "wrap",
            padding: "clamp(48px,7vh,88px) clamp(24px,7vw,110px) 0",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <span className="fk-plate-eyebrow">EVERYTHING IN FORMKIT</span>
            <h2
              style={{
                margin: 0,
                maxWidth: "26ch",
                fontSize: "clamp(20px,2.8vw,40px)",
                fontWeight: 700,
                letterSpacing: "-.03em",
                lineHeight: 1.04,
                color: "var(--neutral-0)",
              }}
            >
              Everything from the first question to the spreadsheet.
            </h2>
            <p
              style={{
                margin: 0,
                maxWidth: "56ch",
                fontSize: 14,
                lineHeight: 1.5,
                color: "rgba(255,255,255,.7)",
              }}
            >
              {FEATURES.length} things Formkit does, and which plan has each. Free
              is the whole form builder; Pro adds AI on your responses and your own brand.
            </p>
          </div>

          <div className="fk-fnav" style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span
              data-fcount
              style={{
                fontSize: 11.5,
                letterSpacing: ".08em",
                color: "rgba(255,255,255,.55)",
              }}
            >
              01 / {FEATURES.length}
            </span>
            <button
              type="button"
              className="fk-round-btn"
              style={{ marginLeft: 8 }}
              aria-label="Previous features"
              onClick={() => onStep(-1)}
            >
              <ArrowLeft size={15} strokeWidth={1.8} aria-hidden />
            </button>
            <button
              type="button"
              className="fk-round-btn"
              aria-label="More features"
              onClick={() => onStep(1)}
            >
              <ArrowRight size={15} strokeWidth={1.8} aria-hidden />
            </button>
          </div>
        </div>

        <div
          style={{
            flex: 1,
            minHeight: 0,
            display: "flex",
            alignItems: "center",
            overflow: "hidden",
          }}
        >
          <div className="fk-ftrack" data-ftrack>
            {FEATURES.map((f) => (
              <div key={f.title} className="fk-fcard">
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: 44,
                    height: 44,
                    flex: "0 0 auto",
                    borderRadius: 14,
                    background: f.bg,
                    color: "var(--neutral-900)",
                  }}
                >
                  <Glyph name={f.icon} size={20} />
                </span>
                <h3
                  style={{
                    margin: "20px 0 0",
                    fontSize: 19,
                    fontWeight: 600,
                    letterSpacing: "-.015em",
                    color: "var(--neutral-0)",
                  }}
                >
                  {f.title}
                </h3>
                <p
                  style={{
                    margin: "9px 0 0",
                    fontSize: 14,
                    lineHeight: 1.55,
                    color: "rgba(255,255,255,.66)",
                  }}
                >
                  {f.body}
                </p>
                <span style={{ flex: 1 }} />
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    alignSelf: "flex-start",
                    height: 28,
                    padding: "0 12px",
                    marginTop: 20,
                    borderRadius: "var(--radius-pill)",
                    background: "rgba(255,255,255,.1)",
                    fontSize: 12.5,
                    color: "rgba(255,255,255,.8)",
                  }}
                >
                  {f.chip}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div
          className="fk-fbar"
          style={{ padding: "0 clamp(24px,7vw,110px) clamp(40px,6vh,64px)" }}
        >
          <span style={{ display: "block", height: 2, background: "rgba(255,255,255,.16)" }}>
            <span
              data-fbar
              style={{ display: "block", height: "100%", width: 0, background: "var(--blue-300)" }}
            />
          </span>
        </div>
      </div>
    </section>
  );
}
