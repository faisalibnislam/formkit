"use client";

/**
 * The browser's side of passkeys (convex/passkeys.ts): turning the server's
 * options into what navigator.credentials wants, and the browser's answer
 * back into plain base64url strings.
 */

const toBytes = (b64: string) => {
  const s = atob(b64.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((b64.length + 3) % 4));
  return Uint8Array.from(s, (c) => c.charCodeAt(0));
};
const toB64 = (buf: ArrayBuffer) =>
  btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

export function passkeysSupported() {
  return typeof window !== "undefined" && typeof window.PublicKeyCredential === "function" && !!navigator.credentials;
}

/** Passkeys belong to one domain: offer them only on it (not on preview links). */
export function passkeysHere(rpId: string) {
  if (!passkeysSupported()) return false;
  const host = window.location.hostname;
  return host === rpId || host.endsWith(`.${rpId}`);
}

/** The user closed the prompt or picked nothing: not worth an error. */
export function cancelled(e: unknown) {
  return e instanceof DOMException && (e.name === "NotAllowedError" || e.name === "AbortError");
}

type CreateOptions = {
  challenge: string;
  rp: { id: string; name: string };
  user: { id: string; name: string; displayName: string };
  pubKeyCredParams: { type: "public-key"; alg: number }[];
  authenticatorSelection: AuthenticatorSelectionCriteria;
  attestation: AttestationConveyancePreference;
  excludeCredentials: { type: "public-key"; id: string; transports?: string[] }[];
  timeout: number;
};

export async function createPasskey(o: CreateOptions) {
  const cred = (await navigator.credentials.create({
    publicKey: {
      ...o,
      challenge: toBytes(o.challenge),
      user: { ...o.user, id: toBytes(o.user.id) },
      excludeCredentials: o.excludeCredentials.map((c) => ({ ...c, id: toBytes(c.id), transports: c.transports as AuthenticatorTransport[] })),
    },
  })) as PublicKeyCredential | null;
  if (!cred) throw new DOMException("No passkey was made.", "NotAllowedError");
  const res = cred.response as AuthenticatorAttestationResponse;
  return {
    id: toB64(cred.rawId),
    clientDataJSON: toB64(res.clientDataJSON),
    attestationObject: toB64(res.attestationObject),
    transports: typeof res.getTransports === "function" ? res.getTransports() : undefined,
  };
}

export async function answerWithPasskey(o: { challenge: string; rpId: string; userVerification: UserVerificationRequirement; timeout: number }) {
  const cred = (await navigator.credentials.get({
    publicKey: { challenge: toBytes(o.challenge), rpId: o.rpId, userVerification: o.userVerification, timeout: o.timeout },
  })) as PublicKeyCredential | null;
  if (!cred) throw new DOMException("No passkey was picked.", "NotAllowedError");
  const res = cred.response as AuthenticatorAssertionResponse;
  return {
    id: toB64(cred.rawId),
    clientDataJSON: toB64(res.clientDataJSON),
    authenticatorData: toB64(res.authenticatorData),
    signature: toB64(res.signature),
  };
}

/** "iPhone", "Mac", "Windows": a first name for a new passkey. */
export function guessName() {
  const ua = navigator.userAgent;
  if (/iPhone/.test(ua)) return "iPhone";
  if (/iPad/.test(ua)) return "iPad";
  if (/Android/.test(ua)) return "Android phone";
  if (/Mac OS X/.test(ua)) return "Mac";
  if (/Windows/.test(ua)) return "Windows";
  return "Passkey";
}
