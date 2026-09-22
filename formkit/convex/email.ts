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

/**
 * The code Formkit emails when somebody signs up, so the address is verified
 * before the account is usable.
 */
export const ResendVerifyOTP = Email({
  id: "resend-verify",
  apiKey: process.env.AUTH_RESEND_KEY,
  maxAge: 60 * 15,
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
    if (error) throw new Error(`Formkit could not send the code — ${error.message}`);
  },
});

/** The code Formkit emails before a password reset. */
export const ResendResetOTP = Email({
  id: "resend-reset",
  apiKey: process.env.AUTH_RESEND_KEY,
  maxAge: 60 * 15,
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
    if (error) throw new Error(`Formkit could not send the code — ${error.message}`);
  },
});
