/**
 * What each Gemini model costs, in dollars per million tokens, from Google's
 * paid-tier price list (ai.google.dev/gemini-api/docs/pricing). "Thinking" is
 * billed as output. Update this table when Google changes its prices; costs
 * already recorded keep the price they were recorded at.
 */

type Price = { input: number; output: number };

/** 3.6-3.8 Flash are half price until the end of 2026, then this. */
const FLASH_LIST: Price = { input: 1.5, output: 7.5 };
const FLASH_PROMO: Price = { input: 0.75, output: 3.75 };
const PROMO_ENDS = Date.UTC(2027, 0, 1);

const PRICES: Record<string, Price | ((at: number) => Price)> = {
  "gemini-3.8-flash": (at) => (at < PROMO_ENDS ? FLASH_PROMO : FLASH_LIST),
  "gemini-3.7-flash": (at) => (at < PROMO_ENDS ? FLASH_PROMO : FLASH_LIST),
  "gemini-3.6-flash": (at) => (at < PROMO_ENDS ? FLASH_PROMO : FLASH_LIST),
  // The alias follows the newest stable Flash.
  "gemini-flash-latest": (at) => (at < PROMO_ENDS ? FLASH_PROMO : FLASH_LIST),
  "gemini-3.5-flash": { input: 1.5, output: 9 },
  "gemini-2.5-flash": { input: 0.3, output: 2.5 },
  "gemini-3.5-flash-lite": { input: 0.3, output: 2.5 },
  "gemini-3.1-flash-lite": { input: 0.25, output: 1.5 },
  "gemini-2.5-flash-lite": { input: 0.1, output: 0.4 },
};

/** A model not in the table is priced as the dearest Flash, so costs are never understated. */
const UNKNOWN: Price = { input: 1.5, output: 9 };

export function priceOf(model: string, at: number): Price {
  const p = PRICES[model];
  return !p ? UNKNOWN : typeof p === "function" ? p(at) : p;
}

/** Dollars for one call. `output` includes thinking tokens. */
export function costOf(model: string, input: number, output: number, at: number) {
  const p = priceOf(model, at);
  return (input * p.input + output * p.output) / 1_000_000;
}
