import { v, type ObjectType } from "convex/values";

/**
 * The shape of a sent form, on its own so publicForm and payments can both
 * use it without importing each other at load time.
 */

export const answerArg = v.object({
  blockId: v.id("blocks"),
  value: v.optional(v.string()),
  values: v.optional(v.array(v.string())),
  fileId: v.optional(v.id("_storage")),
  fileName: v.optional(v.string()),
  followUp: v.optional(v.object({ question: v.string(), answer: v.string() })),
});

/** What a form sends: the public link, the agent API and a payment hold all take this. */
export const submitArgs = {
  formId: v.id("forms"),
  partial: v.boolean(),
  device: v.optional(v.string()),
  source: v.optional(v.string()),
  durationMs: v.optional(v.number()),
  resumeToken: v.optional(v.string()),
  deviceId: v.optional(v.string()),
  password: v.optional(v.string()),
  /** The field only a script fills in. */
  trap: v.optional(v.string()),
  /** The person ticked "I am a person" after being asked. */
  human: v.optional(v.boolean()),
  /** A Turnstile check that passed (verifyHuman), spent by this submission. */
  pass: v.optional(v.id("humanPasses")),
  /** The link's utm_ tags. */
  utm: v.optional(
    v.object({
      source: v.optional(v.string()),
      medium: v.optional(v.string()),
      campaign: v.optional(v.string()),
      term: v.optional(v.string()),
      content: v.optional(v.string()),
    }),
  ),
  /** The ending the person's answers led to, when it was not the default. */
  ending: v.optional(v.string()),
  /** Quiz: the attempt started when the timer began, and whether it ran out. */
  attemptId: v.optional(v.id("quizAttempts")),
  timedOut: v.optional(v.boolean()),
  answers: v.array(answerArg),
};

export type SubmitArgs = ObjectType<typeof submitArgs>;
