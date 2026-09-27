/**
 * What a message to Ask Formkit is asking for.
 *
 * Shared by the server, which acts on it, and the app, which shows the steps it
 * is working through while it waits. Only "create" spends a credit, so the
 * routing leans away from it: talk is answered as talk, and a request about a
 * form that is already open never quietly becomes a new one.
 */

export type Intent = "create" | "revise" | "append" | "logic" | "theme" | "tone" | "insight" | "chat";

const KIND =
  /\b(form|survey|questionnaire|intake|sign.?up|registration|application|feedback|contact|booking|order|waitlist|poll|rsvp|quiz|check.?in|enquiry|inquiry)\b/;
const ASKS = /^\s*(please\s+)?(build|make|create|draft|write|design|set up|i need|i want|i'd like|give me|a|an|new)\b/i;

export function aiIntent(raw: string, context: { hasForm: boolean; hasDraft: boolean }): Intent {
  const t = raw.trim();
  const p = ` ${t.toLowerCase()} `;
  const has = (re: RegExp) => re.test(p);
  const words = t.split(/\s+/).filter(Boolean).length;

  if (has(/summar|what are people|responses say|insight|read the responses|drop.?off|how many responses|what do (the )?responses/)) {
    return "insight";
  }

  const wantsNew = has(/\b(new|another|different|second|separate) (form|survey|questionnaire)\b/);
  const createAsk = KIND.test(p) && ASKS.test(t) && !has(/\b(this|that|these|the|my) (form|one|survey)\b/);

  // A draft on the table is changed, not replaced — unless a new one is asked for.
  if (context.hasDraft && !wantsNew && !isTalk(t, p, words)) {
    if (!createAsk || has(/\b(it|this|that|instead)\b/)) return "revise";
  }

  if (createAsk || wantsNew) return "create";
  if (has(/\btone\b|reword|rewrite|re-?phrase|friendl|warmer|more formal|less formal|casual|shorter|concise|tighten|plain english|polish|clearer/)) return "tone";
  if (has(/\blogic\b|\brules?\b|conditional|branch|skip logic|only show|only ask|hide |skip (to|ahead)/)) return "logic";
  if (has(/\btheme\b|palette|dark mode|colou?r scheme|brand it|style it|re.?brand|match our brand|look (warmer|darker|lighter)|make it (dark|light|blue|green|pink|warm)/)) return "theme";
  if (has(/add (a |an |another |some |two |three )?(question|field)s?|also ask|ask (them |people )?(about|for|how|what|if|whether)|include a|collect (their|an?|the)/)) return "append";
  if (isTalk(t, p, words)) return "chat";
  if (KIND.test(p) && !context.hasForm) return "create";
  return context.hasForm ? "chat" : words >= 5 ? "create" : "chat";
}

function isTalk(t: string, p: string, words: number) {
  if (/^\s*(hi|hey|hello|yo|hiya|morning|afternoon|evening|good (morning|afternoon|evening))\b/.test(p)) return true;
  if (/\b(thanks|thank you|cheers|ta|nice one|great|perfect|cool|ok|okay|got it|never mind|nevermind|bye)\b/.test(p) && words <= 4) return true;
  if (/what can you do|who are you|what are you|how do(es)? (this|it|you) work|what is this|help me|can you help|how many credits|credits left|what do you cost|how much/.test(p)) return true;
  if (/\?\s*$/.test(t) && !ASKS.test(t)) return true;
  return words <= 3 && !ASKS.test(t);
}

/** What the app shows, one line at a time, while the request is out. */
export function aiPlan(intent: Intent, source?: string) {
  const read = source ? `Reading ${source}` : "Reading what you asked for";
  switch (intent) {
    case "create":
      return [read, "Choosing the questions", "Setting types and required fields", "Writing the welcome and thank-you"];
    case "revise":
      return ["Reading the draft", "Making the change", "Checking the questions still read well"];
    case "append":
      return [read, "Finding where these belong", "Writing the new questions"];
    case "logic":
      return ["Looking at your choice questions", "Working out what to branch on", "Writing the rules"];
    case "theme":
      return ["Reading the brief for a mood", "Matching it to a theme", "Checking contrast"];
    case "tone":
      return ["Reading every question", "Rewriting in the tone you asked for", "Keeping the meaning intact"];
    case "insight":
      return ["Collecting your responses", "Looking for patterns", "Writing it up"];
    default:
      return [];
  }
}
