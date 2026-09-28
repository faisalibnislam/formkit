import {
  ArrowDownRight,
  ArrowUpRight,
  ChartPie,
  CircleCheck,
  Eye,
  FileSpreadsheet,
  FileText,
  MousePointerClick,
  Timer,
} from "lucide-react";
import { Ticks } from "./Ticks";
import { FUNNEL, RANGES, STAT_CARDS, WEEK_BARS } from "@/content/landing";

/** The analytics screen, rebuilt from the app's own. */
const STAT_ICONS: Record<string, typeof Eye> = {
  eye: Eye,
  "mouse-pointer-click": MousePointerClick,
  "circle-check": CircleCheck,
  "chart-pie": ChartPie,
  timer: Timer,
};

export function AnalyticsScene() {
  const peak = Math.max(...WEEK_BARS);

  return (
    <section
      id="analytics"
      style={{
        position: "relative",
        background: "var(--blue-50)",
        padding: "clamp(56px,7vw,100px) clamp(24px,7vw,110px)",
      }}
    >
      <div>
        <span style={{ fontSize: 11.5, letterSpacing: ".16em", color: "var(--blue-700)" }}>
          ANALYTICS
        </span>
        <h2
          style={{
            margin: "14px 0 0",
            maxWidth: "24ch",
            fontSize: "clamp(26px,4vw,52px)",
            fontWeight: 700,
            letterSpacing: "-.035em",
            lineHeight: 1.02,
          }}
        >
          See where people give up, not just who finished.
        </h2>
        <p
          style={{
            margin: "14px 0 0",
            maxWidth: "62ch",
            fontSize: 15.5,
            lineHeight: 1.6,
            color: "var(--neutral-600)",
          }}
        >
          How many looked, how many started, how many finished, how long it took, and the question
          they quit on.
        </p>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
          marginTop: "clamp(28px,4vw,46px)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 2,
            padding: 4,
            borderRadius: "var(--radius-pill)",
            background: "var(--neutral-100)",
          }}
        >
          {RANGES.map((label) => {
            const on = label === "30 days";
            return (
              <span
                key={label}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  height: 34,
                  padding: "0 15px",
                  borderRadius: "var(--radius-pill)",
                  fontSize: 13.5,
                  background: on ? "var(--neutral-0)" : undefined,
                  color: on ? "var(--neutral-900)" : "var(--neutral-600)",
                  boxShadow: on ? "var(--shadow-sm)" : undefined,
                }}
              >
                {label}
              </span>
            );
          })}
        </div>
        <span style={{ fontSize: 13.5, color: "var(--color-text-tertiary)" }}>
          Last 30 days, to today.
        </span>
        <span style={{ flex: 1 }} />
        <ExportPill icon={<FileSpreadsheet size={15} strokeWidth={1.8} aria-hidden />}>
          Export Excel
        </ExportPill>
        <ExportPill icon={<FileText size={15} strokeWidth={1.8} aria-hidden />}>
          Export CSV
        </ExportPill>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(min(190px,100%),1fr))",
          gap: 14,
          marginTop: 16,
        }}
      >
        {STAT_CARDS.map((s) => {
          const dark = s.tone === "dark";
          const blue = s.tone === "blue";
          const Icon = STAT_ICONS[s.icon] ?? Eye;
          const labelInk = dark ? "rgba(255,255,255,.62)" : "var(--neutral-700)";
          return (
            <div
              key={s.label}
              style={{
                padding: "clamp(18px,2.2vw,26px)",
                borderRadius: "var(--radius-card)",
                boxShadow: "var(--shadow-card)",
                background: dark
                  ? "var(--neutral-950)"
                  : blue
                    ? "var(--blue-300)"
                    : "var(--neutral-0)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 9,
                  fontSize: 13.5,
                  color: labelInk,
                }}
              >
                <Icon size={15} strokeWidth={1.8} aria-hidden />
                {s.label}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 11, marginTop: 12 }}>
                <span
                  style={{
                    fontSize: "clamp(26px,3vw,38px)",
                    fontWeight: 300,
                    letterSpacing: "-.03em",
                    color: dark ? "var(--neutral-0)" : "var(--neutral-900)",
                  }}
                >
                  <span
                    data-count={s.count}
                    data-dec={s.dec ? "1" : undefined}
                    data-suffix={s.suffix || undefined}
                  >
                    0
                  </span>
                </span>
                {/* Colour never lands on the numeral - the state rides in the disc. */}
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: 22,
                    height: 22,
                    flex: "0 0 auto",
                    borderRadius: "50%",
                    background: s.up ? "var(--green-400)" : "var(--red-400)",
                    color: "var(--neutral-900)",
                  }}
                >
                  {s.up ? (
                    <ArrowUpRight size={13} strokeWidth={2} aria-hidden />
                  ) : (
                    <ArrowDownRight size={13} strokeWidth={2} aria-hidden />
                  )}
                </span>
                <span style={{ fontSize: 13, color: labelInk }}>{s.delta}</span>
              </div>
            </div>
          );
        })}
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(min(340px,100%),1fr))",
          gap: 18,
          marginTop: 18,
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            padding: "clamp(20px,2.6vw,30px) clamp(20px,2.6vw,30px) 0",
            borderRadius: "var(--radius-card)",
            background: "var(--neutral-0)",
            boxShadow: "var(--shadow-card)",
            overflow: "hidden",
          }}
        >
          <div style={{ fontSize: 17, fontWeight: 500, letterSpacing: "-.01em" }}>
            Responses over time
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "flex-end",
              gap: "clamp(6px,1.4vw,16px)",
              height: "clamp(300px,36vw,430px)",
              marginTop: 26,
            }}
          >
            {WEEK_BARS.map((v, i) => (
              <span
                key={i}
                style={{
                  flex: 1,
                  minWidth: 0,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "flex-end",
                  gap: 8,
                  height: "100%",
                }}
              >
                <span style={{ fontSize: 12, color: "var(--neutral-600)" }}>{v}</span>
                <span
                  data-tickh={Math.round((v / peak) * 100)}
                  style={{
                    width: "clamp(7px,1.1vw,13px)",
                    height: 0,
                    borderRadius: "var(--radius-pill)",
                    background:
                      i === WEEK_BARS.length - 1 ? "var(--yellow-400)" : "var(--green-400)",
                    transition: "height .6s cubic-bezier(.22,.8,.24,1)",
                  }}
                />
                <span style={{ fontSize: 11.5, color: "var(--color-text-tertiary)" }}>
                  W{i + 1}
                </span>
              </span>
            ))}
          </div>
        </div>

        <div
          style={{
            padding: "clamp(20px,2.6vw,30px)",
            borderRadius: "var(--radius-card)",
            background: "var(--neutral-0)",
            boxShadow: "var(--shadow-card)",
          }}
        >
          <div style={{ fontSize: 17, fontWeight: 500, letterSpacing: "-.01em" }}>
            Completion funnel
          </div>
          <div
            style={{ display: "flex", flexDirection: "column", gap: 20, marginTop: 22 }}
          >
            {FUNNEL.map((f) => (
              <div key={f.label}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
                  <span
                    style={{
                      fontSize: "clamp(22px,2.4vw,30px)",
                      fontWeight: 300,
                      letterSpacing: "-.03em",
                    }}
                  >
                    {f.pct}
                  </span>
                  <span style={{ fontSize: 14, color: "var(--neutral-700)" }}>{f.label}</span>
                </div>
                <div style={{ marginTop: 11 }}>
                  <Ticks total={f.total} filled={f.filled} fill={f.fill} height={34} />
                </div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginTop: 7,
                    fontSize: 11.5,
                    color: "var(--color-text-tertiary)",
                  }}
                >
                  <span>{f.count}</span>
                  <span>{f.pct}</span>
                </div>
              </div>
            ))}
          </div>
          <p
            style={{
              margin: "20px 0 0",
              fontSize: 14,
              lineHeight: 1.55,
              color: "var(--neutral-700)",
            }}
          >
            34% of people who open this form never start it. Most of them leave on a phone.
          </p>
        </div>
      </div>
    </section>
  );
}

function ExportPill({
  icon,
  children,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        height: 40,
        padding: "0 16px",
        borderRadius: "var(--radius-pill)",
        background: "var(--neutral-0)",
        boxShadow: "var(--shadow-card)",
        fontSize: 13.5,
      }}
    >
      {icon}
      {children}
    </span>
  );
}
