"use client";

import dynamic from "next/dynamic";
import type { ComponentType } from "react";
import type { SceneProps } from "./shared";
import { sceneSlug } from "./slugs";

/**
 * A feature's scene, its code fetched only when it is shown. The scene cards
 * mount theirs inside NearView, so a page full of cards downloads none of
 * the animations until someone scrolls towards one. The scenes never render
 * on the server here, which NearView already ensured.
 */
const SCENES: Record<string, ComponentType<SceneProps>> = {
  "ai-form-builder": dynamic(() => import("./AiBuildScene").then((m) => m.AiBuildScene), { ssr: false }),
  builder: dynamic(() => import("@/components/landing/DragScene").then((m) => m.DragScene), { ssr: false }),
  logic: dynamic(() => import("./LogicScene").then((m) => m.LogicScene), { ssr: false }),
  quizzes: dynamic(() => import("./QuizScene").then((m) => m.QuizScene), { ssr: false }),
  "ai-replies": dynamic(() => import("./ReplyScene").then((m) => m.ReplyScene), { ssr: false }),
  insights: dynamic(() => import("./InsightsScene").then((m) => m.InsightsScene), { ssr: false }),
  payments: dynamic(() => import("./PaymentScene").then((m) => m.PaymentScene), { ssr: false }),
  integrations: dynamic(() => import("./ConnectScene").then((m) => m.ConnectScene), { ssr: false }),
  branding: dynamic(() => import("./BrandScene").then((m) => m.BrandScene), { ssr: false }),
  "custom-domains": dynamic(() => import("@/components/landing/DomainScene").then((m) => m.DomainScene), { ssr: false }),
  versions: dynamic(() => import("@/components/landing/VersionsScene").then((m) => m.VersionsScene), { ssr: false }),
};

export function LazyStoryScene({ slug, compact }: { slug: string; compact?: boolean }) {
  const Scene = SCENES[sceneSlug(slug, (s) => s in SCENES)];
  return Scene ? <Scene compact={compact} /> : null;
}
