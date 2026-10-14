import { normaliseEmail } from "../email";

/**
 * What Google and Microsoft sign-in may claim about an email address.
 *
 * Convex Auth links an OAuth sign-in to an existing account with the same
 * email, and treats the email as verified unless told otherwise. That is only
 * safe when the provider itself vouches for the address. Microsoft's
 * multi-tenant (`common`) endpoint lets any tenant put any address in the
 * `email` claim, so an attacker's tenant could sign in as someone else's
 * account ("nOAuth"). Microsoft vouches for the domain with the optional
 * `xms_edov` claim; Google with `email_verified`. Without that, sign-in is
 * refused rather than creating a second account with the same address.
 */
export class UnverifiedEmailError extends Error {}

const truthy = (v: unknown) => v === true || v === 1 || v === "1" || v === "true";

export function microsoftProfile(p: Record<string, unknown>) {
  const raw = typeof p.email === "string" ? p.email : undefined;
  if (!raw || !truthy(p.xms_edov)) {
    throw new UnverifiedEmailError(
      "Microsoft did not confirm that this address belongs to your organisation. Sign in with your password, or ask your IT admin to turn on verified email for Formkit.",
    );
  }
  return {
    id: String(p.sub),
    name: typeof p.name === "string" ? p.name : undefined,
    email: normaliseEmail(raw),
    emailVerified: true,
    image: null,
  };
}

export function googleProfile(p: Record<string, unknown>) {
  const raw = typeof p.email === "string" ? p.email : undefined;
  if (!raw || !truthy(p.email_verified)) {
    throw new UnverifiedEmailError("Google has not verified this address yet. Verify it with Google, or sign in with your password.");
  }
  return {
    id: String(p.sub),
    name: typeof p.name === "string" ? p.name : undefined,
    email: normaliseEmail(raw),
    emailVerified: true,
    image: typeof p.picture === "string" ? p.picture : null,
  };
}

/** How long after sign-up STAFF_EMAILS may still grant a role: covers the wait for the emailed code. */
export const BOOTSTRAP_WINDOW = 24 * 60 * 60 * 1000;

/**
 * The staff role STAFF_EMAILS gives this person, if any. Only to an address
 * someone has proven they own, only once (`staffBootstrapAt`), and only to a
 * new account, so a role staff later removed is never handed back.
 */
export function bootstrapStaffRole(
  user: {
    email?: string;
    emailVerificationTime?: number;
    staffRole?: string;
    staffBootstrapAt?: number;
    _creationTime: number;
  } | null,
  staffEmails: string | undefined,
  now: number,
) {
  if (!user?.email || !user.emailVerificationTime) return undefined;
  if (user.staffRole || user.staffBootstrapAt) return undefined;
  if (now - user._creationTime > BOOTSTRAP_WINDOW) return undefined;
  const listed = (staffEmails ?? "")
    .split(",")
    .map((a) => a.trim().toLowerCase())
    .filter(Boolean);
  return listed.includes(user.email.toLowerCase()) ? ("owner" as const) : undefined;
}
