"use client";

import {
  AlignLeft,
  AtSign,
  Building2,
  Calendar,
  ChevronDown,
  CircleDot,
  Clock,
  FileText,
  Hash,
  Link as LinkIcon,
  ListChecks,
  Mail,
  MapPin,
  Paperclip,
  PenLine,
  Phone,
  SlidersHorizontal,
  Star,
  ToggleLeft,
  Type,
  User,
} from "lucide-react";
import type { ComponentType } from "react";

/**
 * The mark for a field type.
 *
 * `fieldTypes.ts` names an icon the way the design system does — as a string —
 * so the two stay comparable. This is the one place that turns a name into the
 * drawing, and an unknown name falls back to the plain sheet rather than
 * rendering nothing.
 */
const ICONS: Record<string, ComponentType<{ size?: number; strokeWidth?: number }>> = {
  type: Type,
  "align-left": AlignLeft,
  "at-sign": AtSign,
  phone: Phone,
  link: LinkIcon,
  "circle-dot": CircleDot,
  "list-checks": ListChecks,
  "chevron-down": ChevronDown,
  "toggle-left": ToggleLeft,
  hash: Hash,
  star: Star,
  "sliders-horizontal": SlidersHorizontal,
  calendar: Calendar,
  clock: Clock,
  paperclip: Paperclip,
  "pen-line": PenLine,
  mail: Mail,
  user: User,
  "building-2": Building2,
  "map-pin": MapPin,
};

export function FieldIcon({ name, size = 15 }: { name: string; size?: number }) {
  const Glyph = ICONS[name] ?? FileText;
  return <Glyph size={size} strokeWidth={1.8} />;
}
