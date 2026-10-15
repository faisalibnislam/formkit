/**
 * Web Push with nothing but Web Crypto: the VAPID signature that tells the
 * push service who is sending (RFC 8292), and the encryption that keeps the
 * message between Formkit and the browser (RFC 8291, aes128gcm).
 *
 * Keys come from the environment as base64url: VAPID_PUBLIC_KEY is the
 * 65-byte uncompressed P-256 point, VAPID_PRIVATE_KEY the 32-byte scalar.
 * `npx web-push generate-vapid-keys` prints a pair in exactly this form.
 */

const enc = new TextEncoder();

export function b64url(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function fromB64url(text: string): Uint8Array<ArrayBuffer> {
  const s = atob(text.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((text.length + 3) % 4));
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

function concat(...parts: Uint8Array[]): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}

export type Vapid = { publicKey: string; privateKey: string; subject: string };

/** The VAPID keys, or null when push is not set up on this deployment. */
export function vapidFromEnv(): Vapid | null {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) return null;
  return { publicKey, privateKey, subject: process.env.VAPID_SUBJECT || "mailto:support@formkit.app" };
}

/** The Authorization header for one push service. */
export async function vapidAuth(endpoint: string, vapid: Vapid, now = Date.now()): Promise<string> {
  const pub = fromB64url(vapid.publicKey);
  const key = await crypto.subtle.importKey(
    "jwk",
    { kty: "EC", crv: "P-256", d: vapid.privateKey, x: b64url(pub.slice(1, 33)), y: b64url(pub.slice(33, 65)), ext: true },
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );
  const header = b64url(enc.encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const claims = b64url(
    enc.encode(JSON.stringify({ aud: new URL(endpoint).origin, exp: Math.floor(now / 1000) + 12 * 60 * 60, sub: vapid.subject })),
  );
  const signed = `${header}.${claims}`;
  // Web Crypto signs as r || s, which is what a JWT wants.
  const sig = new Uint8Array(await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, enc.encode(signed)));
  return `vapid t=${signed}.${b64url(sig)}, k=${vapid.publicKey}`;
}

async function hkdf(salt: Uint8Array<ArrayBuffer>, ikm: Uint8Array<ArrayBuffer>, info: Uint8Array<ArrayBuffer>, length: number) {
  const key = await crypto.subtle.importKey("raw", ikm, "HKDF", false, ["deriveBits"]);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt, info }, key, length * 8));
}

/**
 * Encrypts one message for one browser, as a single aes128gcm record.
 * `fixed` is for tests: a known salt and sender key pair.
 */
export async function encrypt(
  payload: Uint8Array,
  sub: { p256dh: string; auth: string },
  fixed?: { salt: Uint8Array<ArrayBuffer>; keys: CryptoKeyPair },
): Promise<Uint8Array<ArrayBuffer>> {
  const uaPublic = fromB64url(sub.p256dh);
  const authSecret = fromB64url(sub.auth);
  const keys = fixed?.keys ?? ((await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"])) as CryptoKeyPair);
  const asPublic = new Uint8Array(await crypto.subtle.exportKey("raw", keys.publicKey));
  const uaKey = await crypto.subtle.importKey("raw", uaPublic, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: "ECDH", public: uaKey }, keys.privateKey, 256));

  const ikm = await hkdf(authSecret, shared, concat(enc.encode("WebPush: info\0"), uaPublic, asPublic), 32);
  const salt = fixed?.salt ?? crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(salt, ikm, enc.encode("Content-Encoding: aes128gcm\0"), 16);
  const nonce = await hkdf(salt, ikm, enc.encode("Content-Encoding: nonce\0"), 12);

  const aes = await crypto.subtle.importKey("raw", cek, "AES-GCM", false, ["encrypt"]);
  // One record, so it ends with the last-record delimiter.
  const sealed = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, aes, concat(payload, new Uint8Array([2]))));

  const rs = new Uint8Array(4);
  new DataView(rs.buffer).setUint32(0, 4096);
  return concat(salt, rs, new Uint8Array([asPublic.length]), asPublic, sealed);
}

export type PushResult = { ok: boolean; gone: boolean; status: number };

/** Sends one message. `gone` means the browser unsubscribed: forget it. */
export async function sendPush(
  sub: { endpoint: string; p256dh: string; auth: string },
  message: unknown,
  vapid: Vapid,
): Promise<PushResult> {
  const body = await encrypt(enc.encode(JSON.stringify(message)), sub);
  const res = await fetch(sub.endpoint, {
    method: "POST",
    headers: {
      Authorization: await vapidAuth(sub.endpoint, vapid),
      "Content-Encoding": "aes128gcm",
      "Content-Type": "application/octet-stream",
      TTL: String(24 * 60 * 60),
      Urgency: "normal",
    },
    body,
  });
  return { ok: res.ok, gone: res.status === 404 || res.status === 410, status: res.status };
}
