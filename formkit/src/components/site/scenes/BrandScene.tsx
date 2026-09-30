"use client";

import { useRef, useState } from "react";
import { Lock } from "lucide-react";
import { THEME_PRESETS } from "../../../../convex/model/themePresets";
import { Chips, SceneFrame, useInView, useReducedMotion, useStep, type SceneProps } from "./shared";

/**
 * The same form in each of Formkit's ten themes, in sans or serif, on a
 * formkit.app link or on the company's own domain (Pro, which also drops
 * the badge).
 */

const FONTS = {
  sans: "var(--font-sans)",
  serif: 'Georgia, "Times New Roman", serif',
};

export function BrandScene({ compact }: SceneProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const seen = useInView(ref);
  const still = useReducedMotion();
  const [theme, setTheme] = useState(1);
  const [font, setFont] = useState<"sans" | "serif">("sans");
  const [domain, setDomain] = useState(false);
  const [touched, setTouched] = useState(false);
  const t = THEME_PRESETS[theme]!;
  const live = seen && !still;

  // Until someone picks a theme, the themes go by on their own.
  useStep(live && !touched, compact ? 1800 : 2400, () => {
    const next = (theme + 1) % THEME_PRESETS.length;
    setTheme(next);
    if (next % 3 === 0) setDomain(!domain);
  }, [theme]);

  const dark = t.text === "#ffffff";
  const url = domain ? "forms.northstar.studio/intake" : "formkit.app/northstar/intake";

  return (
    <SceneFrame
      innerRef={ref}
      compact={compact}
      title="Design · Branding"
      label={`The same form in the ${t.name} theme, at ${url}.`}
    >
      <div className="fk-br">
        <div className="fk-br-url" data-own={domain || undefined}>
          <Lock size={12} strokeWidth={2.2} aria-hidden />
          <span key={url}>{url}</span>
          {domain && <em>Pro</em>}
        </div>

        <div
          className="fk-br-page"
          style={{
            background: t.bg,
            color: t.text,
            fontFamily: FONTS[font],
          }}
        >
          <div className="fk-br-card" style={{ background: t.surface, borderRadius: t.radius * 0.7 }}>
            <span className="fk-br-logo" style={{ color: dark ? "#ffffff" : t.primary }}>
              <i style={{ background: dark ? "#ffffff" : t.primary }} /> Northstar
            </span>
            <b className="fk-br-title">Tell us about your project</b>
            <span className="fk-br-label">Your name</span>
            <span
              className="fk-br-input"
              style={{
                borderRadius: Math.min(14, t.radius * 0.5),
                background: dark ? "rgba(255,255,255,0.08)" : "#ffffff",
                borderColor: dark ? "rgba(255,255,255,0.18)" : "rgba(33,40,46,0.14)",
              }}
            >
              Priya Shah
            </span>
            <span className="fk-br-label">What do you need?</span>
            <span className="fk-br-opts">
              {["Website", "Branding", "Both"].map((o, i) => (
                <span
                  key={o}
                  style={{
                    borderRadius: 999,
                    background: i === 0 ? t.primary : "transparent",
                    color: i === 0 ? (dark ? "#21282E" : "#ffffff") : "inherit",
                    borderColor: dark ? "rgba(255,255,255,0.22)" : "rgba(33,40,46,0.16)",
                  }}
                >
                  {o}
                </span>
              ))}
            </span>
            <span
              className="fk-br-btn"
              style={{
                background: t.primary,
                color: dark ? "#21282E" : "#ffffff",
                borderRadius: t.radius >= 20 ? 999 : Math.max(6, t.radius * 0.6),
              }}
            >
              Continue
            </span>
          </div>
          <span className="fk-br-badge" data-hide={domain || undefined} style={{ color: t.text }}>
            Made with Formkit
          </span>
        </div>

        {!compact && (
          <div className="fk-br-controls">
            <div className="fk-br-swatches" role="radiogroup" aria-label="Theme">
              {THEME_PRESETS.map((p, i) => (
                <button
                  key={p.id}
                  type="button"
                  role="radio"
                  aria-checked={i === theme}
                  aria-label={p.name}
                  title={p.name}
                  onClick={() => {
                    setTouched(true);
                    setTheme(i);
                  }}
                  style={{ background: `linear-gradient(135deg, ${p.bg} 0 55%, ${p.primary} 55% 100%)` }}
                />
              ))}
              <span className="fk-br-name">{t.name}</span>
            </div>
            <div className="fk-br-row">
              <Chips
                label="Font"
                value={font}
                onChange={(v) => {
                  setTouched(true);
                  setFont(v);
                }}
                options={[
                  { value: "sans", label: "Sans" },
                  { value: "serif", label: "Serif" },
                ]}
              />
              <label className="fk-br-toggle">
                <input
                  type="checkbox"
                  checked={domain}
                  onChange={(e) => {
                    setTouched(true);
                    setDomain(e.target.checked);
                  }}
                />
                <i aria-hidden />
                Own domain
              </label>
            </div>
          </div>
        )}
      </div>
    </SceneFrame>
  );
}
