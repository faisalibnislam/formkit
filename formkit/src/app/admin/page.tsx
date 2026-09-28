import type { Metadata } from "next";
import { Suspense } from "react";
import { SessionGate } from "@/components/app/AccountGates";
import { AdminConsole } from "@/components/admin/AdminConsole";

export const metadata: Metadata = {
  title: "Admin",
  robots: { index: false, follow: false },
};

export default function AdminPage() {
  return (
    <SessionGate>
      <Suspense>
        <AdminConsole />
      </Suspense>
    </SessionGate>
  );
}
