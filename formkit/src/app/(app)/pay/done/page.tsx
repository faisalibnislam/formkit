import type { Metadata } from "next";
import { PayDone } from "@/components/live/PayDone";

export const metadata: Metadata = { title: "Payment", robots: { index: false } };

/** Where Stripe sends people back to after paying for a form. */
export default async function PayDonePage({ searchParams }: PageProps<"/pay/done">) {
  const q = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? null;
  return <PayDone responseId={one(q.r)} sessionId={one(q.s)} cancelled={one(q.cancelled) === "1"} />;
}
