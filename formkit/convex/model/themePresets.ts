/**
 * The theme presets a form can be painted with, shared by the Design tab and by
 * Ask Formkit's theme picker so the two can never disagree.
 *
 * Every dark value is `#21282E`, Formkit's one dark colour.
 */

export const INK = "#21282E";

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
