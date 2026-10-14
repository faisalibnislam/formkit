/** The languages a form can be in. The live form's own words for each are in src/components/live/i18n.ts. */
export const LANGS = ["en", "es", "fr", "de", "pt", "it", "nl", "ar", "hi", "bn", "ja", "zh"] as const;
export type Lang = (typeof LANGS)[number];

export const LANG_ENGLISH_NAMES: Record<Lang, string> = {
  en: "English",
  es: "Spanish",
  fr: "French",
  de: "German",
  pt: "Portuguese",
  it: "Italian",
  nl: "Dutch",
  ar: "Arabic",
  hi: "Hindi",
  bn: "Bengali",
  ja: "Japanese",
  zh: "Chinese (Simplified)",
};

export function isLang(x: unknown): x is Lang {
  return typeof x === "string" && (LANGS as readonly string[]).includes(x);
}
