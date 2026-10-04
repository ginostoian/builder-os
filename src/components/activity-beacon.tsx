"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { activityAction } from "@/app/shell-actions";

const AWAY_MS = 30 * 60_000;

/**
 * Counts a page view on each navigation, and again when someone comes back to the tab after 30 minutes
 * away (a new session). Only counts reach the server: no page names, nothing about what's on screen.
 */
export function ActivityBeacon({ site = false }: { site?: boolean }) {
  const pathname = usePathname();
  const last = React.useRef(0);

  const ping = React.useCallback(() => {
    last.current = Date.now();
    void activityAction(site).catch(() => undefined);
  }, [site]);

  React.useEffect(() => {
    ping();
  }, [pathname, ping]);

  React.useEffect(() => {
    const back = () => {
      if (document.visibilityState === "visible" && Date.now() - last.current > AWAY_MS) ping();
    };
    document.addEventListener("visibilitychange", back);
    return () => document.removeEventListener("visibilitychange", back);
  }, [ping]);

  return null;
}
