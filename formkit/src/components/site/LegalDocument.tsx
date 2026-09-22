import { NightSky } from "@/components/brand/NightSky";
import { PublicPage } from "@/components/site/PublicPage";
import type { LegalSection } from "@/content/legal";

/**
 * The shared shell for the privacy policy and the terms: a Night Sky hero, a
 * sticky on-this-page nav, and the document body.
 */
export function LegalDocument({
  title,
  intro,
  updated,
  sections,
  foot,
}: {
  title: string;
  intro: string;
  updated: string;
  sections: LegalSection[];
  foot: string;
}) {
  return (
    <PublicPage>
      <section
        className="fk-hero"
        style={{
          padding:
            "calc(104px + clamp(20px,4vw,44px)) clamp(20px,5vw,56px) clamp(52px,6vw,72px)",
        }}
      >
        <NightSky />
        <div
          className="fk-hero-inner"
          style={{ maxWidth: 940, margin: "0 auto" }}
        >
          <span
            style={{
              fontSize: 11.5,
              letterSpacing: ".16em",
              color: "rgba(255,255,255,.75)",
            }}
          >
            LEGAL
          </span>
          <h1
            style={{
              margin: "14px 0 0",
              fontSize: "clamp(30px,4.6vw,56px)",
              fontWeight: 700,
              letterSpacing: "-.035em",
              lineHeight: 1.02,
              color: "#ffffff",
            }}
          >
            {title}
          </h1>
          <p
            style={{
              margin: "14px 0 0",
              maxWidth: "56ch",
              fontSize: 16.5,
              lineHeight: 1.6,
              color: "#ffffff",
              opacity: 0.86,
              textWrap: "pretty",
            }}
          >
            {intro}
          </p>
          <p style={{ margin: "18px 0 0", fontSize: 13.5, color: "rgba(255,255,255,.7)" }}>
            Last updated {updated}
          </p>
        </div>
      </section>

      <main
        id="fk-main"
        className="fk-main"
        style={{
          padding: "clamp(34px,5vw,64px) clamp(20px,5vw,56px) clamp(40px,6vw,72px)",
        }}
      >
        <div
          style={{
            display: "grid",
            gap: "clamp(20px,3vw,40px)",
            gridTemplateColumns: "repeat(auto-fit,minmax(min(230px,100%),1fr))",
            maxWidth: 940,
            margin: "0 auto",
          }}
        >
          <nav
            className="fk-toc"
            aria-label="On this page"
            style={{
              position: "sticky",
              top: 110,
              alignSelf: "start",
              display: "flex",
              flexDirection: "column",
              gap: 2,
            }}
          >
            <span
              style={{
                padding: "0 10px 8px",
                fontSize: 11.5,
                letterSpacing: ".14em",
                color: "var(--color-text-tertiary)",
              }}
            >
              ON THIS PAGE
            </span>
            {sections.map((s) => (
              <a key={s.id} href={`#${s.id}`} className="fk-toc-link">
                {s.title}
              </a>
            ))}
          </nav>

          <div style={{ gridColumn: "span 2", minWidth: 0 }}>
            {sections.map((sec) => (
              <div
                key={sec.id}
                id={sec.id}
                style={{ paddingBottom: "clamp(24px,3vw,38px)", scrollMarginTop: 110 }}
              >
                <h2
                  style={{
                    margin: "0 0 12px",
                    fontSize: "clamp(20px,2.2vw,26px)",
                    fontWeight: 600,
                    letterSpacing: "-.02em",
                    color: "var(--neutral-900)",
                  }}
                >
                  {sec.title}
                </h2>
                {(sec.paras ?? []).map((para) => (
                  <p
                    key={para.slice(0, 40)}
                    style={{
                      margin: "0 0 12px",
                      maxWidth: "68ch",
                      fontSize: 15.5,
                      lineHeight: 1.65,
                      color: "var(--color-text-secondary)",
                      textWrap: "pretty",
                    }}
                  >
                    {para}
                  </p>
                ))}
                {(sec.bullets ?? []).map((b) => (
                  <div
                    key={b.slice(0, 40)}
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 11,
                      margin: "0 0 9px",
                      maxWidth: "68ch",
                    }}
                  >
                    <span
                      style={{
                        flex: "0 0 auto",
                        width: 5,
                        height: 5,
                        marginTop: 9,
                        borderRadius: "50%",
                        background: "var(--neutral-400)",
                      }}
                    />
                    <span
                      style={{
                        flex: 1,
                        fontSize: 15.5,
                        lineHeight: 1.6,
                        color: "var(--color-text-secondary)",
                        textWrap: "pretty",
                      }}
                    >
                      {b}
                    </span>
                  </div>
                ))}
              </div>
            ))}
            <div
              style={{
                paddingTop: 24,
                boxShadow: "inset 0 1px 0 var(--neutral-200)",
                fontSize: 14.5,
                lineHeight: 1.6,
                color: "var(--color-text-tertiary)",
                textWrap: "pretty",
              }}
            >
              {foot}
            </div>
          </div>
        </div>
      </main>
    </PublicPage>
  );
}
