import { defineConfig } from "vitest/config";

/**
 * Unit tests. Convex functions run in convex-test's in-memory backend (the
 * edge-runtime environment matches Convex's own), so no deployment is needed.
 */
export default defineConfig({
  test: {
    environment: "edge-runtime",
    server: { deps: { inline: ["convex-test"] } },
    include: ["convex/**/*.test.ts", "src/**/*.test.ts"],
  },
});
