import { Suspense } from "react";
import { Settings } from "@/components/app/Settings";

export const metadata = { title: "Settings" };

export default function SettingsPage() {
  return (
    <Suspense fallback={null}>
      <Settings />
    </Suspense>
  );
}
