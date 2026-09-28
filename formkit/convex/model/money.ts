/** Currencies a form can charge in, and Stripe's minor units for each. */
export const CURRENCIES = ["usd", "eur", "gbp", "cad", "aud", "nzd", "inr", "bdt", "sgd", "chf", "sek", "jpy", "brl", "mxn", "aed"];

const ZERO_DECIMAL = new Set(["jpy", "krw", "vnd", "clp", "pyg", "ugx", "xaf", "xof", "bif", "djf", "gnf", "kmf", "mga", "rwf", "vuv", "xpf"]);

/** Major units (12.50) → the minor units Stripe counts in (1250). */
export function toMinor(amount: number, currency: string) {
  return Math.round(amount * (ZERO_DECIMAL.has(currency) ? 1 : 100));
}

export function fromMinor(amount: number, currency: string) {
  return amount / (ZERO_DECIMAL.has(currency) ? 1 : 100);
}

/** 1250, "usd" → "12.50 USD". */
export function moneyText(amount: number, currency: string) {
  const major = fromMinor(amount, currency);
  return `${ZERO_DECIMAL.has(currency) ? major.toFixed(0) : major.toFixed(2)} ${currency.toUpperCase()}`;
}
