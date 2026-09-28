import { getFunctionName, type FunctionReference } from "convex/server";

/** Shared by the server that fetches seeds and the browser that reads them. */
/** The reader's hour, date and the moment their day began, in their timezone. */
export type Clock = { hour: number; today: string; midnight?: number };
export type Seeds = Record<string, unknown>;

export function seedKey(ref: FunctionReference<"query">, args: Record<string, unknown> = {}) {
  return `${getFunctionName(ref)}|${JSON.stringify(args)}`;
}
