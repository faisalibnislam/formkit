import type { Metadata } from "next";
import { Outfit } from "next/font/google";
import { ToastProvider } from "@/components/ui/Toast";
import { SHARE_IMAGE, SITE_URL } from "@/lib/site";
import "./globals.css";
import { Suspense } from "react";
import { NavProgress } from "@/components/site/NavProgress";
import { HINT_SCRIPT } from "@/lib/viewerHintScript";

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

/**
 * The shell every page shares. It reads nothing about the visitor, so the
 * marketing pages under it can be built once and served from the CDN. Who is
 * signed in is decided further down: the app's layout ((app)/layout.tsx) asks
 * the server, the marketing layout ((site)/layout.tsx) asks from the browser,
 * and the script below draws the remembered avatar before the first paint.
 */
export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // English (US) only, deliberately - the language picker was removed
    // rather than left in place offering translations that do not exist.
    <html lang="en-US" className={outfit.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: HINT_SCRIPT }} />
      </head>
      <body>
        <Suspense fallback={null}>
          <NavProgress />
        </Suspense>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
