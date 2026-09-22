import type { CSSProperties } from "react";
import { MARK, WORD } from "./logo-paths";

const RATIO_FULL = 4076 / 763;
const RATIO_MARK = 903 / 763;
const RATIO_WORD = 3013 / 763;

export type LogoTone = "ink" | "inverse" | "current";

type LogoProps = {
  /** Height in pixels. Width follows the artwork's aspect ratio. */
  size?: number;
  tone?: LogoTone;
  showMark?: boolean;
  wordmark?: boolean;
  className?: string;
  style?: CSSProperties;
};

export function Logo({
  size = 22,
  tone = "ink",
  showMark = true,
  wordmark = true,
  className,
  style,
}: LogoProps) {
  const color =
    tone === "inverse"
      ? "var(--neutral-0)"
      : tone === "current"
        ? "currentColor"
        : "var(--neutral-900)";

  const full = showMark && wordmark;
  const paths = full ? [...MARK, ...WORD] : showMark ? MARK : WORD;
  const viewBox = full ? "0 0 4076 763" : showMark ? "0 0 903 763" : "1063 0 3013 763";
  const ratio = full ? RATIO_FULL : showMark ? RATIO_MARK : RATIO_WORD;

  return (
    <svg
      viewBox={viewBox}
      height={size}
      width={Math.round(size * ratio)}
      fill="none"
      role="img"
      aria-label="Formkit"
      className={className}
      style={{ display: "block", flex: "0 0 auto", color, ...style }}
    >
      {paths.map((d, i) => (
        <path key={i} d={d} fill="currentColor" />
      ))}
    </svg>
  );
}
