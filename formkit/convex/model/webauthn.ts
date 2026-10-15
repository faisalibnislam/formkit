import { b64url, fromB64url } from "./webPush";

/**
 * Passkeys (WebAuthn), checked with nothing but Web Crypto.
 *
 * Only what Formkit asks for is understood: attestation "none" (we don't need
 * to know the make of the device) and ES256 or RS256 keys, which is what
 * Apple, Google, Microsoft and the password managers create. Each passkey
 * must verify the person (Face ID, a fingerprint, a PIN) every time, so a
 * passkey sign-in counts as both factors.
 */

export const ES256 = -7;
export const RS256 = -257;

/* ---------- CBOR, as much as WebAuthn uses ---------- */

type Cbor = number | string | boolean | null | Uint8Array | Cbor[] | Map<Cbor, Cbor>;

export function decodeCbor(bytes: Uint8Array, start = 0): [Cbor, number] {
  let at = start;
  const byte = () => {
    if (at >= bytes.length) throw new Error("CBOR ends early.");
    return bytes[at++]!;
  };
  const length = (info: number) => {
    if (info < 24) return info;
    let n = 0;
    const size = info === 24 ? 1 : info === 25 ? 2 : info === 26 ? 4 : info === 27 ? 8 : -1;
    if (size < 0) throw new Error("CBOR length not supported.");
    for (let i = 0; i < size; i++) n = n * 256 + byte();
    return n;
  };
  const read = (): Cbor => {
    const head = byte();
    const major = head >> 5;
    const info = head & 31;
    if (major === 7) {
      if (info === 20) return false;
      if (info === 21) return true;
      if (info === 22) return null;
      throw new Error("CBOR value not supported.");
    }
    const n = length(info);
    switch (major) {
      case 0:
        return n;
      case 1:
        return -1 - n;
      case 2: {
        if (at + n > bytes.length) throw new Error("CBOR ends early.");
        const out = bytes.slice(at, at + n);
        at += n;
        return out;
      }
      case 3: {
        if (at + n > bytes.length) throw new Error("CBOR ends early.");
        const out = new TextDecoder().decode(bytes.slice(at, at + n));
        at += n;
        return out;
      }
      case 4:
        return Array.from({ length: n }, read);
      case 5: {
        const m = new Map<Cbor, Cbor>();
        for (let i = 0; i < n; i++) {
          const k = read();
          m.set(k, read());
        }
        return m;
      }
      default:
        throw new Error("CBOR type not supported.");
    }
  };
  const value = read();
  return [value, at];
}

/* ---------- authenticator data ---------- */

export const FLAG_UP = 0x01;
export const FLAG_UV = 0x04;
const FLAG_AT = 0x40;

export type AuthData = {
  rpIdHash: Uint8Array;
  flags: number;
  signCount: number;
  credentialId?: Uint8Array;
  /** The new credential's public key, as a COSE map. */
  cose?: Map<Cbor, Cbor>;
};

export function parseAuthData(data: Uint8Array): AuthData {
  if (data.length < 37) throw new Error("The authenticator data is too short.");
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const out: AuthData = { rpIdHash: data.slice(0, 32), flags: data[32]!, signCount: view.getUint32(33) };
  if (out.flags & FLAG_AT) {
    const idLen = view.getUint16(53);
    out.credentialId = data.slice(55, 55 + idLen);
    const [cose] = decodeCbor(data, 55 + idLen);
    if (!(cose instanceof Map)) throw new Error("The public key can't be read.");
    out.cose = cose;
  }
  return out;
}

/** A COSE public key as a JWK Web Crypto can import, with its algorithm. */
export function coseToJwk(cose: Map<Cbor, Cbor>): { alg: number; jwk: JsonWebKey } {
  const kty = cose.get(1);
  const alg = cose.get(3);
  const bytes = (k: number) => {
    const v = cose.get(k);
    if (!(v instanceof Uint8Array)) throw new Error("The public key is missing a part.");
    return b64url(v);
  };
  if (kty === 2 && alg === ES256 && cose.get(-1) === 1) {
    return { alg: ES256, jwk: { kty: "EC", crv: "P-256", x: bytes(-2), y: bytes(-3) } };
  }
  if (kty === 3 && alg === RS256) {
    return { alg: RS256, jwk: { kty: "RSA", n: bytes(-1), e: bytes(-2), alg: "RS256" } };
  }
  throw new Error("This passkey uses a kind of key Formkit doesn't accept.");
}

/* ---------- what both ceremonies check ---------- */

export type ClientData = { type: string; challenge: string; origin: string; crossOrigin?: boolean };

export function readClientData(b64: string): ClientData {
  const data = JSON.parse(new TextDecoder().decode(fromB64url(b64))) as ClientData;
  if (typeof data.type !== "string" || typeof data.challenge !== "string" || typeof data.origin !== "string") {
    throw new Error("The browser's reply can't be read.");
  }
  return data;
}

/** Where passkeys belong: the site's own domain, from SITE_URL. */
export function relyingParty(site = process.env.SITE_URL ?? "https://formkit.app") {
  const url = new URL(site);
  return { id: url.hostname, origin: url.origin };
}

