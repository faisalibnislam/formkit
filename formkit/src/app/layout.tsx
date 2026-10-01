import type { Metadata } from "next";
import { Outfit } from "next/font/google";
import { ConvexAuthNextjsServerProvider } from "@convex-dev/auth/nextjs/server";
import { ConvexClientProvider } from "./ConvexClientProvider";
import { ToastProvider } from "@/components/ui/Toast";
import { SHARE_IMAGE, SITE_URL } from "@/lib/site";
import "./globals.css";
import { Suspense } from "react";
import { NavProgress } from "@/components/site/NavProgress";
import { SeedProvider } from "@/lib/seed";
import { seedViewer } from "@/lib/seedServer";
import { SpeedInsights } from "@vercel/speed-insights/next";

/**
 * Outfit is the single typeface: UI, display and the large-light numerals.
 * There is no monospace anywhere in Formkit.
 */
const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
  weight: ["200", "300", "400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Formkit: forms people actually finish",
    template: "%s | Formkit",
  },
  description:
    "Build a form, brand it, publish it at your own link, and read the answers in one place. Free to start, with unlimited forms and responses.",
  openGraph: {
    images: [SHARE_IMAGE],
    type: "website",
    siteName: "Formkit",
  },
  twitter: { card: "summary_large_image", images: [SHARE_IMAGE] },
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // Who is signed in, fetched here so the first paint already shows them.
  const first = await seedViewer();
  return (
    <ConvexAuthNextjsServerProvider>
      {/* English (US) only, deliberately - the language picker was removed
          rather than left in place offering translations that do not exist. */}
      <html lang="en-US" className={outfit.variable} suppressHydrationWarning>
        <body>
          <Suspense fallback={null}>
            <NavProgress />
          </Suspense>
          <ConvexClientProvider>
            <SeedProvider seeds={first.seeds} clock={first.clock}>
              <ToastProvider>{children}</ToastProvider>
            </SeedProvider>
          </ConvexClientProvider>
          <SpeedInsights />
        </body>
      </html>
    </ConvexAuthNextjsServerProvider>
  );
}
