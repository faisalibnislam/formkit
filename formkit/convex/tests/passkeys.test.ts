import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { api, internal } from "../_generated/api";
import { checkAssertion, derToRaw, relyingParty, type Assertion } from "../model/webauthn";
import { b64url } from "../model/webPush";
import { twoFactorPassed } from "../model/identity";
import { backend, person, type Backend } from "./fixtures.helpers";

const enc = new TextEncoder();
const SITE = "https://formkit.app";

/* A small CBOR writer, for the authenticator's side. */
function cbor(value: unknown): Uint8Array {
  const head = (major: number, n: number) =>
    n < 24 ? [(major << 5) | n] : n < 256 ? [(major << 5) | 24, n] : [(major << 5) | 25, n >> 8, n & 255];
  if (typeof value === "number") return new Uint8Array(value >= 0 ? head(0, value) : head(1, -1 - value));
  if (typeof value === "string") {
    const b = enc.encode(value);
    return new Uint8Array([...head(3, b.length), ...b]);
  }
  if (value instanceof Uint8Array) return new Uint8Array([...head(2, value.length), ...value]);
  if (value instanceof Map) {
    const parts = [...value].flatMap(([k, v]) => [...cbor(k), ...cbor(v)]);
    return new Uint8Array([...head(5, value.size), ...parts]);
  }
  throw new Error("unsupported");
}

const sha256 = async (b: Uint8Array<ArrayBuffer>) => new Uint8Array(await crypto.subtle.digest("SHA-256", b));

/** r || s to DER, as an authenticator sends it. */
function rawToDer(raw: Uint8Array) {
  const int = (b: Uint8Array) => {
    let i = 0;
    while (i < b.length - 1 && b[i] === 0) i++;
    let v = b.slice(i);
    if (v[0]! & 0x80) v = new Uint8Array([0, ...v]);
    return [0x02, v.length, ...v];
  };
  const body = [...int(raw.slice(0, 32)), ...int(raw.slice(32))];
  return new Uint8Array([0x30, body.length, ...body]);
}

/** A phone with one passkey on it. */
async function authenticator(rpId = "formkit.app") {
  const keys = (await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"])) as CryptoKeyPair;
  const jwk = await crypto.subtle.exportKey("jwk", keys.publicKey);
  const id = crypto.getRandomValues(new Uint8Array(16));
  let count = 0;
  const b64 = (s: string) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/") + "==".slice(0, (4 - (s.length % 4)) % 4)), (c) => c.charCodeAt(0));
  const cose = new Map<unknown, unknown>([
    [1, 2],
    [3, -7],
    [-1, 1],
    [-2, b64(jwk.x!)],
    [-3, b64(jwk.y!)],
  ]);
  const authData = async (flags: number, extra: Uint8Array = new Uint8Array()) => {
    const c = new Uint8Array(4);
    new DataView(c.buffer).setUint32(0, count);
    return new Uint8Array([...(await sha256(enc.encode(rpId))), flags, ...c, ...extra]);
  };
  return {
    id: b64url(id),
    async create(challenge: string, origin = SITE) {
      const attested = new Uint8Array([...new Uint8Array(16), id.length >> 8, id.length & 255, ...id, ...cbor(cose)]);
      const att = cbor(new Map<unknown, unknown>([["fmt", "none"], ["attStmt", new Map()], ["authData", await authData(0x45, attested)]]));
      return {
        id: b64url(id),
        clientDataJSON: b64url(enc.encode(JSON.stringify({ type: "webauthn.create", challenge, origin }))),
        attestationObject: b64url(att),
        transports: ["internal", "hybrid"],
      };
    },
    async sign(challenge: string, opts: { origin?: string; flags?: number; tamper?: boolean } = {}): Promise<Assertion> {
      count++;
      const data = await authData(opts.flags ?? 0x05);
      const clientDataJSON = enc.encode(JSON.stringify({ type: "webauthn.get", challenge, origin: opts.origin ?? SITE }));
      const signed = new Uint8Array([...data, ...(await sha256(clientDataJSON))]);
      const raw = new Uint8Array(await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, keys.privateKey, signed));
      if (opts.tamper) raw[5] ^= 1;
      return { id: b64url(id), clientDataJSON: b64url(clientDataJSON), authenticatorData: b64url(data), signature: b64url(rawToDer(raw)) };
    },
  };
}