/** The site itself, a subdomain of it, or (in development) localhost. */
export function originAllowed(origin: string, rpId: string) {
  try {
    const u = new URL(origin);
    if (u.hostname === "localhost" && rpId === "localhost") return true;
    return u.protocol === "https:" && (u.hostname === rpId || u.hostname.endsWith(`.${rpId}`));
  } catch {
    return false;
  }
}

async function sha256(bytes: Uint8Array<ArrayBuffer>) {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
}

const same = (a: Uint8Array, b: Uint8Array) => a.length === b.length && a.every((x, i) => x === b[i]);

/* ---------- registration ---------- */

export type NewCredential = {
  id: string;
  clientDataJSON: string;
  attestationObject: string;
  transports?: string[];
};

/**
 * Checks a new passkey and returns what to keep. The challenge is returned
 * for the caller to match against the one it issued.
 */
export async function checkRegistration(cred: NewCredential, rp: { id: string }) {
  const client = readClientData(cred.clientDataJSON);
  if (client.type !== "webauthn.create") throw new Error("That wasn't a new passkey.");
  if (!originAllowed(client.origin, rp.id)) throw new Error("That passkey was made for another site.");
  const [att] = decodeCbor(fromB64url(cred.attestationObject));
  if (!(att instanceof Map) || !(att.get("authData") instanceof Uint8Array)) throw new Error("The passkey's details can't be read.");
  const auth = parseAuthData(att.get("authData") as Uint8Array);
  if (!same(auth.rpIdHash, await sha256(new TextEncoder().encode(rp.id)))) throw new Error("That passkey was made for another site.");
  if (!(auth.flags & FLAG_UP) || !(auth.flags & FLAG_UV)) throw new Error("The passkey has to check it's you, with Face ID, a fingerprint or a PIN.");
  if (!auth.credentialId || !auth.cose) throw new Error("The passkey's details can't be read.");
  if (b64url(auth.credentialId) !== cred.id) throw new Error("The passkey's details don't match.");
  const { alg, jwk } = coseToJwk(auth.cose);
  return { challenge: client.challenge, credentialId: cred.id, alg, publicKey: JSON.stringify(jwk), signCount: auth.signCount };
}

/* ---------- signing in ---------- */

export type Assertion = {
  id: string;
  clientDataJSON: string;
  authenticatorData: string;
  signature: string;
};

/** ECDSA signatures arrive DER-encoded; Web Crypto wants r || s. */
export function derToRaw(der: Uint8Array): Uint8Array<ArrayBuffer> {
  if (der[0] !== 0x30) throw new Error("The signature can't be read.");
  let at = 2;
  const part = () => {
    if (der[at] !== 0x02) throw new Error("The signature can't be read.");
    const len = der[at + 1]!;
    let n = der.slice(at + 2, at + 2 + len);
    at += 2 + len;
    while (n.length > 32 && n[0] === 0) n = n.slice(1);
    const out = new Uint8Array(32);
    out.set(n, 32 - n.length);
    return out;
  };
  const r = part();
  const s = part();
  const raw = new Uint8Array(64);
  raw.set(r, 0);
  raw.set(s, 32);
  return raw;
}

/**
 * Checks a sign-in against the stored passkey. Returns the challenge it
 * answers (for the caller to match) and the authenticator's new counter.
 */
export async function checkAssertion(
  a: Assertion,
  stored: { alg: number; publicKey: string; signCount: number },
  rp: { id: string },
) {
  const client = readClientData(a.clientDataJSON);
  if (client.type !== "webauthn.get") throw new Error("That wasn't a passkey sign-in.");
  if (!originAllowed(client.origin, rp.id)) throw new Error("That passkey belongs to another site.");
  const authData = fromB64url(a.authenticatorData);
  const auth = parseAuthData(authData);
  if (!same(auth.rpIdHash, await sha256(new TextEncoder().encode(rp.id)))) throw new Error("That passkey belongs to another site.");
  if (!(auth.flags & FLAG_UP) || !(auth.flags & FLAG_UV)) throw new Error("The passkey has to check it's you, with Face ID, a fingerprint or a PIN.");

  const signed = new Uint8Array([...authData, ...(await sha256(fromB64url(a.clientDataJSON)))]);
  const jwk = JSON.parse(stored.publicKey) as JsonWebKey;
  const sig = fromB64url(a.signature);
  const ok =
    stored.alg === ES256
      ? await crypto.subtle.verify(
          { name: "ECDSA", hash: "SHA-256" },
          await crypto.subtle.importKey("jwk", jwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["verify"]),
          derToRaw(sig),
          signed,
        )
      : await crypto.subtle.verify(
          "RSASSA-PKCS1-v1_5",
          await crypto.subtle.importKey("jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]),
          sig,
          signed,
        );
  if (!ok) throw new Error("That passkey didn't check out.");
  // A counter that goes backwards means a copied authenticator. Many passkeys
  // keep it at zero, which says nothing either way.
  if ((auth.signCount > 0 || stored.signCount > 0) && auth.signCount <= stored.signCount) {
    throw new Error("That passkey has been used somewhere else. Remove it and add it again.");
  }
  return { challenge: client.challenge, signCount: auth.signCount };
}
