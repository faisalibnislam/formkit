import type { Metadata } from "next";
import { SessionGate } from "@/components/app/AccountGates";
import { AdminConsole } from "@/components/admin/AdminConsole";

export const metadata: Metadata = {
  title: "Admin",
  robots: { index: false, follow: false },
};

export default function AdminPage() {
  return (
    <SessionGate>
      <AdminConsole />
    </SessionGate>
  );
}
