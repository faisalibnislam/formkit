import { Email } from "@convex-dev/auth/providers/Email";
import { Resend as ResendAPI } from "resend";
import { renderAuthCodeEmail } from "./emails/authCode";

const DIGITS = "0123456789";

/** A six-digit code, drawn from the platform CSPRNG rather than Math.random. */
function verificationCode(length = 6) {
  const bytes = new Uint32Array(length);
  crypto.getRandomValues(bytes);
  let out = "";
  for (let i = 0; i < length; i++) out += DIGITS[bytes[i] % DIGITS.length];
  return out;
}

const FROM = process.env.AUTH_EMAIL_FROM ?? "Formkit <onboarding@resend.dev>";

/** The one way an address is written down, everywhere. */
export function normaliseEmail(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

/**
 * Checking that the code was sent to the address being claimed.
 *
 * This replaces the provider's default check, which compares the two raw
 * strings. The account's id is stored normalised - `auth.ts` lowercases and
 * trims it - so a raw comparison rejects a perfectly good code the moment
 * somebody types a capital or autofill leaves a trailing space. Both sides are
 * normalised here, and the message says what actually went wrong.
 */
const sameAddress = async (params: Record<string, unknown>, account: unknown) => {
  const given = normaliseEmail(params.email);
  const stored = (account as { providerAccountId?: string }).providerAccountId ?? "";
  if (!given) {
    throw new Error("Enter the email address you signed up with.");
  }
  if (normaliseEmail(stored) !== given) {
    throw new Error("That code was sent to a different address.");
  }
};

/**
 * The code Formkit emails when somebody signs up, so the address is verified
 * before the account is usable.
 */
export const ResendVerifyOTP = Email({
  id: "resend-verify",
  apiKey: process.env.AUTH_RESEND_KEY,
  maxAge: 60 * 15,
  authorize: sameAddress,
  async generateVerificationToken() {
    return verificationCode();
  },
  async sendVerificationRequest({ identifier: email, token, expires }) {
    const resend = new ResendAPI(process.env.AUTH_RESEND_KEY);
    const { error } = await resend.emails.send({
      from: FROM,
      to: [email],
      subject: `${token} is your Formkit code`,
      html: renderAuthCodeEmail({
        token,
        expires,
        heading: "Confirm your email",
        lede: "Enter this code in Formkit to finish setting up your account.",
      }),
    });
    // Errors name the fix rather than failing silently.
    if (error) throw new Error(`Formkit could not send the code: ${error.message}`);
  },
});

/** The code Formkit emails before a password reset. */
export const ResendResetOTP = Email({
  id: "resend-reset",
  apiKey: process.env.AUTH_RESEND_KEY,
  maxAge: 60 * 15,
  authorize: sameAddress,
  async generateVerificationToken() {
    return verificationCode();
  },
  async sendVerificationRequest({ identifier: email, token, expires }) {
    const resend = new ResendAPI(process.env.AUTH_RESEND_KEY);
    const { error } = await resend.emails.send({
      from: FROM,
      to: [email],
      subject: `${token} is your Formkit reset code`,
      html: renderAuthCodeEmail({
        token,
        expires,
        heading: "Reset your password",
        lede: "Enter this code in Formkit, then choose a new password. If you did not ask for this, you can ignore it.",
      }),
    });
    if (error) throw new Error(`Formkit could not send the code: ${error.message}`);
  },
});
