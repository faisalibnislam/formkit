import type { Doc, Id } from "../_generated/dataModel";
import type { Condition } from "./logicEval";

/**
 * A rule carried to another form - a template, a copy - points at questions
 * by their position, and is re-pointed at the new form's questions on arrival.
 */

type PortableCondition = Omit<Condition, "blockId"> & { index: number | null };

export type PortableRule = {
  name: string;
  enabled: boolean;
  join: "and" | "or";
  action: Doc<"logicRules">["action"];
  targetIndex: number | null;
  conditions: PortableCondition[];
  groups?: { join: "and" | "or"; conditions: PortableCondition[] }[];
  options?: string[];
  endingId?: string;
};

function out(c: Doc<"logicRules">["conditions"][number], index: Map<string, number>): PortableCondition {
  const { blockId, ...rest } = c;
  return { ...rest, index: blockId ? (index.get(blockId) ?? null) : null };
}

function back(c: PortableCondition, ids: Id<"blocks">[]): Doc<"logicRules">["conditions"][number] {
  const { index, ...rest } = c;
  return { ...rest, blockId: index !== null && index !== undefined ? ids[index] : undefined } as Doc<"logicRules">["conditions"][number];
}

export function toPortable(r: Doc<"logicRules">, index: Map<string, number>): PortableRule {
  return {
    name: r.name,
    enabled: r.enabled,
    join: r.join,
    action: r.action,
    targetIndex: r.targetId ? (index.get(r.targetId) ?? null) : null,
    conditions: r.conditions.map((c) => out(c, index)),
    groups: r.groups?.map((g) => ({ join: g.join, conditions: g.conditions.map((c) => out(c, index)) })),
    options: r.options,
    endingId: r.endingId,
  };
}

export function fromPortable(r: PortableRule, ids: Id<"blocks">[], formId: Id<"forms">, order: number) {
  return {
    formId,
    name: r.name,
    enabled: r.enabled,
    join: r.join,
    action: r.action,
    targetId: r.targetIndex !== null ? ids[r.targetIndex] : undefined,
    conditions: r.conditions.map((c) => back(c, ids)),
    groups: r.groups?.map((g) => ({ join: g.join, conditions: g.conditions.map((c) => back(c, ids)) })),
    options: r.options,
    endingId: r.endingId,
    order,
  };
}
