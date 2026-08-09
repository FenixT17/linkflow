"use client";

import { useEffect, useRef } from "react";
import { hasStudyConsent } from "@/lib/study-consent";

interface ViewTrackerProps {
  pageId: string;
}

export function ViewTracker({ pageId }: ViewTrackerProps) {
  const tracked = useRef(false);

  useEffect(() => {
    if (!pageId || tracked.current) return;
    tracked.current = true;
    fetch("/api/view", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pageId, studyConsent: hasStudyConsent() }),
    }).catch((error) => {
      console.error("[ViewTracker] failed to record view:", error);
    });
  }, [pageId]);

  return null;
}
