/// <reference types="vite/client" />
// Every Convex module, for convex-test. The two dots in this file's name keep
// it (and every *.test.ts) out of the deployed functions.
export const modules = import.meta.glob("./**/!(*.*.*)*.*s");
