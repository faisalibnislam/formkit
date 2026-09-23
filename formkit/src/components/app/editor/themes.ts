/**
 * The theme a published form is painted with.
 *
 * The presets come from the design system, with one change: every dark value is
 * `#21282E`. That is Formkit's one dark colour — the handoff bundle still
 * carried `#2c3034` and `#1c2023` from an earlier pass, and they were retired.
 */

export type Theme = {
  preset: string;
  bg: string;
  surface: string;
  text: string;
  primary: string;
  radius: number;
  /** Body font. */
  font: string;
  /** Heading font. */
  heading: string;
  size: "Small" | "Medium" | "Large";
  weight: "Light" | "Regular" | "Medium" | "Bold";
  layout: "centered" | "wide" | "full" | "split";
  showLogo: boolean;
  /**
   * Up to three logos that sit beside the lead one — the logo of whoever the
   * form is published under — separated by a ×.
   */
  logos: { name: string; storageId?: string }[];
  logoAlign: "left" | "center" | "right";
  logoSize: "Small" | "Medium" | "Large";
};

const INK = "#21282E";

export const THEME_PRESETS = [
  { id: "paper", name: "Paper", bg: "#f4f4f4", surface: "#ffffff", text: INK, primary: INK, radius: 20 },
  { id: "sky", name: "Sky", bg: "#d8e9f7", surface: "#ffffff", text: INK, primary: "#2e78bb", radius: 28 },
  { id: "cloud", name: "Cloud", bg: "#86b2dc", surface: "#ffffff", text: INK, primary: INK, radius: 28 },
  { id: "mint", name: "Mint", bg: "#e6f2ee", surface: "#ffffff", text: INK, primary: "#337c38", radius: 24 },
  { id: "minimal", name: "Minimal", bg: "#ffffff", surface: "#ffffff", text: INK, primary: INK, radius: 12 },
  { id: "editorial", name: "Editorial", bg: "#ffffff", surface: "#fafafa", text: INK, primary: INK, radius: 4 },
  { id: "daylight", name: "Daylight", bg: "#fdf7e0", surface: "#ffffff", text: INK, primary: "#bd9a24", radius: 24 },
  { id: "blush", name: "Blush", bg: "#fdeeed", surface: "#ffffff", text: INK, primary: "#b33e3a", radius: 28 },
  { id: "midnight", name: "Midnight", bg: INK, surface: "#2b333a", text: "#ffffff", primary: "#a3c8e7", radius: 24 },
  { id: "slate", name: "Slate", bg: INK, surface: INK, text: "#ffffff", primary: "#86b2dc", radius: 12 },
];

export const DEFAULT_THEME: Theme = {
  preset: "minimal",
  bg: "#ffffff",
  surface: "#ffffff",
  text: INK,
  primary: INK,
  radius: 12,
  font: "Outfit",
  heading: "Outfit",
  size: "Medium",
  weight: "Medium",
  layout: "centered",
  showLogo: true,
  logos: [],
  logoAlign: "center",
  logoSize: "Medium",
};

export const MAX_EXTRA_LOGOS = 3;

export const WEIGHTS: Record<Theme["weight"], number> = {
  Light: 300,
  Regular: 400,
  Medium: 500,
  Bold: 700,
};

/** The reading column each layout gives the questions, in pixels. */
export const COLUMN: Record<Theme["layout"], number | "100%"> = {
  centered: 620,
  wide: 820,
  full: "100%",
  split: 700,
};

export const LOGO_PX: Record<Theme["logoSize"], number> = { Small: 26, Medium: 36, Large: 48 };

/** Ink for text on the accent: dark on the light accents, white otherwise. */
export function buttonInk(primary: string) {
  const hex = primary.replace("#", "");
  if (!/^[0-9a-f]{6}$/i.test(hex)) return "#ffffff";
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  return 0.299 * r + 0.587 * g + 0.114 * b > 170 ? INK : "#ffffff";
}

/** A stored theme, with anything missing filled in. */
export function themeOf(stored: unknown): Theme {
  const t = { ...DEFAULT_THEME, ...((stored ?? {}) as Partial<Theme>) };
  // A theme saved before headings had their own font reads its body font.
  if (!(stored as Partial<Theme> | null)?.heading) t.heading = t.font;
  if (!Array.isArray(t.logos)) t.logos = [];
  return t;
}

/** The type scale, as a multiplier on the form's base size. */
export const SIZE_SCALE: Record<Theme["size"], number> = {
  Small: 0.92,
  Medium: 1,
  Large: 1.12,
};
