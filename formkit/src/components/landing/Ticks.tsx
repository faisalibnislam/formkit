/**
 * The app draws every measurement as a row of hairline ticks - filled ones in
 * colour, the remainder in --neutral-200. Everything on the landing page uses
 * it, so the marketing charts read as the product's own.
 *
 * `short` is the drop-off style, where the unfilled remainder is both greyer
 * and shorter. The funnel keeps its remainder full height.
 */
export function Ticks({
  total,
  filled,
  fill,
  short = false,
  height,
}: {
  total: number;
  filled: number;
  fill: string;
  short?: boolean;
  height?: string | number;
}) {
  return (
    <span
      style={{
        display: "flex",
        alignItems: short ? "flex-end" : "stretch",
        justifyContent: "space-between",
        gap: 3,
        width: "100%",
        height,
      }}
      aria-hidden
    >
      {Array.from({ length: total }, (_, i) => {
        const on = i < filled;
        return (
          <span
            key={i}
            style={{
              flex: "1 1 0",
              minWidth: 0,
              maxWidth: 3,
              borderRadius: 2,
              height: on || !short ? "100%" : "46%",
              background: on ? fill : "var(--neutral-200)",
            }}
          />
        );
      })}
    </span>
  );
}
