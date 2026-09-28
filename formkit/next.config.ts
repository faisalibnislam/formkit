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

const nextConfig: NextConfig = preview
  ? { turbopack: { resolveAlias: previewAliases } }
  : {};

export default nextConfig;
