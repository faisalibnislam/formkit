import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthCard } from "@/components/auth/AuthCard";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to Formkit.",
  // App screens should never be indexed.
  robots: { index: false, follow: false },
};

export default function SignInPage() {
  return (
    <Suspense>
      <AuthCard initialView="signin" />
    </Suspense>
  );
}
