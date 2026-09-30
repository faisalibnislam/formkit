import { ImageResponse } from "next/og";
import { MARK, WORD } from "@/components/brand/logo-paths";

/**
 * The picture a shared link shows, drawn per page: the night sky from the
 * site, the logo, what kind of page it is, and its title. Every
 * `opengraph-image` and `twitter-image` route draws through here, so a link
 * to a template, a comparison or a help article says what it is.
 */

export const OG_SIZE = { width: 1200, height: 630 };
export const OG_TYPE = "image/png";

/** Outfit, the site's typeface, as TTF (the renderer cannot read WOFF2). Falls back to the default font. */
async function outfit(weight: 400 | 600): Promise<ArrayBuffer | null> {
  try {
    const css = await (
      await fetch(`https://fonts.googleapis.com/css2?family=Outfit:wght@${weight}`, {
        // An old browser gets TTF URLs rather than WOFF2.
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 6.1) AppleWebKit/534.30 (KHTML, like Gecko) Safari/534.30" },
        signal: AbortSignal.timeout(5000),
      })
    ).text();
    const url = /src:\s*url\(([^)]+)\)\s*format\('(?:truetype|opentype)'\)/.exec(css)?.[1];
    return url ? await (await fetch(url, { signal: AbortSignal.timeout(5000) })).arrayBuffer() : null;
  } catch {
    return null;
  }
}

export async function ogImage({
  kicker,
  title,
  sub,
}: {
  /** What kind of page: "Template", "Help centre", "Compare"… */
  kicker: string;
  title: string;
  sub?: string;
}) {
  const [regular, bold] = await Promise.all([outfit(400), outfit(600)]);
  const fonts = [
    ...(regular ? [{ name: "Outfit", data: regular, weight: 400 as const, style: "normal" as const }] : []),
    ...(bold ? [{ name: "Outfit", data: bold, weight: 600 as const, style: "normal" as const }] : []),
  ];
  const long = title.length > 48;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "64px 72px",
          // Never undefined: the renderer splits whatever is here.
          ...(fonts.length ? { fontFamily: "Outfit" } : {}),
          color: "#ffffff",
          background: "linear-gradient(160deg, #1b2547 0%, #2b3f73 45%, #5b6fa3 78%, #c9926f 100%)",
          position: "relative",
        }}
      >
        {/* The low sun from the site's sky. */}
        <div
          style={{
            position: "absolute",
            right: -120,
            bottom: -220,
            width: 620,
            height: 620,
            borderRadius: 620,
            background: "rgba(255,214,160,0.28)",
            boxShadow: "0 0 160px 80px rgba(255,200,150,0.25)",
          }}
        />
        <svg width={4076 * (44 / 763)} height={44} viewBox="0 0 4076 763" fill="#ffffff">
          {[...MARK, ...WORD].map((d, i) => (
            <path key={i} d={d} />
          ))}
        </svg>

        <div style={{ display: "flex", flexDirection: "column", maxWidth: 980 }}>
          <div
            style={{
              display: "flex",
              alignSelf: "flex-start",
              padding: "8px 18px",
              borderRadius: 999,
              background: "rgba(255,255,255,0.16)",
              border: "1px solid rgba(255,255,255,0.28)",
              fontSize: 22,
              letterSpacing: 2,
              textTransform: "uppercase",
              marginBottom: 26,
            }}
          >
            {kicker}
          </div>
          <div style={{ fontSize: long ? 60 : 76, fontWeight: 600, lineHeight: 1.05, letterSpacing: -2 }}>{title}</div>
          {sub && (
            <div style={{ fontSize: 30, lineHeight: 1.35, marginTop: 22, color: "rgba(255,255,255,0.82)", maxWidth: 900 }}>
              {sub}
            </div>
          )}
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 24 }}>
          <span style={{ color: "rgba(255,255,255,0.8)" }}>Free to start. Forms people finish.</span>
          <span style={{ fontWeight: 600 }}>formkit.app</span>
        </div>
      </div>
    ),
    // Only when there are some: `fonts: undefined` would replace the built-in default with nothing.
    fonts.length ? { ...OG_SIZE, fonts } : OG_SIZE,
  );
}
