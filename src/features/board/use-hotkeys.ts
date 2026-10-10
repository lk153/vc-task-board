"use client";

import { useEffect } from "react";
import { DEFAULT_STATUS } from "@/config/board";
import { isMobileViewport } from "@/hooks/use-is-mobile";
import { useUi } from "@/store/ui-store";
import { SEARCH_INPUT_ID } from "./header";

const anyOverlayOpen = () =>
  Boolean(document.querySelector('[role="dialog"], [role="alertdialog"], [role="menu"]'));

/**
 * Board shortcuts: N new task, / search, Esc leaves selection mode, then closes
 * the filter panel.
 * Ignored while typing, while a dialog or menu is open, or while dragging.
 * (Esc for dialogs is handled by the dialogs themselves.)
 */
export function useBoardHotkeys() {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const ui = useUi.getState();
      if (ui.dragging || event.defaultPrevented) return;
      if (anyOverlayOpen() || ui.editor || ui.confirmDeleteId) return;

      if (event.key === "Escape" && ui.selecting) {
        ui.stopSelecting();
        return;
      }
      if (event.key === "Escape" && ui.showFilters) {
        ui.setShowFilters(false);
        return;
      }
      const target = event.target as HTMLElement | null;
      const typing = target?.closest?.('input, textarea, select, [contenteditable="true"]');
      if (typing || event.metaKey || event.ctrlKey || event.altKey) return;

      if (event.key === "n" || event.key === "N") {
        event.preventDefault();
        ui.openCreate(isMobileViewport() ? ui.mobileStatus : DEFAULT_STATUS);
      } else if (event.key === "/") {
        event.preventDefault();
        document.getElementById(SEARCH_INPUT_ID)?.focus();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
}
