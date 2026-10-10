"use client";

import { useSyncExternalStore } from "react";
import { BREAKPOINT } from "@/config/board";

const query = `(max-width: ${BREAKPOINT - 0.02}px)`;

function subscribe(onChange: () => void) {
  const media = window.matchMedia(query);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

export const isMobileViewport = () => window.matchMedia(query).matches;

/**
 * True below the mobile breakpoint. Layout itself switches with CSS (`desk:`
 * variants); use this only for behaviour, such as turning off dragging.
 */
export function useIsMobile(): boolean {
  return useSyncExternalStore(subscribe, isMobileViewport, () => false);
}
