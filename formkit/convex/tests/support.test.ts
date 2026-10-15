import { afterEach, expect, test, vi } from "vitest";
import { api } from "../_generated/api";
import { backend, person } from "./fixtures.helpers";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

/** Resend, as far as the tests need it: remembers what was sent. */
function fakeResend() {
  const sent: { to: string[]; subject: string; html?: string; text?: string }[] = [];
  vi.stubEnv("AUTH_RESEND_KEY", "re_test");
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: string, init?: RequestInit) => {
      sent.push(JSON.parse(String(init?.body)));
      return Response.json({ id: "email_1" });
    }),
  );
  return sent;
}

test("someone without an account writes in, gets the private link, and reads and replies there", async () => {
  vi.useFakeTimers();
  const t = backend();
  const sent = fakeResend();
  await t.mutation(api.support.openAsGuest, { name: "Sam", email: "Sam@Example.com", subject: "Pricing question", body: "Do you do discounts?" });
  await t.finishAllScheduledFunctions(vi.runAllTimers);
  expect(sent[0]).toMatchObject({ to: ["sam@example.com"], subject: "We have your message: Pricing question" });
  const token = /\/support\/([0-9a-f]{40})/.exec(sent[0]!.text!)![1]!;

  const thread = await t.query(api.support.thread, { token });
  expect(thread).toMatchObject({ subject: "Pricing question", state: "open", messages: [{ who: "Sam", body: "Do you do discounts?" }] });
  await t.mutation(api.support.replyByToken, { token, body: "Also, for charities?" });
  expect((await t.query(api.support.thread, { token }))!.messages).toHaveLength(2);
  expect(await t.query(api.support.thread, { token: "0".repeat(40) })).toBeNull();
});

test("a staff answer is emailed in full, with the link back", async () => {
  vi.useFakeTimers();
  const t = backend();
  const sent = fakeResend();
  const me = await person(t, "maya@studionine.co");
  const staff = await person(t, "staff@formkit.app");
  await t.run((ctx) => ctx.db.patch(staff.userId, { staffRole: "owner" } as never));
  const ticketId = await me.as.mutation(api.support.open, { subject: "Payments", body: "Not showing as paid" });

  await staff.as.mutation(api.admin.replyToTicket, { ticketId, body: "Fixed: the webhook was missing. Try again now." });
  await t.finishAllScheduledFunctions(vi.runAllTimers);
  const mail = sent.find((m) => m.subject === "Re: Payments")!;
  expect(mail.to).toEqual(["maya@studionine.co"]);
  expect(mail.text).toContain("Fixed: the webhook was missing.");
  expect(mail.html).toMatch(/\/support\/[0-9a-f]{40}/);

  // Replying in the app opens it again.
  await me.as.mutation(api.support.reply, { ticketId, body: "Works now, thanks" });
  expect((await me.as.query(api.support.mine, {})).tickets[0]).toMatchObject({ state: "open" });
});

test("a script filling the hidden field is turned away quietly, and one address can't flood the queue", async () => {
  const t = backend();
  fakeResend();
  await t.mutation(api.support.openAsGuest, { name: "Bot", email: "bot@example.com", subject: "Hi", body: "Buy", trap: "https://spam.example" });
  expect(await t.run((ctx) => ctx.db.query("tickets").collect())).toHaveLength(0);
  for (let i = 0; i < 3; i++) await t.mutation(api.support.openAsGuest, { name: "", email: "a@example.com", subject: `Q${i}`, body: "?" });
  await expect(t.mutation(api.support.openAsGuest, { name: "", email: "a@example.com", subject: "Q4", body: "?" })).rejects.toThrow(/from this address/);
});
