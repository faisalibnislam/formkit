import type { CSSProperties } from "react";

/**
 * Placeholders in the shape of what is coming, shown the moment a page is
 * asked for and until its data arrives - so a click always changes the screen
 * at once, and nothing jumps when the real content lands.
 *
 * Server-safe (no hooks), so a route's loading.tsx can render it.
 */
function Skel({ w = "100%", h = 14, r = 8, style }: { w?: number | string; h?: number | string; r?: number; style?: CSSProperties }) {
  return <span className="fk-skel" aria-hidden style={{ width: w, height: h, borderRadius: r, ...style }} />;
}

function Card({ children, style }: { children: React.ReactNode; style?: CSSProperties }) {
  return (
    <div className="fk-skel-card" style={style}>
      {children}
    </div>
  );
}

function Rows({ n = 6 }: { n?: number }) {
  return (
    <Card style={{ padding: 0 }}>
      {Array.from({ length: n }, (_, i) => (
        <div key={i} className="fk-skel-row">
          <Skel w={36} h={36} r={12} />
          <span style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
            <Skel w={`${42 + ((i * 17) % 30)}%`} h={13} />
            <Skel w={`${24 + ((i * 11) % 20)}%`} h={11} />
          </span>
          <Skel w={72} h={24} r={999} />
        </div>
      ))}
    </Card>
  );
}

export type SkeletonKind = "dashboard" | "list" | "table" | "cards" | "editor" | "panel";

export function PageSkeleton({ kind = "list", label = "Loading" }: { kind?: SkeletonKind; label?: string }) {
  return (
    <div className="fk-skel-page" role="status" aria-live="polite" aria-label={label}>
      {kind === "dashboard" && (
        <>
          <div className="fk-skel-grid" data-cols="4">
            {Array.from({ length: 4 }, (_, i) => (
              <Card key={i}>
                <Skel w="45%" h={13} />
                <Skel w="35%" h={34} r={10} style={{ marginTop: 18 }} />
                <Skel w="100%" h={30} r={6} style={{ marginTop: 18 }} />
              </Card>
            ))}
          </div>
          <Skel w={180} h={22} style={{ margin: "30px 0 14px" }} />
          <div className="fk-skel-grid" data-cols="3">
            {Array.from({ length: 3 }, (_, i) => (
              <Card key={i}>
                <Skel w="100%" h={110} r={14} />
                <Skel w="60%" h={14} style={{ marginTop: 14 }} />
              </Card>
            ))}
          </div>
        </>
      )}

      {kind === "list" && (
        <>
          <Card style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <Skel w={260} h={36} r={999} />
            <span style={{ flex: 1 }} />
            <Skel w={220} h={36} r={999} />
          </Card>
          <Rows n={7} />
        </>
      )}

      {kind === "table" && (
        <>
          <div className="fk-skel-grid" data-cols="4">
            {Array.from({ length: 4 }, (_, i) => (
              <Card key={i}>
                <Skel w="50%" h={12} />
                <Skel w="30%" h={28} r={8} style={{ marginTop: 14 }} />
              </Card>
            ))}
          </div>
          <Rows n={8} />
        </>
      )}

      {kind === "cards" && (
        <div className="fk-skel-grid" data-cols="3">
          {Array.from({ length: 6 }, (_, i) => (
            <Card key={i}>
              <Skel w={40} h={40} r={12} />
              <Skel w="70%" h={15} style={{ marginTop: 16 }} />
              <Skel w="90%" h={12} style={{ marginTop: 10 }} />
              <Skel w="55%" h={12} style={{ marginTop: 8 }} />
            </Card>
          ))}
        </div>
      )}

      {kind === "editor" && (
        <div className="fk-skel-editor">
          <Card>
            <Skel w="100%" h={40} r={999} />
            {Array.from({ length: 8 }, (_, i) => (
              <Skel key={i} w={`${55 + ((i * 13) % 35)}%`} h={14} style={{ marginTop: 16 }} />
            ))}
          </Card>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {Array.from({ length: 3 }, (_, i) => (
              <Card key={i}>
                <Skel w="30%" h={12} />
                <Skel w="75%" h={20} style={{ marginTop: 14 }} />
                <Skel w="100%" h={44} r={999} style={{ marginTop: 16 }} />
              </Card>
            ))}
          </div>
          <Card>
            <Skel w="40%" h={14} />
            {Array.from({ length: 3 }, (_, i) => (
              <Skel key={i} w="100%" h={38} r={12} style={{ marginTop: 14 }} />
            ))}
          </Card>
        </div>
      )}

      {kind === "panel" && (
        <Card>
          <Skel w="30%" h={20} />
          <Skel w="60%" h={13} style={{ marginTop: 12 }} />
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} style={{ display: "flex", gap: 16, alignItems: "center", marginTop: 22 }}>
              <span style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
                <Skel w="35%" h={13} />
                <Skel w="55%" h={11} />
              </span>
              <Skel w={44} h={26} r={999} />
            </div>
          ))}
        </Card>
      )}
      <span className="sr-only">{label}…</span>
    </div>
  );
}
