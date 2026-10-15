/**
 * Whether written answers read like spam: what an automated sender gets
 * checked against before its response is kept (agents.ts). Plain rules, no
 * AI: links piled up, the same character over and over, the usual pitches.
 * People filling in a form in a browser are checked by Turnstile instead.
 */

const PITCH = [
  /\bcasino\b/i,
  /\bviagra\b|\bcialis\b/i,
  /\b(seo|backlinks?)\s+(services?|packages?)\b/i,
  /\bguest\s+post(ing)?\b/i,
  /\b(crypto|bitcoin)\s+(giveaway|doubler|investment\s+plan)\b/i,
  /\bearn\s+\$?\d[\d,]*\s*(per|a)\s*(day|week)\b/i,
  /\bpayday\s+loans?\b/i,
];

export function spamReason(texts: string[]): string | null {
  const all = texts.join("\n");
  const links = all.match(/https?:\/\/|www\./gi)?.length ?? 0;
  if (links > 3) return "too many links";
  if (/(.)\1{24,}/.test(all)) return "the same character over and over";
  if (PITCH.some((p) => p.test(all))) return "it reads like an advert";
  // Mostly capitals, at length.
  const letters = all.replace(/[^A-Za-z]/g, "");
  if (letters.length > 80 && letters.replace(/[^A-Z]/g, "").length / letters.length > 0.8) return "written in capitals";
  return null;
}
