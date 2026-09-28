"use client";

import Link from "next/link";
import { ArrowRight, Check, ChevronDown, Eye, Paperclip, Rocket, Star } from "lucide-react";
import { NightSky } from "@/components/brand/NightSky";
import { Glyph } from "@/components/brand/Glyph";
import {
  EDITOR_TABS,
  FIELD_GROUPS,
  FIELD_ICONS,
  FLOATIES,
  HERO_ROWS,
  PAGES_PANEL,
} from "@/content/landing";

/**
 * ASK. The headline scales away, the sky hands off to the workspace, and the
 * Formkit builder assembles around the caption plate that lands first.
 *
 * The builder is a real 1660×760 app frame scaled to the pinned shell, so it is
 * the app's own layout rather than an approximation of it.
 */
export function HeroScene() {
  return (
    <section id="ask" data-scene="hero" data-nav-hide style={{ position: "relative", height: "280vh" }}>
      <div className="fk-shell fk-hero-stage">
        <NightSky />
        <div className="fk-hero-paper" aria-hidden />

        <div className="fk-hero-marketing">
          <p className="fk-hero-eyebrow">
            <span>Form builder</span>
            <span style={{ opacity: 0.82 }}>
              Build forms, add logic, read the responses. Free.
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
            Design the questions. Branch the journey. Read what comes back.
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
            <a href="#shape" className="fk-ghost-pill" style={{ height: 54, padding: "0 24px" }}>
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

        <div className="fk-hero-progressline" aria-hidden />

        <BuilderFrame />

        <div
          className="fk-plate fk-hero-plate"
          style={{ position: "absolute", left: 0, right: 0, bottom: 0, opacity: 0 }}
        >
          <div>
            <span className="fk-plate-eyebrow">ASK</span>
            <h2 style={{ whiteSpace: "nowrap" }}>Start with what you need to know.</h2>
          </div>
          <p>
            Eleven questions, written once. Each answer type decides what the respondent sees.
            Drag to reorder, split into pages, publish when it reads right.
          </p>
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

/** The app frame: header, editor tabs, field library, canvas, right column. */
function BuilderFrame() {
  return (
    <div className="fk-builder" aria-hidden>
      <div
        data-bpart="top"
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 0,
          height: 132,
          display: "flex",
          flexDirection: "column",
          opacity: 0,
          transform: "translateY(-100%)",
        }}
      >
        <div
          style={{ display: "flex", alignItems: "center", gap: 12, height: 64, padding: "0 26px" }}
        >
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 30,
              height: 30,
              borderRadius: "50%",
              background: "var(--neutral-900)",
              color: "var(--neutral-0)",
            }}
          >
            <Glyph name="layout-template" size={16} />
          </span>
          <span
            style={{
              fontSize: 17,
              fontWeight: 500,
              letterSpacing: "-.01em",
              color: "var(--neutral-900)",
            }}
          >
            Client onboarding
          </span>
          <span
            data-herostatus
            style={{
              display: "inline-flex",
              alignItems: "center",
              height: 24,
              padding: "0 11px",
              borderRadius: "var(--radius-pill)",
              background: "var(--neutral-100)",
              color: "var(--neutral-600)",
              fontSize: 12.5,
            }}
          >
            Untitled
          </span>
          <span style={{ flex: 1 }} />
          <span style={{ fontSize: 13, color: "var(--color-text-tertiary)" }}>Saved just now</span>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 38,
              height: 38,
              borderRadius: "50%",
              background: "var(--neutral-0)",
              color: "var(--neutral-700)",
              boxShadow: "var(--shadow-sm)",
            }}
          >
            <Eye size={17} strokeWidth={1.8} aria-hidden />
          </span>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 9,
              height: 40,
              padding: "0 18px",
              borderRadius: "var(--radius-pill)",
              background: "var(--neutral-900)",
              color: "var(--neutral-0)",
              fontSize: 14.5,
            }}
          >
            <Rocket size={15} strokeWidth={1.8} aria-hidden />
            Publish
          </span>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            height: 68,
            padding: "0 26px 12px",
          }}
        >
          {EDITOR_TABS.map((t) => (
            <span key={t.label} className="fk-btab" data-on={!!t.on}>
              <span>
                <Glyph name={t.icon} size={17} />
              </span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span
                  style={{
                    display: "block",
                    fontSize: 14.5,
                    fontWeight: 500,
                    lineHeight: 1.25,
                    color: "var(--neutral-900)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {t.label}
                </span>
                <span
                  style={{
                    display: "block",
                    fontSize: 12,
                    lineHeight: 1.3,
                    color: "var(--color-text-tertiary)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {t.note}
                </span>
              </span>
            </span>
          ))}
        </div>
      </div>

      <div
        data-bpart="left"
        style={{
          position: "absolute",
          left: 0,
          top: 132,
          bottom: 0,
          width: 300,
          padding: "20px 20px 20px 26px",
          opacity: 0,
          transform: "translateX(-100%)",
        }}
      >
        <div
          className="fk-bpanel"
          style={{ height: "100%", overflow: "hidden", padding: "20px 16px" }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 9,
              height: 40,
              padding: "0 14px",
              borderRadius: "var(--radius-pill)",
              background: "var(--neutral-100)",
              color: "var(--color-text-tertiary)",
              fontSize: 13.5,
            }}
          >
            <Glyph name="compass" size={15} />
            Search fields
          </div>
          <div
            style={{
              padding: "16px 4px 10px",
              fontSize: 13.5,
              color: "var(--color-text-tertiary)",
            }}
          >
            Drag a field in, or click to add
          </div>
          {FIELD_GROUPS.map((g) => (
            <div key={g.group} style={{ marginBottom: 14 }}>
              <div
                style={{
                  padding: "0 4px 6px",
                  fontSize: 13.5,
                  color: "var(--color-text-tertiary)",
                }}
              >
                {g.group}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                {g.items.map((item) => (
                  <span
                    key={item}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      height: 42,
                      padding: "0 12px",
                      borderRadius: 12,
                      background: "var(--neutral-50)",
                      fontSize: 14,
                      color: "var(--neutral-800)",
                    }}
                  >
                    <Glyph name={FIELD_ICONS[item] ?? "type"} size={15} />
                    {item}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div
        data-bpart="rows"
        style={{
          position: "absolute",
          left: 300,
          right: 340,
          top: 132,
          bottom: 0,
          padding: "20px 26px",
          display: "flex",
          flexDirection: "column",
          gap: 14,
          overflow: "hidden",
          borderRadius: 24,
          opacity: 0,
          transform: "translateY(24px)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "14px 20px",
            borderRadius: "var(--radius-card)",
            background: "var(--neutral-0)",
            boxShadow: "var(--shadow-card)",
          }}
        >
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 30,
              height: 30,
              borderRadius: "50%",
              background: "var(--neutral-900)",
              color: "var(--neutral-0)",
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            01
          </span>
          <span
            style={{ flex: 1, minWidth: 0, fontSize: 16, fontWeight: 500, color: "var(--neutral-900)" }}
          >
            About you
          </span>
          <span style={{ fontSize: 12.5, color: "var(--color-text-tertiary)" }}>Page break</span>
        </div>

        {HERO_ROWS.map((r) => (
          <div key={r.no} className="fk-qcard" data-selected={!!r.selected}>
            <span
              style={{
                flex: "0 0 auto",
                width: 24,
                fontSize: 12.5,
                color: "var(--color-text-tertiary)",
                paddingTop: 3,
              }}
            >
              {r.no}
            </span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span
                style={{
                  display: "block",
                  fontSize: 12,
                  color: "var(--color-text-tertiary)",
                }}
              >
                {r.type}
              </span>
              <span
                style={{
                  display: "block",
                  marginTop: 4,
                  fontSize: 16,
                  fontWeight: 500,
                  color: "var(--neutral-900)",
                }}
              >
                {r.q}
                {r.required && <span style={{ color: "var(--red-600)" }}>*</span>}
              </span>
              <span
                style={{
                  display: "flex",
                  alignItems: "center",
                  height: 44,
                  marginTop: 12,
                  padding: "0 15px",
                  borderRadius: "var(--radius-control)",
                  background: "var(--neutral-0)",
                  boxShadow: "inset 0 0 0 1px var(--neutral-200)",
                  fontSize: 14,
                  color: "var(--color-text-tertiary)",
                }}
              >
                {r.placeholder}
              </span>
            </span>
          </div>
        ))}
      </div>

      <div
        data-bpart="right"
        style={{
          position: "absolute",
          right: 0,
          top: 132,
          bottom: 0,
          width: 340,
          padding: "20px 26px 20px 20px",
          opacity: 0,
          transform: "translateX(100%)",
        }}
      >
        <div className="fk-bpanel" style={{ padding: "20px 18px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 16, fontWeight: 500, color: "var(--neutral-900)" }}>Pages</span>
            <span style={{ fontSize: 13, color: "var(--color-text-tertiary)" }}>3 pages</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 5, marginTop: 14 }}>
            {PAGES_PANEL.map((pg, i) => (
              <span
                key={pg.no}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 9,
                  padding: "8px 10px",
                  borderRadius: 9,
                  fontSize: 12.5,
                  color: "var(--neutral-900)",
                  background: i === 1 ? "var(--blue-50)" : "var(--neutral-50)",
                }}
              >
                <span style={{ color: "var(--color-text-tertiary)" }}>{pg.no}</span>
                <span
                  style={{
                    flex: 1,
                    minWidth: 0,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {pg.name}
                </span>
                <span style={{ color: "var(--color-text-tertiary)" }}>{pg.count}</span>
              </span>
            ))}
          </div>
        </div>

        <div className="fk-bpanel" style={{ marginTop: 16, padding: "20px 18px" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 14,
            }}
          >
            <span style={{ fontSize: 16, fontWeight: 500, color: "var(--neutral-900)" }}>
              Field settings
            </span>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                height: 24,
                padding: "0 10px",
                borderRadius: "var(--radius-pill)",
                background: "var(--neutral-100)",
                fontSize: 12.5,
                color: "var(--neutral-700)",
              }}
            >
              Email
            </span>
          </div>
          <FakeField label="Question" value="Where should we send the proposal?" />
          <FakeField label="Placeholder" value="you@company.com" />
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginTop: 18,
            }}
          >
            <span style={{ fontSize: 14.5, color: "var(--neutral-800)" }}>Required</span>
            <span
              style={{
                position: "relative",
                width: 44,
                height: 26,
                borderRadius: 999,
                background: "var(--neutral-900)",
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
          </div>
        </div>
      </div>
    </div>
  );
}

function FakeField({ label, value }: { label: string; value: string }) {
  return (
    <>
      <div
        style={{
          margin: "14px 0 7px",
          fontSize: 13.5,
          color: "var(--color-text-tertiary)",
        }}
      >
        {label}
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          height: 42,
          padding: "0 14px",
          borderRadius: "var(--radius-control)",
          background: "var(--neutral-0)",
          boxShadow: "inset 0 0 0 1px var(--neutral-200)",
          fontSize: 14,
          color: "var(--neutral-800)",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {value}
      </div>
    </>
  );
}
