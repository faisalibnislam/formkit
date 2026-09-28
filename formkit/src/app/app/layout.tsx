import { Suspense } from "react";
import type { Metadata } from "next";
import { AppShell } from "@/components/app/AppShell";

export const metadata: Metadata = {
  title: { default: "Formkit", template: "%s — Formkit" },
  robots: { index: false, follow: false },
};

export default function AppLayout({ children }: LayoutProps<"/app">) {
  // The shell reads the query string, so it needs a boundary of its own.
  return (
    <>
      {/* The app's theme is known before the account loads, from the last
          visit, so a dark app does not flash white first. AppTheme corrects
          it once the account and its flags arrive. The <html> element
          suppresses the hydration warning for exactly this attribute. */}
      <script
        dangerouslySetInnerHTML={{
          __html: `try{if(localStorage.getItem("fk.appTheme")==="dark")document.documentElement.dataset.appTheme="dark"}catch(e){}`,
        }}
      />
    <Suspense fallback={null}>
      <AppShell>{children}</AppShell>
    </Suspense>
    </>
  );
}
