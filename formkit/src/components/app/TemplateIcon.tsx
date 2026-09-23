"use client";

import {
  Bookmark,
  Briefcase,
  Calendar,
  ChartPie,
  Compass,
  FileText,
  LayoutTemplate,
  LifeBuoy,
  Magnet,
  Mail,
  MessageSquare,
  Palette,
  PartyPopper,
  Plus,
  ShoppingBag,
  UserRound,
} from "lucide-react";
import type { ComponentType } from "react";

/** A template's mark, by the icon name the catalogue gives it. */
const ICONS: Record<string, ComponentType<{ size?: number; strokeWidth?: number }>> = {
  mail: Mail,
  briefcase: Briefcase,
  "layout-template": LayoutTemplate,
  palette: Palette,
  "message-square": MessageSquare,
  "user-round": UserRound,
  calendar: Calendar,
  "party-popper": PartyPopper,
  magnet: Magnet,
  "chart-pie": ChartPie,
  compass: Compass,
  "life-buoy": LifeBuoy,
  "shopping-bag": ShoppingBag,
  bookmark: Bookmark,
  plus: Plus,
};

export function TemplateIcon({ name, size = 22 }: { name: string; size?: number }) {
  const Glyph = ICONS[name] ?? FileText;
  return <Glyph size={size} strokeWidth={1.7} />;
}
