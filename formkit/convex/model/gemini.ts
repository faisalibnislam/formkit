/**
 * The model behind Ask Formkit: Google's Gemini API.
 *
 * The key lives in the Convex deployment's environment as GEMINI_API_KEY and
 * never reaches the browser. GEMINI_MODEL, if set, is tried first; after it the
 * list below runs newest first, so a model that is busy (503), rate-limited
 * (429) or retired (404) hands the request on rather than failing it.
 */

const MODELS = ["gemini-3.8-flash", "gemini-3.5-flash", "gemini-flash-latest", "gemini-2.5-flash"];
const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";

/** Statuses worth trying the next model for; anything else is final. */
const HAND_ON = new Set([404, 408, 429, 500, 502, 503, 504]);

export class ModelError extends Error {
  constructor(
    message: string,
    public reason: "no-key" | "timeout" | "busy" | "refused" | "empty",
  ) {
    super(message);
  }
}

export function modelConfigured() {
  return Boolean(process.env.GEMINI_API_KEY);
}

export type Part = { text: string } | { inlineData: { mimeType: string; data: string } };

type Turn = { role: "user" | "model"; parts: Part[] };

export async function generate({
  system,
  turns,
  schema,
  maxTokens = 2048,
  timeoutMs = 40_000,
  temperature = 0.6,
}: {
  system: string;
  turns: Turn[];
  /** An OpenAPI-style schema; the reply is then JSON that matches it. */
  schema?: Record<string, unknown>;
  maxTokens?: number;
  /** For the whole request, across every model tried. */
  timeoutMs?: number;
  temperature?: number;
}): Promise<{ text: string; model: string }> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    throw new ModelError("Ask Formkit has no model key yet. Set GEMINI_API_KEY on the Convex deployment.", "no-key");
  }

  const models = [process.env.GEMINI_MODEL, ...MODELS].filter(
    (m, i, all): m is string => Boolean(m) && all.indexOf(m) === i,
  );
  const deadline = Date.now() + timeoutMs;
  const body = JSON.stringify({
    systemInstruction: { parts: [{ text: system }] },
    contents: turns,
    generationConfig: {
      maxOutputTokens: maxTokens,
      temperature,
      ...(schema ? { responseMimeType: "application/json", responseSchema: schema } : {}),
    },
  });

  let last: ModelError = new ModelError("The model is busy right now. Try again in a minute.", "busy");
  for (const model of models) {
    const left = deadline - Date.now();
    if (left < 1500) {
      last = new ModelError("That took longer than it should. Try again in a minute.", "timeout");
      break;
    }
    const abort = new AbortController();
    const timer = setTimeout(() => abort.abort(), left);
    let response: Response;
    try {
      response = await fetch(`${ENDPOINT}/${model}:generateContent`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-goog-api-key": key },
        body,
        signal: abort.signal,
      });
    } catch {
      clearTimeout(timer);
      last = new ModelError("That took longer than it should. Try again in a minute.", "timeout");
      if (Date.now() >= deadline) break;
      continue;
    }
    clearTimeout(timer);

    if (!response.ok) {
      if (HAND_ON.has(response.status)) {
        last = new ModelError("The model is busy right now. Try again in a minute.", "busy");
        continue;
      }
      // A bad key or a blocked request: another model will say the same.
      const detail = (await response.text()).slice(0, 160);
      console.error(`Gemini ${model} refused: ${response.status} ${detail}`);
      throw new ModelError("The model refused that request.", "refused");
    }

    const payload = (await response.json()) as {
      candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] }; finishReason?: string }[];
      promptFeedback?: { blockReason?: string };
    };
    if (payload.promptFeedback?.blockReason) {
      throw new ModelError("The model would not answer that. Try saying it another way.", "refused");
    }
    const text = (payload.candidates?.[0]?.content?.parts ?? [])
      .filter((p) => !p.thought)
      .map((p) => p.text ?? "")
      .join("")
      .trim();
    if (!text) {
      last = new ModelError("The model sent back nothing. Try again.", "empty");
      continue;
    }
    return { text, model };
  }
  throw last;
}

/** JSON from a reply, forgiving a stray sentence or a code fence around it. */
export function parseJson<T>(text: string): T | null {
  const trimmed = text.replace(/^```(?:json)?\s*|\s*```$/g, "");
  for (const candidate of [trimmed, trimmed.slice(trimmed.indexOf("{"), trimmed.lastIndexOf("}") + 1)]) {
    try {
      return JSON.parse(candidate) as T;
    } catch {
      /* try the next reading */
    }
  }
  return null;
}

/**
 * House voice. Models read "sentence case" as licence for all-lowercase now
 * and then, and drift into American spelling; both are corrected here rather
 * than trusted to the prompt.
 */
export function voice(input: string) {
  let out = String(input)
    .replace(/\b(summar|personal|organ|recogn|analy|priorit|custom|optim|minim|maxim|categor)iz(e|es|ed|ing|ation|ations)\b/gi, (m, a, b) => `${a}is${b}`)
    .replace(/\bcolor(s|ed|ing|ful)?\b/g, (m) => `colour${m.slice(5)}`)
    .replace(/\bColor(s|ed|ing|ful)?\b/g, (m) => `Colour${m.slice(5)}`)
    .replace(/\bfavorite(s)?\b/g, (m) => `favourite${m.slice(8)}`)
    .replace(/\bcenter(s|ed)?\b/g, (m) => `centre${m.slice(6)}`)
    .replace(/\bi\b/g, "I");
  out = out.replace(/(^|[.!?]\s+|\n\s*)([a-z])/g, (m, pre: string, ch: string) => pre + ch.toUpperCase());
  return out.trim();
}
