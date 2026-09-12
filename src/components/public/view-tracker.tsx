"use client";

import { useEffect, useRef } from "react";
import { hasStudyConsent } from "@/lib/study-consent";

interface ViewTrackerProps {
  idPagina: string;
}

export function ViewTracker({ idPagina }: ViewTrackerProps) {
  const tracked = useRef(false);

  useEffect(() => {
    if (!idPagina || tracked.current) return;
    tracked.current = true;
    fetch("/api/view", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idPagina, studyConsent: hasStudyConsent() }),
    }).then((res) => {
      if (!res.ok) {
        console.error("[ViewTracker] server returned", res.status);
      }
    }).catch((error) => {
      console.error("[ViewTracker] failed to record view:", error);
    });
  }, [idPagina]);

  return null;
}
