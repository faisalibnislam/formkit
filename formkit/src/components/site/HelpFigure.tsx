import { MousePointerClick } from "lucide-react";
import { SCENES } from "@/components/site/scenes";

/**
 * A live picture of the thing an article explains, at the top of the
 * article: the same drawn scenes the feature pages use, so the help centre
 * shows the app rather than describing it. Articles without a fitting scene
 * show nothing.
 */

const FOR_ARTICLE: Record<string, { scene: string; caption: string }> = {
  "logic-basics": { scene: "logic", caption: "Pick an answer and watch the path through the form change." },
  "logic-skip": { scene: "logic", caption: "Choose an answer: the map shows which pages it skips." },
  "logic-show-hide": { scene: "logic", caption: "Each answer shows or hides what follows. Try one." },
  "logic-groups": { scene: "logic", caption: "One rule per line, and the path it sends people down." },
  "logic-map": { scene: "logic", caption: "The logic map: every path through the form at once." },
  "logic-ai": { scene: "logic", caption: "Switch to AI decides and pick an answer for the AI to read." },
  "ai-what": { scene: "ai-form-builder", caption: "Pick a prompt and watch Ask Formkit draft the form." },
  "ai-credits": { scene: "ai-form-builder", caption: "Each form the AI builds counts as one build." },
  quizzes: { scene: "quizzes", caption: "Answer before the clock runs out; each answer is marked as you go." },
  "quiz-results": { scene: "quizzes", caption: "Finish the quiz to see the mark and the pass mark." },
  "ai-replies": { scene: "ai-replies", caption: "Change the instructions and the reply changes with them." },
  "ai-replies-allowance": { scene: "ai-replies", caption: "Each response the AI replies to counts once." },
  "ai-insights": { scene: "insights", caption: "Switch the period, or ask for a written report." },
  payments: { scene: "payments", caption: "Change the booking, then pay: the response turns to Paid." },
  calculations: { scene: "payments", caption: "The total is a calculation: places times the price, plus lunch." },
  webhooks: { scene: "integrations", caption: "Switch connections on and off, then send a test response." },
  slack: { scene: "integrations", caption: "A new response goes to Slack, and anywhere else that is on." },
  "google-sheets": { scene: "integrations", caption: "A new response lands in your sheet on its next refresh." },
  "custom-domain": { scene: "branding", caption: "Turn on your own domain: the link changes and the badge goes." },
  "pick-theme": { scene: "branding", caption: "Try Formkit's ten themes on the same form." },
  "colours-type": { scene: "branding", caption: "Themes, type and your own domain, on one form." },
  logos: { scene: "branding", caption: "Your logo and colours on every page of the form." },
};

export function HelpFigure({ id }: { id: string }) {
  const f = FOR_ARTICLE[id];
  const entry = f ? SCENES[f.scene] : undefined;
  if (!f || !entry) return null;
  const { Scene } = entry;
  return (
    <figure className="fk-help-figure">
      <div className="fk-help-figure-stage">
        <Scene />
      </div>
      <figcaption>
        <MousePointerClick size={15} strokeWidth={2} aria-hidden /> {f.caption}
      </figcaption>
    </figure>
  );
}
