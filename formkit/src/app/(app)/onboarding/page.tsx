import type { Metadata } from "next";
import { SessionGate } from "@/components/app/AccountGates";
import { Onboarding } from "@/components/auth/Onboarding";

export const metadata: Metadata = {
  title: "Set up your account",
  robots: { index: false, follow: false },
};

export default function OnboardingPage() {
  return (
    <SessionGate>
      <Onboarding />
    </SessionGate>
  );
}
