import { Suspense } from "react";
import type { Metadata } from "next";
import { AppShell } from "@/components/app/AppShell";
import { SeedProvider } from "@/lib/seed";
import { seedQueries, seedViewer } from "@/lib/seedServer";
import { headers } from "next/headers";
import type { FunctionReference } from "convex/server";
import type { Id } from "../../../convex/_generated/dataModel";
import { api } from "../../../convex/_generated/api";

export const metadata: Metadata = {
  title: { default: "Formkit", template: "%s — Formkit" },
  robots: { index: false, follow: false },
};

type Seed = [FunctionReference<"query">, Record<string, unknown>?];

const DAY = 24 * 60 * 60 * 1000;

/** The queries each app page opens with, by its path. */
function pageSeeds(path: string): Seed[] {
  if (path === "/app") return [[api.forms.list, { filter: "all" }], [api.responses.recent], [api.analytics.overview]];
  if (path === "/app/forms" || path === "/app/templates") return [[api.forms.list, { filter: "all" }]];
  if (path === "/app/analytics") return [[api.forms.picker]];
  if (path === "/app/responses") return [[api.responses.list, {}]];
  const editor = path.match(/^\/app\/forms\/([a-z0-9]+)$/);
  if (editor) {
    const formId = editor[1] as Id<"forms">;
    return [[api.forms.get, { formId }], [api.forms.unpublishedChanges, { formId }], [api.comments.counts, { formId }]];
  }
  return [];
}

export default async function AppLayout({ children }: LayoutProps<"/app">) {
  // What the header, its tabs and the page being opened show, fetched before
  // anything is sent so the first paint is already the real screen. Moving
  // between pages later loads in the browser, behind the page loader.
  const path = (await headers()).get("x-fk-path") ?? "";
  const clock = path === "/app/analytics" ? (await seedViewer()).clock : null;
  const seeds = await seedQueries([
    [api.flags.mine],
    [api.forms.summary],
    [api.inbox.list],
    [api.responses.unreadCount],
    [api.templates.list],
    ...pageSeeds(path),
    // Analytics opens on the last 30 days, counted from the reader's midnight.
    ...(clock?.midnight !== undefined
      ? ([[api.analytics.overview, { from: clock.midnight - 29 * DAY, to: clock.midnight + DAY }]] as Seed[])
      : []),
  ]);
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
      <SeedProvider seeds={seeds}>
        <Suspense fallback={null}>
          <AppShell>{children}</AppShell>
        </Suspense>
      </SeedProvider>
    </>
  );
}
