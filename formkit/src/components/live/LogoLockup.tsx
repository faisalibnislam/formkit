/**
 * The logo row at the top of a form: whoever it is published under leads,
 * and up to three more sit beside it, separated by a ×. A logo with no image
 * is drawn as its name.
 */
export function LogoLockup({
  lead,
  extras,
  align = "center",
  size = 36,
}: {
  lead: { name: string; logoUrl: string | null } | null;
  extras: { name: string; url: string | null }[];
  align?: "left" | "center" | "right";
  size?: number;
}) {
  const items = [
    ...(lead ? [{ name: lead.name, url: lead.logoUrl }] : []),
    ...extras.filter((e) => e.url || e.name),
  ];
  if (!items.length) return null;
  return (
    <div
      className="fk-lockup"
      style={{
        display: "flex",
        alignItems: "center",
        flexWrap: "wrap",
        gap: size * 0.4,
        justifyContent: align === "center" ? "center" : align === "right" ? "flex-end" : "flex-start",
      }}
    >
      {items.map((item, i) => (
        <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: size * 0.4 }}>
          {i > 0 && (
            <span aria-hidden style={{ opacity: 0.4, fontSize: size * 0.5 }}>
              ×
            </span>
          )}
          {item.url ? (
            <img
              src={item.url}
              alt={item.name || "Logo"}
              style={{ height: size, maxWidth: size * 5, objectFit: "contain", display: "block" }}
            />
          ) : (
            <span style={{ fontSize: size * 0.52, fontWeight: 500, letterSpacing: "-.01em" }}>
              {item.name}
            </span>
          )}
        </span>
      ))}
    </div>
  );
}
