/**
 * Secrets kept at rest encrypted: a customer's Stripe key (and, later, the
 * OAuth tokens of integrations). AES-256-GCM with a key held only in the
 * Convex deployment's environment (`SECRETS_KEY`, 32 random bytes in
 * base64: `openssl rand -base64 32`), so a copy of the database alone
 * reveals nothing.
 *
 * Sealed values look like `v1:<base64 of iv + ciphertext>`. Anything else is
 * a value stored before this existed, read as it is. Without `SECRETS_KEY`
 * values are kept as they come, so a deployment that has not set it yet
 * keeps working.
 */

const PREFIX = "v1:";

function b64(bytes: Uint8Array) {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}
function unb64(text: string) {
  const s = atob(text);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

async function key(): Promise<CryptoKey | null> {
  const raw = process.env.SECRETS_KEY;
  if (!raw) return null;
  const bytes = unb64(raw.trim());
  if (bytes.length !== 32) throw new Error("SECRETS_KEY must be 32 bytes, base64 encoded (openssl rand -base64 32).");
  return crypto.subtle.importKey("raw", bytes, "AES-GCM", false, ["encrypt", "decrypt"]);
}

export const isSealed = (value: string) => value.startsWith(PREFIX);

export async function seal(plain: string): Promise<string> {
  const k = await key();
  if (!k) return plain;
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, k, new TextEncoder().encode(plain)));
  const both = new Uint8Array(iv.length + ct.length);
  both.set(iv);
  both.set(ct, iv.length);
  return PREFIX + b64(both);
}

export async function unseal(stored: string): Promise<string> {
  if (!isSealed(stored)) return stored;
  const k = await key();
  if (!k) throw new Error("This secret is encrypted, but SECRETS_KEY is not set on the deployment.");
  const both = unb64(stored.slice(PREFIX.length));
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: both.slice(0, 12) }, k, both.slice(12));
  return new TextDecoder().decode(plain);
}
