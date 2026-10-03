"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Button } from "@/components/ui";
import { relativeTime } from "@/components/app/bits";
import { useToast } from "@/components/ui/Toast";

/**
 * When figures from the hourly count (convex/adminReports.ts) were counted,
 * and a Refresh to count again now. With nothing counted yet (a fresh
 * deployment) it asks for a count straight away rather than waiting an hour.
 */
export function Counted({ asOf, children }: { asOf: number | null | undefined; children?: React.ReactNode }) {
  const toast = useToast();
  const refresh = useMutation(api.admin.refreshOverview);
  const [counting, setCounting] = useState(false);
  const asked = useRef(false);
  useEffect(() => {
    if (asOf !== null || asked.current) return;
    asked.current = true;
    void refresh({}).catch(() => {});
  }, [asOf, refresh]);

  return (
    <div className="fk-admin-bar">
      {children}
      <span className="fk-section-spacer" />
      <span className="fk-admin-quiet">
        {asOf ? `Counted ${relativeTime(asOf)}` : asOf === null ? "Counting for the first time…" : "…"}
      </span>
      <Button
        variant="secondary"
        size="sm"
        disabled={counting || !asOf}
        onClick={async () => {
          setCounting(true);
          try {
            await refresh({});
            toast("Counting again", { detail: "The numbers update in a minute or so." });
          } finally {
            setCounting(false);
          }
        }}
      >
        Refresh
      </Button>
    </div>
  );
}
