"use client";

/** Stands in for `@convex-dev/auth/react` while `FK_PREVIEW=1`. */
export function useAuthActions() {
  return {
    signIn: async () => ({ signingIn: true }),
    signOut: async () => {},
  };
}
