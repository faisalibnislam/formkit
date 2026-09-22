import type { Metadata } from "next";
import { Onboarding } from "@/components/auth/Onboarding";

export const metadata: Metadata = {
  title: "Set up your account",
  robots: { index: false, follow: false },
};

export default function OnboardingPage() {
  return <Onboarding />;
}
