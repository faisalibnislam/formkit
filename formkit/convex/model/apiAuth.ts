import type { Rule } from "./rateLimit";

/**
 * What an API key or a connected app may do. One account's forms only, and
 * nothing is ever deleted: writes change a draft, and publishing is its own
 * permission. Responses hold people's details, so reading them is separate.
 */
export const SCOPES = ["forms:read", "forms:write", "forms:publish", "responses:read", "responses:write", "insights:read"] as const;
export type Scope = (typeof SCOPES)[number];

export const SCOPE_TEXT: Record<Scope, { label: string; detail: string }> = {
  "forms:read": { label: "Read your forms", detail: "Their questions, logic, settings and links." },
  "forms:write": { label: "Make and edit drafts", detail: "New forms and changes stay drafts until published." },
  "forms:publish": { label: "Publish, close and reopen forms", detail: "Changes go live for the people answering." },
  "responses:read": { label: "Read responses", detail: "Everything people sent, including names and email addresses." },
  "responses:write": { label: "Mark and tag responses", detail: "Their status and tags. Never deleted." },
  "insights:read": { label: "Read summaries and AI insights", detail: "Totals per question, and reports already written. Pro." },
};

/** Keys made before scopes existed read, as the first API did. */
export const LEGACY_SCOPES: Scope[] = ["forms:read", "responses:read"];

export function scopesOf(stored: string[] | undefined): Scope[] {
  if (!stored) return LEGACY_SCOPES;
  return SCOPES.filter((s) => stored.includes(s));
}

const MINUTE = 60_000;
/** Requests a minute, per account, across its keys and apps together. */
export const API_RATE: Record<"free" | "paid", Rule> = {
  free: { max: 60, windowMs: MINUTE },
  paid: { max: 600, windowMs: MINUTE },
};

/** fk_live_ keys and the access tokens connected apps are given. */
export const KEY_PATTERN = /^fk_live_[0-9a-f]{48}$/;
export const TOKEN_PATTERN = /^fk_at_[0-9a-f]{48}$/;
