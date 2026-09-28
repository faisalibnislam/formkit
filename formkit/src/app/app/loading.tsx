import { PageSkeleton } from "@/components/app/Skeleton";

/**
 * Shown the instant an app page is asked for, inside the header that stays
 * put, and prefetched with the link — so a click changes the screen at once
 * instead of waiting on the server.
 */
export default function AppLoading() {
  return <PageSkeleton kind="dashboard" />;
}
