import { afterEach, expect, test, vi } from "vitest";
import { api, internal } from "../_generated/api";
import { b64url, encrypt, fromB64url, vapidAuth } from "../model/webPush";
import { notify } from "../model/inbox";
import { backend, person, type Backend } from "./fixtures.helpers";

const enc = new TextEncoder();

/** A browser's side of a subscription: its key pair and auth secret. */
async function browser() {
  const keys = (await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"])) as CryptoKeyPair;
  const p256dh = b64url(new Uint8Array(await crypto.subtle.exportKey("raw", keys.publicKey)));
  const auth = b64url(crypto.getRandomValues(new Uint8Array(16)));
  return { keys, p256dh, auth };
}

async function hkdf(salt: Uint8Array<ArrayBuffer>, ikm: Uint8Array<ArrayBuffer>, info: string | Uint8Array<ArrayBuffer>, n: number) {
  const key = await crypto.subtle.importKey("raw", ikm, "HKDF", false, ["deriveBits"]);
  const i = typeof info === "string" ? enc.encode(info) : info;
  return new Uint8Array(await crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt, info: i }, key, n * 8));
}

/** What the browser does with a message (RFC 8291), written out separately. */
async function decrypt(body: Uint8Array<ArrayBuffer>, b: Awaited<ReturnType<typeof browser>>) {
  const salt = body.slice(0, 16);
  const idlen = body[20]!;
  const asPublic = body.slice(21, 21 + idlen);
  const sealed = body.slice(21 + idlen);
  const asKey = await crypto.subtle.importKey("raw", asPublic, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: "ECDH", public: asKey }, b.keys.privateKey, 256));
  const uaPublic = fromB64url(b.p256dh);
  const info = new Uint8Array([...enc.encode("WebPush: info\0"), ...uaPublic, ...asPublic]);
  const ikm = await hkdf(fromB64url(b.auth), shared, info, 32);
  const cek = await hkdf(salt, ikm, "Content-Encoding: aes128gcm\0", 16);
  const nonce = await hkdf(salt, ikm, "Content-Encoding: nonce\0", 12);
  const aes = await crypto.subtle.importKey("raw", cek, "AES-GCM", false, ["decrypt"]);
  const plain = new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM", iv: nonce }, aes, sealed));
  expect(plain[plain.length - 1]).toBe(2);
  return new TextDecoder().decode(plain.slice(0, -1));
}

async function vapidKeys() {
  const pair = (await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"])) as CryptoKeyPair;
  const jwk = await crypto.subtle.exportKey("jwk", pair.privateKey);
  const raw = new Uint8Array(await crypto.subtle.exportKey("raw", pair.publicKey));
  return { pair, publicKey: b64url(raw), privateKey: jwk.d! };
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

test("a message is encrypted so only that browser can read it", async () => {
  const b = await browser();
  const body = await encrypt(enc.encode(JSON.stringify({ title: "New response" })), b);
  expect(new DataView(body.buffer).getUint32(16)).toBe(4096);
  expect(JSON.parse(await decrypt(body, b))).toEqual({ title: "New response" });

  const stranger = await browser();
  await expect(decrypt(body, { ...stranger, p256dh: b.p256dh, auth: b.auth })).rejects.toThrow();
});

test("the VAPID header is a signed token for the push service's origin", async () => {
  const k = await vapidKeys();
  const header = await vapidAuth("https://fcm.googleapis.com/fcm/send/abc", { ...k, subject: "mailto:ops@example.com" }, 1_700_000_000_000);
  const [, token, key] = /^vapid t=([^,]+), k=(.+)$/.exec(header)!;
  expect(key).toBe(k.publicKey);
  const [h, c, s] = token!.split(".");
  expect(JSON.parse(new TextDecoder().decode(fromB64url(c!)))).toEqual({ aud: "https://fcm.googleapis.com", exp: 1_700_000_000 + 43_200, sub: "mailto:ops@example.com" });
  const ok = await crypto.subtle.verify({ name: "ECDSA", hash: "SHA-256" }, k.pair.publicKey, fromB64url(s!), enc.encode(`${h}.${c}`));
  expect(ok).toBe(true);
});

async function subscribed(t: Backend) {
  const me = await person(t, "owner@example.com");
  const b = await browser();
  await me.as.mutation(api.push.subscribe, { endpoint: "https://push.example.com/send/1", p256dh: b.p256dh, auth: b.auth, userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/130.0 Safari/537.36" });
  return { me, b };
}

test("a mention reaches a signed-up device, encrypted, and a dead device is forgotten", async () => {
  vi.useFakeTimers();
  try {
    const k = await vapidKeys();
    vi.stubEnv("VAPID_PUBLIC_KEY", k.publicKey);
    vi.stubEnv("VAPID_PRIVATE_KEY", k.privateKey);
    const t = backend();
    const { me, b } = await subscribed(t);
    const sent: Uint8Array<ArrayBuffer>[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init: RequestInit) => {
        sent.push(new Uint8Array(init.body as ArrayBuffer));
        return new Response(null, { status: sent.length === 1 ? 201 : 410 });
      }),
    );

    await t.run(async (ctx) => notify(ctx, me.userId, { kind: "mention", title: "Sam mentioned you", href: "/app/forms/x" }));
    // Something that isn't worth a buzz stays in the bell.
    await t.run(async (ctx) => notify(ctx, me.userId, { kind: "published", title: "Your form is live" }));
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect(sent).toHaveLength(1);
    expect(JSON.parse(await decrypt(sent[0]!, b))).toMatchObject({ title: "Sam mentioned you", href: "/app/forms/x" });
    expect((await me.as.query(api.push.config, {})).devices[0]).toMatchObject({ device: "Chrome on macOS" });

    await t.run(async (ctx) => notify(ctx, me.userId, { kind: "assigned", title: "You have a response" }));
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect(await t.query(internal.push.devicesOf, { userId: me.userId })).toHaveLength(0);
  } finally {
    vi.useRealTimers();
  }
});

test("switched-off kinds, and push switched off, send nothing", async () => {
  vi.useFakeTimers();
  try {
    const k = await vapidKeys();
    vi.stubEnv("VAPID_PUBLIC_KEY", k.publicKey);
    vi.stubEnv("VAPID_PRIVATE_KEY", k.privateKey);
    const t = backend();
    const { me } = await subscribed(t);
    const fetch = vi.fn(async () => new Response(null, { status: 201 }));
    vi.stubGlobal("fetch", fetch);

    await me.as.mutation(api.push.setPrefs, { approvals: false });
    await t.run(async (ctx) => notify(ctx, me.userId, { kind: "approval", title: "Approve this?" }));
    await t.run(async (ctx) => {
      await ctx.db.insert("featureFlags", { key: "notify.push", label: "Push", description: "", enabled: false, rollout: 100 });
    });
    await t.run(async (ctx) => notify(ctx, me.userId, { kind: "mention", title: "Sam mentioned you" }));
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect(fetch).not.toHaveBeenCalled();
    expect((await me.as.query(api.push.config, {})).publicKey).toBeNull();
  } finally {
    vi.useRealTimers();
  }
});

test("a bad push address is refused", async () => {
  const t = backend();
  const me = await person(t, "owner@example.com");
  const b = await browser();
  await expect(me.as.mutation(api.push.subscribe, { endpoint: "http://localhost/x", p256dh: b.p256dh, auth: b.auth })).rejects.toThrow(/push address/);
});
