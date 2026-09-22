import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthCard } from "@/components/auth/AuthCard";

export const metadata: Metadata = {
  title: "Create your account",
  description: "Create a free Formkit account.",
  robots: { index: false, follow: false },
};

export default function SignUpPage() {
  return (
    <Suspense>
      <AuthCard initialView="signup" />
    </Suspense>
  );
}
