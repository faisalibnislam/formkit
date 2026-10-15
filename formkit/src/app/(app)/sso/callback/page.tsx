import type { Metadata } from "next";
import { SamlCallback } from "@/components/auth/SamlCallback";

export const metadata: Metadata = { title: "Signing in", robots: { index: false } };

/** Where a company's identity provider sends people back, through WorkOS (convex/workos.ts). */
export default async function SamlCallbackPage({ searchParams }: PageProps<"/sso/callback">) {
  const q = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
  return <SamlCallback code={one(q.code)} state={one(q.state)} error={one(q.error_description) || one(q.error)} />;
}
