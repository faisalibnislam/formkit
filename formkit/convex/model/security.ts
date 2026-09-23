/**
 * Who may answer a form, and how often. Stored on `forms.security`; the
 * settings screen writes it and `publicForm` enforces it.
 */
export type Security = {
  /** One person may answer more than once. */
  multiple: boolean;
  /** A respondent gets a link to change what they sent. */
  editAfter: boolean;
  /** Respondents need a password to open the form. */
  password: boolean;
  passwordHash?: string;
  passwordSalt?: string;
  /** A quiet check on every submit; only suspicious ones are asked to prove it. */
  spam: boolean;
  /** One submission a minute from any one device. */
  rateLimit: boolean;
  /** No anonymous responses: an email answer is needed to submit. */
  requireEmail: boolean;
};

export const SECURITY_DEFAULTS: Security = {
  multiple: true,
  editAfter: false,
  password: false,
  spam: true,
  rateLimit: true,
  requireEmail: false,
};

export function securityOf(stored: unknown): Security {
  return { ...SECURITY_DEFAULTS, ...((stored ?? {}) as Partial<Security>) };
}

/** What the owner's screen may see: never the hash or its salt. */
export function publicSecurity(stored: unknown) {
  const { passwordHash, passwordSalt, ...rest } = securityOf(stored);
  return { ...rest, passwordSet: !!passwordHash && !!passwordSalt };
}

function hex(buf: ArrayBuffer) {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function newSalt() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return hex(bytes.buffer);
}

export async function hashPassword(password: string, salt: string) {
  const data = new TextEncoder().encode(`${salt}:${password}`);
  return hex(await crypto.subtle.digest("SHA-256", data));
}

export async function passwordMatches(stored: unknown, attempt: string | undefined) {
  const s = securityOf(stored);
  if (!s.password || !s.passwordHash || !s.passwordSalt) return true;
  if (!attempt) return false;
  return (await hashPassword(attempt, s.passwordSalt)) === s.passwordHash;
}
