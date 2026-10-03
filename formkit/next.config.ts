import type { NextConfig } from "next";

/**
 * `FK_PREVIEW=1` swaps the Convex client for the fixture shims in
 * `scripts/preview/`, so the signed-in application can be rendered and looked
 * at without a backend. It is a development tool - `npm run preview` sets it,
 * nothing else does, and a normal build resolves the real modules.
 */
const preview = process.env.FK_PREVIEW === "1";

const previewAliases = {
  "convex/react": "./scripts/preview/convex-react.tsx",
  "@convex-dev/auth/react": "./scripts/preview/auth-react.tsx",
  "@convex-dev/auth/nextjs": "./scripts/preview/auth-nextjs.tsx",
  "@convex-dev/auth/nextjs/server": "./scripts/preview/auth-nextjs-server.tsx",
  "@/lib/seedServer": "./scripts/preview/seed-server.ts",
};

/**
 * Headers on every response. Published forms (/f/…, /<handle>/…, custom
 * domains) are meant to be embedded on other sites, so only the signed-in
 * pages and sign-in itself refuse to be framed by another origin.
 */
const NO_FRAMING = [
  { key: "Content-Security-Policy", value: "frame-ancestors 'self'" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
];
const headers: NextConfig["headers"] = async () => [
  {
    source: "/:path*",
    headers: [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    ],
  },
  ...["/app/:path*", "/app", "/admin/:path*", "/admin", "/onboarding", "/signin", "/signup"].map((source) => ({
    source,
    headers: NO_FRAMING,
  })),
];

const nextConfig: NextConfig = preview
  ? { turbopack: { resolveAlias: previewAliases }, headers }
  : { headers };

export default nextConfig;
