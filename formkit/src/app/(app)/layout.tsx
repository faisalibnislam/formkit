import { ConvexAuthNextjsServerProvider } from "@convex-dev/auth/nextjs/server";
import { ConvexClientProvider } from "../ConvexClientProvider";
import { SeedProvider } from "@/lib/seed";
import { seedViewer } from "@/lib/seedServer";
import { ViewerHintSync } from "@/components/site/ViewerHintSync";
import "@/styles/app-bundle.css";

/**
 * Everything signed in or drawn per visitor: the app, admin, onboarding,
 * sign-in, and published forms. The server reads the session cookie, hands
 * the token to the browser and fetches the signed-in person, so the first
 * paint already shows them (src/lib/seed.tsx).
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const first = await seedViewer();
  return (
    <ConvexAuthNextjsServerProvider>
      <ConvexClientProvider>
        <SeedProvider seeds={first.seeds} clock={first.clock}>
          <ViewerHintSync />
          {children}
        </SeedProvider>
      </ConvexClientProvider>
    </ConvexAuthNextjsServerProvider>
  );
}
