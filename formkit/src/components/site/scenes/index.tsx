import type { ComponentType } from "react";
import { MousePointerClick } from "lucide-react";
import type { SceneProps } from "./shared";
import { AiBuildScene } from "./AiBuildScene";
import { LogicScene } from "./LogicScene";
import { QuizScene } from "./QuizScene";
import { ReplyScene } from "./ReplyScene";
import { InsightsScene } from "./InsightsScene";
import { PaymentScene } from "./PaymentScene";
import { ConnectScene } from "./ConnectScene";
import { BrandScene } from "./BrandScene";
import { DragScene } from "@/components/landing/DragScene";
import { VersionsScene } from "@/components/landing/VersionsScene";
import { DomainScene } from "@/components/landing/DomainScene";

/** Each feature page's scene, and what to try in it. */
export const SCENES: Record<string, { Scene: ComponentType<SceneProps>; hint: string }> = {
  "ai-form-builder": { Scene: AiBuildScene, hint: "Pick a prompt and watch it build" },
  builder: { Scene: DragScene, hint: "Watch a field dropped in and a question moved" },
  logic: { Scene: LogicScene, hint: "Choose an answer, or let the AI decide" },
  quizzes: { Scene: QuizScene, hint: "Answer before the clock runs out" },
  "ai-replies": { Scene: ReplyScene, hint: "Change the instructions, and the reply changes" },
  insights: { Scene: InsightsScene, hint: "Switch the period, or ask for a report" },
  payments: { Scene: PaymentScene, hint: "Change the booking, then pay" },
  integrations: { Scene: ConnectScene, hint: "Switch tools on and off, then send a test" },
  branding: { Scene: BrandScene, hint: "Try a theme, a font and your own domain" },
  "custom-domains": { Scene: DomainScene, hint: "Watch a domain go from typed in to live" },
  versions: { Scene: VersionsScene, hint: "Watch a version restored and the answers exported" },
};

/** The use-case pages borrow the scene closest to their work. */
const CASE_SCENES: Record<string, string> = {
  agencies: "branding",
  education: "quizzes",
  sales: "ai-replies",
  events: "payments",
  hr: "logic",
};

/** The scene for a feature or use-case page, with what to try under it. */
export function StoryScene({ slug, compact, hint }: { slug: string; compact?: boolean; hint?: boolean }) {
  const entry = SCENES[slug] ?? SCENES[CASE_SCENES[slug] ?? ""];
  if (!entry) return null;
  const { Scene } = entry;
  if (!hint) return <Scene compact={compact} />;
  return (
    <>
      <Scene compact={compact} />
      <p className="fk-story-hint">
        <MousePointerClick size={15} strokeWidth={2} aria-hidden /> {entry.hint}
      </p>
    </>
  );
}
