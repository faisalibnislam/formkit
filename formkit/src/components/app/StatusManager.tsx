"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { Plus, Trash2 } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { Badge, Button, IconButton, Input, Modal, Select } from "@/components/ui";
import { useToast } from "@/components/ui/Toast";
import { errorText } from "./settings/bits";

type Tone = "info" | "neutral" | "success" | "warning" | "error" | "draft";
type Row = { key?: string; label: string; tone: Tone };

const TONES: { value: Tone; label: string }[] = [
  { value: "info", label: "Blue" },
  { value: "neutral", label: "Grey" },
  { value: "success", label: "Green" },
  { value: "warning", label: "Amber" },
  { value: "error", label: "Red" },
  { value: "draft", label: "Pale" },
];

/**
 * A company's response statuses: rename any, colour them, add up to twelve,
 * take away the company's own (New and Read stay). Taking one away asks where
 * its responses go.
 */
export function StatusManager({
  formId,
  statuses,
  onClose,
}: {
  formId?: Id<"forms">;
  statuses: { key: string; label: string; tone: string }[];
  onClose: () => void;
}) {
  const toast = useToast();
  const save = useMutation(api.statuses.save);
  const [rows, setRows] = useState<Row[]>(statuses.map((s) => ({ key: s.key, label: s.label, tone: s.tone as Tone })));
  const [moves, setMoves] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const gone = statuses.filter((s) => !rows.some((r) => r.key === s.key));
  const staying = rows.filter((r) => r.key);

  return (
    <Modal
      title="Response statuses"
      description="The stages a response goes through on your team. New and Read are built in: every response arrives New, and opening it makes it Read."
      onClose={onClose}
      width={560}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={busy || rows.some((r) => !r.label.trim())}
            onClick={async () => {
              setBusy(true);
              try {
                await save({
                  formId,
                  statuses: rows.map((r) => ({ key: r.key, label: r.label, tone: r.tone })),
                  moves: gone.map((g) => ({ from: g.key, to: moves[g.key] ?? "read" })),
                });
                toast("Statuses saved", gone.length ? { detail: "Responses are moving over now." } : undefined);
                onClose();
              } catch (e) {
                toast(errorText(e, "Those statuses did not save."));
                setBusy(false);
              }
            }}
          >
            Save
          </Button>
        </>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {rows.map((r, i) => {
          const builtIn = r.key === "new" || r.key === "read";
          return (
            <div key={r.key ?? `new-${i}`} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Badge tone={r.tone}>{r.label || "…"}</Badge>
              <Input
                value={r.label}
                maxLength={24}
                aria-label="Status name"
                onChange={(e) => setRows((all) => all.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))}
                wrapStyle={{ flex: 1, minWidth: 0 }}
              />
              <div style={{ width: 110 }}>
                <Select
                  size="sm"
                  ariaLabel="Colour"
                  value={r.tone}
                  options={TONES}
                  onChange={(tone) => setRows((all) => all.map((x, j) => (j === i ? { ...x, tone: tone as Tone } : x)))}
                />
              </div>
              <IconButton
                label={builtIn ? "Built in, so it stays" : `Remove ${r.label}`}
                disabled={builtIn}
                onClick={() => setRows((all) => all.filter((_, j) => j !== i))}
              >
                <Trash2 size={15} strokeWidth={1.8} aria-hidden />
              </IconButton>
            </div>
          );
        })}
        {rows.length < 12 && (
          <div>
            <Button
              variant="ghost"
              size="sm"
              iconLeft={<Plus size={15} strokeWidth={1.8} aria-hidden />}
              onClick={() => setRows((all) => [...all, { label: "", tone: "warning" }])}
            >
              Add a status
            </Button>
          </div>
        )}
        {gone.map((g) => (
          <div key={g.key} className="fk-amber" style={{ marginTop: 6 }}>
            <span style={{ flex: 1, minWidth: 0 }}>Responses that are {g.label} move to</span>
            <div style={{ width: 160 }}>
              <Select
                size="sm"
                ariaLabel={`Where ${g.label} responses go`}
                value={moves[g.key] ?? "read"}
                options={staying.map((s) => ({ value: s.key!, label: s.label }))}
                onChange={(to) => setMoves((m) => ({ ...m, [g.key]: to }))}
              />
            </div>
          </div>
        ))}
      </div>
    </Modal>
  );
}
