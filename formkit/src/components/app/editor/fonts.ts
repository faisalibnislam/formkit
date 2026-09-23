/**
 * The fonts a form can be set in, loaded from Google Fonts only when chosen.
 *
 * There is deliberately no monospace category: Formkit never renders a
 * monospace face, and a form theme is no exception.
 */
export type Font = { name: string; cat: "Sans" | "Serif" | "Display" | "Handwriting" | "System" };

export const FONTS: Font[] = [
  ...[
    "Outfit", "Inter", "Roboto", "Open Sans", "Lato", "Montserrat", "Poppins", "Raleway",
    "Nunito", "Work Sans", "Rubik", "DM Sans", "Manrope", "Figtree", "Plus Jakarta Sans",
    "Karla", "Mulish", "Barlow", "Source Sans 3", "Noto Sans", "PT Sans", "Quicksand",
    "Josefin Sans", "Archivo", "Space Grotesk", "Sora", "Urbanist",
  ].map((name) => ({ name, cat: "Sans" as const })),
  ...[
    "Playfair Display", "Merriweather", "Lora", "PT Serif", "Libre Baskerville", "Crimson Text",
    "EB Garamond", "Cormorant Garamond", "Bitter", "Instrument Serif", "Fraunces",
    "Source Serif 4", "Noto Serif", "Spectral", "Newsreader",
  ].map((name) => ({ name, cat: "Serif" as const })),
  ...["Oswald", "Bebas Neue", "Anton", "Abril Fatface", "Righteous", "Comfortaa"].map((name) => ({
    name,
    cat: "Display" as const,
  })),
  ...["Dancing Script", "Pacifico", "Caveat"].map((name) => ({
    name,
    cat: "Handwriting" as const,
  })),
  { name: "System", cat: "System" },
];

/** A CSS font stack for a font name, with a fallback of the right kind. */
export function fontStack(name: string | null | undefined) {
  if (!name || name === "System" || name === "Outfit") return "var(--font-sans)";
  const cat = FONTS.find((f) => f.name === name)?.cat;
  const fallback = cat === "Serif" ? "Georgia, serif" : "system-ui, sans-serif";
  return `"${name}", ${fallback}`;
}

const loaded = new Set<string>(["Outfit", "System"]);

function link(href: string) {
  const l = document.createElement("link");
  l.rel = "stylesheet";
  l.href = href;
  document.head.appendChild(l);
}

/** Load one font in full, the first time it is used. */
export function loadFont(name: string | null | undefined) {
  if (typeof document === "undefined" || !name || loaded.has(name)) return;
  if (!FONTS.some((f) => f.name === name)) return;
  loaded.add(name);
  link(
    `https://fonts.googleapis.com/css2?family=${name.replace(/ /g, "+")}:wght@300;400;500;600;700&display=swap`,
  );
}

let previewsLoaded = false;

/**
 * Enough of every font to draw its own name in the picker: one request, and
 * only the letters those names use.
 */
export function loadFontPreviews() {
  if (typeof document === "undefined" || previewsLoaded) return;
  previewsLoaded = true;
  const names = FONTS.filter((f) => !loaded.has(f.name)).map((f) => f.name);
  const letters = Array.from(new Set(names.join(""))).join("");
  link(
    `https://fonts.googleapis.com/css2?${names
      .map((n) => `family=${n.replace(/ /g, "+")}`)
      .join("&")}&text=${encodeURIComponent(letters)}&display=swap`,
  );
}
