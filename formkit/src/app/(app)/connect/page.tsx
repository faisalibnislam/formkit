import type { Metadata } from "next";
import { Suspense } from "react";
import { Consent } from "@/components/connect/Consent";

export const metadata: Metadata = {
  title: "Connect an app",
  robots: { index: false, follow: false },
};

export default function ConnectPage() {
  return (
    <Suspense>
      <Consent />
    </Suspense>
  );
}
