"use client";

import { useEffect } from "react";
import { classifyViewSource, type ViewSource } from "@/lib/view-source";

export function PostViewTracker({ postId }: { postId: number }) {
  useEffect(() => {
    const detected = classifyViewSource(
      document.referrer,
      new URLSearchParams(window.location.search).get("utm_source"),
      window.location.hostname,
    );
    let source: ViewSource = detected ?? "UNKNOWN";

    try {
      if (detected) sessionStorage.setItem("yooreru:view-source", detected);
      else source = (sessionStorage.getItem("yooreru:view-source") as ViewSource | null) ?? "UNKNOWN";
    } catch {
      // The view still counts when browser storage is unavailable.
    }

    void fetch("/api/post-views/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ postId, source }),
      keepalive: true,
    }).catch(() => {});
  }, [postId]);

  return null;
}
