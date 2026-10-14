import { expect, test } from "vitest";
import { api } from "../_generated/api";
import { backend, person } from "./fixtures.helpers";

type T = ReturnType<typeof backend>;

function client(t: T, key: string) {
  return async (method: string, path: string, body?: unknown) => {
    const res = await t.fetch(`/api/v2/${path}`, {
      method,
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- whatever JSON the API sent
    return { status: res.status, body: (await res.json()) as Record<string, any> };
  };
}

const SPEC = {
  title: "Event sign-up",
  welcome: { title: "Join us", message: "Two quick questions." },
  items: [
    { type: "name", title: "Your name", required: true },
    { type: "single-choice", title: "Which day suits you?", options: ["Friday", "Saturday"] },
    { type: "long-text", title: "Anything we should know? Colour preferences, say." },
  ],
};

test("a Free account builds, edits and publishes a form through the API", async () => {
  const t = backend();
  const owner = await person(t, "owner@example.com");
  const key = await owner.as.mutation(api.controls.createApiKey, {
    name: "Assistant",
    scopes: ["forms:read", "forms:write", "forms:publish", "responses:read", "responses:write"],
  });
  const call = client(t, key);

  const made = await call("POST", "forms", SPEC);
  expect(made.status).toBe(201);
  expect(made.body.status).toBe("draft");
  expect(made.body.questions.map((q: { title: string }) => q.title)).toEqual([
    "Your name",
    "Which day suits you?",
    // The person's own words are kept, not put into house style.
    "Anything we should know? Colour preferences, say.",
  ]);
  const [name, day, notes] = made.body.questions.map((q: { id: string }) => q.id);

  const edited = await call("PATCH", `forms/${made.body.id}`, {
    title: "Summer event sign-up",
    ops: [
      { op: "add", question: { type: "email", title: "Your email", required: true }, after: name },
      { op: "update", id: day, options: ["Friday", "Saturday", "Sunday"] },
      { op: "move", id: notes, after: null },
      { op: "remove", id: notes },
    ],
  });
  expect(edited.status).toBe(200);
  expect(edited.body.title).toBe("Summer event sign-up");
  expect(edited.body.questions.map((q: { title: string }) => q.title)).toEqual(["Your name", "Your email", "Which day suits you?"]);
  expect(edited.body.questions[2].options).toEqual(["Friday", "Saturday", "Sunday"]);

  const bad = await call("PATCH", `forms/${made.body.id}`, { ops: [{ op: "update", id: "nope", title: "x" }] });
  expect(bad.status).toBe(422);

  const live = await call("POST", `forms/${made.body.id}/publish`);
  expect(live.status).toBe(200);
  expect(live.body.status).toBe("published");
  expect(live.body.url).toBeTruthy();
  expect(live.body.unpublishedChanges).toBe(0);

  const { responseId } = await t.mutation(api.publicForm.submit, {
    formId: made.body.id,
    partial: false,
    answers: [
      { blockId: name, value: "Ada" },
      { blockId: edited.body.questions[1].id, value: "ada@example.com" },
      { blockId: day, value: "Sunday" },
    ],
  });
  const list = await call("GET", `forms/${made.body.id}/responses?limit=10`);
  expect(list.status).toBe(200);
  expect(list.body.data).toHaveLength(1);
  expect(list.body.data[0].respondent.email).toBe("ada@example.com");

  const tagged = await call("PATCH", `responses/${responseId}`, { status: "reviewed", addTags: ["VIP"] });
  expect(tagged.body).toMatchObject({ status: "reviewed", tags: ["VIP"] });

  const closed = await call("POST", `forms/${made.body.id}/close`);
  expect(closed.body.status).toBe("closed");
  const reopened = await call("POST", `forms/${made.body.id}/reopen`);
  expect(reopened.body.status).toBe("published");

  // Summaries and insights are Pro.
  expect((await call("GET", `forms/${made.body.id}/summary`)).status).toBe(403);
});

test("a key does only what it was given, on its own account's forms", async () => {
  const t = backend();
  const owner = await person(t, "owner@example.com");
  const other = await person(t, "other@example.com");
  const readOnly = client(t, await owner.as.mutation(api.controls.createApiKey, { name: "Reader", scopes: ["forms:read"] }));
  const writer = client(t, await owner.as.mutation(api.controls.createApiKey, { name: "Writer", scopes: ["forms:write", "forms:read"] }));
  const theirs = client(t, await other.as.mutation(api.controls.createApiKey, { name: "Theirs", scopes: ["forms:read", "forms:write"] }));

  expect((await readOnly("POST", "forms", SPEC)).status).toBe(403);
  const made = await writer("POST", "forms", SPEC);
  expect(made.status).toBe(201);
  expect((await writer("POST", `forms/${made.body.id}/publish`)).status).toBe(403);
  expect((await writer("GET", `forms/${made.body.id}/responses`)).status).toBe(403);
  expect((await theirs("GET", `forms/${made.body.id}`)).status).toBe(404);
  expect((await theirs("PATCH", `forms/${made.body.id}`, { title: "Mine now" })).status).toBe(404);
  expect((await readOnly("GET", "forms")).body.data).toHaveLength(1);

  const nobody = await t.fetch("/api/v2/forms", { headers: { Authorization: "Bearer fk_live_" + "0".repeat(48) } });
  expect(nobody.status).toBe(401);
  // There is no way to delete anything.
  const del = await t.fetch(`/api/v2/forms/${made.body.id}`, { method: "DELETE", headers: { Authorization: "Bearer x" } });
  expect(del.status).toBe(404);
});

test("a Pro key reads a form's summary", async () => {
  const t = backend();
  const owner = await person(t, "owner@example.com");
  await t.run((ctx) => ctx.db.patch(owner.userId, { plan: "pro", planStatus: "active" } as never));
  const call = client(t, await owner.as.mutation(api.controls.createApiKey, { name: "Pro", scopes: ["forms:write", "forms:publish", "insights:read"] }));
  const made = await call("POST", "forms", SPEC);
  await call("POST", `forms/${made.body.id}/publish`);
  const day = made.body.questions[1].id;
  for (const pick of ["Friday", "Friday", "Saturday"]) {
    await t.mutation(api.publicForm.submit, {
      formId: made.body.id,
      partial: false,
      answers: [
        { blockId: made.body.questions[0].id, value: "Someone" },
        { blockId: day, value: pick },
      ],
      deviceId: crypto.randomUUID(),
    } as never);
  }
  const summary = await call("GET", `forms/${made.body.id}/summary`);
  expect(summary.status).toBe(200);
  expect(summary.body.read).toBe(3);
  expect(JSON.stringify(summary.body.questions)).toContain("Friday");
  const insights = await call("GET", `forms/${made.body.id}/insights`);
  expect(insights.body.report).toBeNull();
});