/** What the "passkey" provider in auth.ts does, step by step. */
async function signIn(t: Backend, a: Assertion) {
  const client = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(a.clientDataJSON.replace(/-/g, "+").replace(/_/g, "/") + "==".slice(0, (4 - (a.clientDataJSON.length % 4)) % 4)), (c) => c.charCodeAt(0)))) as { challenge: string };
  const key = await t.mutation(internal.passkeys.forSignIn, { challenge: client.challenge, credentialId: a.id });
  if (!key.ok) throw new Error(key.message);
  const { signCount } = await checkAssertion(a, key, relyingParty());
  return await t.mutation(internal.passkeys.signedIn, { id: key.id, signCount });
}

beforeEach(() => vi.stubEnv("SITE_URL", SITE));
afterEach(() => vi.unstubAllEnvs());

async function withPasskey(t: Backend) {
  const me = await person(t, "owner@example.com");
  const phone = await authenticator();
  const options = await me.as.mutation(api.passkeys.registerOptions, {});
  expect(options.rp.id).toBe("formkit.app");
  await me.as.action(api.passkeys.register, { credential: await phone.create(options.challenge), name: "My phone" });
  return { me, phone };
}

test("a passkey is added, signs in, and the session has passed two-factor", async () => {
  const t = backend();
  const { me, phone } = await withPasskey(t);
  expect(await me.as.query(api.passkeys.list, {})).toMatchObject([{ name: "My phone", lastUsedAt: null }]);

  await t.run(async (ctx) => ctx.db.patch(me.userId, { twoFactor: { secret: "x", enabledAt: Date.now(), recovery: [] } }));
  const { challenge } = await t.mutation(api.passkeys.signInOptions, {});
  const sessionId = await signIn(t, await phone.sign(challenge));
  const session = await t.run(async (ctx) => ctx.db.get(sessionId));
  expect(session?.userId).toBe(me.userId);
  const fresh = t.withIdentity({ subject: `${me.userId}|${sessionId}` });
  expect(await fresh.run(async (ctx) => twoFactorPassed(ctx, (await ctx.db.get(me.userId))!))).toBe(true);
  expect((await fresh.query(api.passkeys.list, {}))[0]!.lastUsedAt).not.toBeNull();
});

test("a challenge works once, and only for signing in", async () => {
  const t = backend();
  const { phone } = await withPasskey(t);
  const { challenge } = await t.mutation(api.passkeys.signInOptions, {});
  await signIn(t, await phone.sign(challenge));
  await expect(signIn(t, await phone.sign(challenge))).rejects.toThrow(/too long/);
});

test("a forged, foreign or unverified sign-in is refused", async () => {
  const t = backend();
  const { phone } = await withPasskey(t);
  const fresh = async () => (await t.mutation(api.passkeys.signInOptions, {})).challenge;
  await expect(signIn(t, await phone.sign(await fresh(), { tamper: true }))).rejects.toThrow(/didn't check out/);
  await expect(signIn(t, await phone.sign(await fresh(), { origin: "https://formkit.app.evil.example" }))).rejects.toThrow(/another site/);
  await expect(signIn(t, await phone.sign(await fresh(), { flags: 0x01 }))).rejects.toThrow(/check it's you/);
  const stranger = await authenticator();
  await expect(signIn(t, await stranger.sign(await fresh()))).rejects.toThrow(/isn't on a Formkit account/);
});

test("a passkey made for another site, or answering someone else's challenge, is not added", async () => {
  const t = backend();
  const me = await person(t, "owner@example.com");
  const other = await person(t, "other@example.com");
  const elsewhere = await authenticator("evil.example");
  const options = await me.as.mutation(api.passkeys.registerOptions, {});
  await expect(me.as.action(api.passkeys.register, { credential: await elsewhere.create(options.challenge) })).rejects.toThrow(/another site/);

  const phone = await authenticator();
  const theirs = await other.as.mutation(api.passkeys.registerOptions, {});
  await expect(me.as.action(api.passkeys.register, { credential: await phone.create(theirs.challenge) })).rejects.toThrow(/too long/);
  expect(await me.as.query(api.passkeys.list, {})).toEqual([]);
});

test("DER signatures convert to r || s, short integers padded", () => {
  const raw = new Uint8Array(64).fill(7);
  raw[0] = 0;
  raw[32] = 0x90;
  expect(derToRaw(rawToDer(raw))).toEqual(raw);
});
