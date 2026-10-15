"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { keepImport, takeImport } from "@/lib/pendingImport";

const ImportFormDialog = dynamic(() => import("./ImportFormDialog").then((m) => m.ImportFormDialog));

/** A link pasted on a compare page before signing up, imported on arrival. */
export function PendingImport() {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    const waiting = takeImport();
    if (!waiting) return;
    // After the first paint, so the app is on screen behind the dialog.
    let shown = false;
    const t = window.setTimeout(() => {
      shown = true;
      setUrl(waiting);
    }, 0);
    return () => {
      window.clearTimeout(t);
      // Gone before it showed (React mounts twice in development): keep it for next time.
      if (!shown) keepImport(waiting);
    };
  }, []);
  if (!url) return null;
  return <ImportFormDialog initialUrl={url} autoStart onClose={() => setUrl(null)} />;
}
