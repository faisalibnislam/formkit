"use client";

import { Ticks } from "./Ticks";
import { LOGIC_LINES, PATH_ROWS, RESPONDENT_QS, SHAPE_LABELS } from "@/content/landing";

/**
 * SHAPE. A pinned scene in five scroll steps: the condition is added, the path
 * divides, a question drops out, eleven becomes eight, the paths merge.
 *
 * The measurement is the app's own tick-row language rather than a hand-drawn
 * branch diagram.
 */
export function ShapeScene() {
  return (
    <section
      id="shape"
      data-scene="shape"
      data-nav-hide
      style={{ position: "relative", height: "280vh" }}
    >
      <div
        className="fk-shell"
        style={{ background: "#ffffff", display: "flex", flexDirection: "column" }}
      >
        <div className="fk-shape-grid">
          <div
            style={{
              minWidth: 0,
              minHeight: 0,
              overflow: "hidden",
              padding: "clamp(8px,1.4vh,26px) clamp(20px,3vw,40px)",
              borderRight: "1px solid var(--neutral-200)",
              display: "flex",
              flexDirection: "column",
              gap: "clamp(4px,.8vh,9px)",
            }}
          >
            <div style={{ flex: "0 0 auto", fontSize: 11, color: "var(--color-text-tertiary)" }}>
              Logic · Client onboarding
            </div>

            {LOGIC_LINES.map((l) => (
              <div key={l.k} className="fk-logicline">
                <span style={{ width: 34, fontSize: 11, color: "var(--color-text-tertiary)" }}>
                  {l.k}
                </span>
                <span
                  style={{
                    flex: 1,
                    minWidth: 0,
                    fontSize: "clamp(12.5px,1.6vh,14.5px)",
                    color: "var(--neutral-900)",
                  }}
                >
                  {l.v}
                </span>
              </div>
            ))}

            <div
              style={{
                flex: "1 1 auto",
                minHeight: 0,
                display: "flex",
                flexDirection: "column",
                gap: "clamp(8px,1.6vh,16px)",
                marginTop: "clamp(4px,1vh,10px)",
              }}
            >
              {PATH_ROWS.map((b, i) => (
                <div
                  key={b.pct}
                  data-branchrow={i}
                  style={{
                    paddingTop: "clamp(9px,2.2vh,32px)",
                    opacity: 0,
                    transition: "opacity .45s ease",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "baseline", gap: 9 }}>
                    <span
                      style={{
                        fontSize: "clamp(13px,1.8vh,22px)",
                        fontWeight: 300,
                        letterSpacing: "-.02em",
                        color: "var(--neutral-900)",
                      }}
                    >
                      {b.pct}
                    </span>
                    <span style={{ fontSize: 12.5, color: "var(--color-text-tertiary)" }}>
                      {b.label}
                    </span>
                    <span style={{ flex: 1 }} />
                    <span style={{ fontSize: 12, color: "var(--color-text-tertiary)" }}>
                      {b.count}
                    </span>
                  </div>
                  <div style={{ marginTop: "clamp(4px,1vh,16px)" }}>
                    <Ticks
                      total={b.total}
                      filled={b.filled}
                      fill={b.fill}
                      short
                      height="clamp(36px,10.5vh,150px)"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div
            style={{
              minWidth: 0,
              minHeight: 0,
              overflow: "hidden",
              padding: "clamp(16px,2.4vh,34px) clamp(20px,3vw,40px)",
              display: "flex",
              flexDirection: "column",
              gap: "clamp(7px,1.2vh,12px)",
              background: "var(--neutral-50)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                fontSize: 12,
                color: "var(--color-text-tertiary)",
              }}
            >
              <span>What Maya sees</span>
              <span
                style={{
                  flex: 1,
                  height: 3,
                  borderRadius: 3,
                  background: "var(--neutral-200)",
                  overflow: "hidden",
                }}
              >
                <span
                  data-shapeprogress
                  style={{
                    display: "block",
                    height: "100%",
                    width: "18%",
                    background: "var(--blue-500)",
                    transition: "width .5s cubic-bezier(.22,.8,.24,1)",
                  }}
                />
              </span>
              <span data-shapecount>11 questions</span>
            </div>

            {RESPONDENT_QS.map((q, i) => (
              <div key={q} className="fk-respq">
                <span
                  data-respdot={i}
                  style={{
                    width: 7,
                    height: 7,
                    flex: "0 0 auto",
                    borderRadius: "50%",
                    background: "var(--neutral-300)",
                  }}
                />
                <span
                  style={{ flex: 1, minWidth: 0, fontSize: 14.5, color: "var(--neutral-900)" }}
                >
                  {q}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div
          className="fk-plate"
          style={{
            flex: "0 0 auto",
            flexDirection: "row",
            alignItems: "flex-end",
            justifyContent: "space-between",
            gap: 20,
            flexWrap: "wrap",
            padding: "clamp(22px,3.6vh,40px) clamp(20px,4vw,46px)",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <span className="fk-plate-eyebrow">SHAPE</span>
            <h2 style={{ whiteSpace: "nowrap" }}>People only answer what applies to them.</h2>
            <p>
              One rule per line. Clients you have worked with before skip three questions you
              already know the answers to. Everyone else answers all eleven.
            </p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {SHAPE_LABELS.map((label, i) => (
              <span
                key={label}
                data-shapedot={i}
                style={{
                  width: 26,
                  height: 2,
                  background: "rgba(255,255,255,.25)",
                  transition: "background .3s ease",
                }}
              />
            ))}
            <span
              data-shapelabel
              style={{ minWidth: "16ch", fontSize: 12.5, color: "rgba(255,255,255,.7)" }}
            >
              {SHAPE_LABELS[0]}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
