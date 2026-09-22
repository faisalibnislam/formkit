"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import {
  ChartPie,
  FileText,
  Inbox,
  LayoutGrid,
  LayoutTemplate,
  Search,
  Settings2,
} from "lucide-react";
import type { ReactNode } from "react";
import { api } from "../../../convex/_generated/api";
import { Input, Modal } from "@/components/ui";

/**
 * Cmd-K. It searches the person's own forms and the app's sections, and does
 * nothing clever with ranking — the shortest honest thing that finds a form by
 * name.
 */
type Entry = { label: string; meta: string; href: string; icon: ReactNode };

const SECTIONS: Entry[] = [
  { label: "Dashboard", meta: "Section", href: "/app", icon: <LayoutGrid size={16} strokeWidth={1.8} aria-hidden /> },
  { label: "Forms", meta: "Section", href: "/app/forms", icon: <FileText size={16} strokeWidth={1.8} aria-hidden /> },
  { label: "Responses", meta: "Section", href: "/app/responses", icon: <Inbox size={16} strokeWidth={1.8} aria-hidden /> },
  { label: "Analytics", meta: "Section", href: "/app/analytics", icon: <ChartPie size={16} strokeWidth={1.8} aria-hidden /> },
  { label: "Templates", meta: "Section", href: "/app/templates", icon: <LayoutTemplate size={16} strokeWidth={1.8} aria-hidden /> },
  { label: "Settings", meta: "Section", href: "/app/settings", icon: <Settings2 size={16} strokeWidth={1.8} aria-hidden /> },
];

export function CommandPalette({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [term, setTerm] = useState("");
  const data = useQuery(api.forms.list, { filter: "all" });

  const entries = useMemo<Entry[]>(() => {
    const forms: Entry[] = (data?.forms ?? []).map((f) => ({
      label: f.title,
      meta: `${f.status === "published" ? "Collecting" : f.status === "closed" ? "Closed" : "Draft"} · ${f.questions} questions`,
      href: `/app/forms/${f._id}`,
      icon: <FileText size={16} strokeWidth={1.8} aria-hidden />,
    }));
    const all = [...forms, ...SECTIONS];
    const q = term.trim().toLowerCase();
    return q ? all.filter((e) => e.label.toLowerCase().includes(q)) : all.slice(0, 10);
  }, [data, term]);

  function go(href: string) {
    onClose();
    router.push(href);
  }

  return (
    <Modal title="Search" onClose={onClose} width={520}>
      <Input
        autoFocus
        value={term}
        onChange={(e) => setTerm(e.target.value)}
        placeholder="A form, or where you want to go"
        icon={<Search size={17} strokeWidth={1.8} aria-hidden />}
        onKeyDown={(e) => {
          if (e.key === "Enter" && entries[0]) go(entries[0].href);
        }}
      />
      <div style={{ marginTop: 14 }} className="fk-rows">
        {entries.length === 0 ? (
          <p style={{ fontSize: 14.5, color: "var(--color-text-tertiary)", margin: "8px 2px" }}>
            Nothing matches “{term}”.
          </p>
        ) : (
          entries.map((e) => (
            <button key={e.href + e.label} type="button" className="fk-row" onClick={() => go(e.href)}>
              {e.icon}
              <span className="fk-row-main">
                <span className="fk-row-title">{e.label}</span>
                <span className="fk-row-meta">{e.meta}</span>
              </span>
            </button>
          ))
        )}
      </div>
    </Modal>
  );
}
