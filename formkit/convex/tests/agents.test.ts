import { expect, test } from "vitest";
import { api } from "../_generated/api";
import { backend, form, person, type Backend } from "./fixtures.helpers";

async function setup(t: Backend, extra: Record<string, unknown> = {}) {
  const owner = await person(t, "owner@example.com");
  const formId = await form(t, owner.userId, { slug: "book-a-call", ...extra });
  const name = await owner.as.mutation(api.blocks.add, { formId, kind: "field", type: "short-text", title: "Your name", required: true });
  const email = await owner.as.mutation(api.blocks.add, { formId, kind: "field", type: "email", title: "Email", required: true });
  await owner.as.mutation(api.blocks.add, { formId, kind: "field", type: "single-choice", title: "When suits?", options: ["Morning", "Afternoon"] });
  await owner.as.mutation(api.blocks.add, { formId, kind: "field", type: "file", title: "Anything to share?" });
  return { owner, formId, name, email };
}

const get = (t: Backend) => t.fetch("/agent/forms/book-a-call", { method: "GET" });
const post = (t: Backend, body: unknown, ip = "203.0.113.7") =>
  t.fetch("/agent/forms/book-a-call", { method: "POST", headers: { "Content-Type": "application/json", "X-Forwarded-For": ip }, body: JSON.stringify(body) });

test("a form is closed to agents until its owner lets them in", async () => {
  const t = backend();
  const { owner, formId } = await setup(t);
  expect((await get(t)).status).toBe(403);
  await owner.as.mutation(api.agents.setEnabled, { formId, on: true });
  const res = await get(t);
  expect(res.status).toBe(200);
  const body = await res.json();
  expect(body.fillable).toBe(true);
  // An upload needs the person themselves, so it isn't offered.
  expect(body.questions.map((q: { title: string }) => q.title)).toEqual(["Your name", "Email", "When suits?"]);
  expect(body.questions[2]).toMatchObject({ options: ["Morning", "Afternoon"], required: false });
});

test("an agent's answers are checked like anyone's, then kept and labelled", async () => {
  const t = backend();
  const { owner, formId, name, email } = await setup(t, { agents: true });

  const missing = await post(t, { agent: { name: "Ada" }, answers: { [name]: "Sam Lee" } });
  expect(missing.status).toBe(422);
  expect((await missing.json()).problems[0]).toMatchObject({ question: email });

  const wrong = await post(t, { agent: { name: "Ada" }, answers: { [name]: "Sam", nope: "x" } });
  expect(wrong.status).toBe(422);
  expect((await wrong.json()).unknown).toEqual(["nope"]);

  const ok = await post(t, { agent: { name: "Ada", url: "https://ada.example" }, onBehalfOf: "Sam Lee", answers: { [name]: "Sam Lee", [email]: "sam@example.com" } });
  expect(ok.status).toBe(201);
  expect((await ok.json()).receipt).toMatch(/\/receipt\//);
  const saved = await t.run(async (ctx) => ctx.db.query("responses").withIndex("by_form", (q) => q.eq("formId", formId)).first());
  expect(saved).toMatchObject({ partial: false, device: "AI agent", agent: { name: "Ada", url: "https://ada.example", forWhom: "Sam Lee" } });
  expect(saved?.respondentEmail).toBe("sam@example.com");
  void owner;
});

test("spam, and too many from one caller, are turned away", async () => {
  const t = backend();
  const { name, email } = await setup(t, { agents: true });
  const spam = await post(t, { agent: { name: "Bot" }, answers: { [name]: "Cheap SEO services and backlinks packages", [email]: "a@b.co" } });
  expect(spam.status).toBe(422);
  expect((await spam.json()).error).toMatch(/spam/);

  for (let i = 0; i < 10; i++) {
    expect((await post(t, { agent: { name: "Ada" }, answers: { [name]: `Person ${i}`, [email]: `p${i}@example.com` } }, "198.51.100.1")).status).toBe(201);
  }
  expect((await post(t, { agent: { name: "Ada" }, answers: { [name]: "One more", [email]: "x@example.com" } }, "198.51.100.1")).status).toBe(429);
  // Someone else's agent still gets through.
  expect((await post(t, { agent: { name: "Ada" }, answers: { [name]: "Other", [email]: "o@example.com" } }, "198.51.100.2")).status).toBe(201);
});

test("a form an agent can't complete says why", async () => {
  const t = backend();
  await setup(t, { agents: true, security: { multiple: true, editAfter: false, password: true, spam: true, rateLimit: true, requireEmail: false, passwordHash: "x", passwordSalt: "y" } });
  const body = await (await get(t)).json();
  expect(body.fillable).toBe(false);
  expect(body.reason).toMatch(/password/);
  expect((await post(t, { agent: { name: "Ada" }, answers: {} })).status).toBe(403);
});

test("the kill switch pauses every form for agents", async () => {
  const t = backend();
  await setup(t, { agents: true });
  await t.run(async (ctx) => {
    await ctx.db.insert("featureFlags", { key: "forms.agents", label: "Agents", description: "", enabled: false, rollout: 100 });
  });
  expect((await get(t)).status).toBe(503);
});
