"use client";

import { Plus } from "lucide-react";
import { useUi } from "@/store/ui-store";

/** Mobile only: floating "+" that creates a task in the selected status. */
export function Fab() {
  const openCreate = useUi((s) => s.openCreate);
  return (
    <button
      type="button"
      aria-label="New task"
      onClick={() => openCreate(useUi.getState().mobileStatus)}
      className="fixed right-4 bottom-[calc(16px+env(safe-area-inset-bottom))] z-30 grid size-14 place-items-center rounded-2xl bg-accent text-accent-fg shadow-fab outline-none focus-visible:shadow-focus desk:hidden"
    >
      <Plus size={22} strokeWidth={2.2} aria-hidden />
    </button>
  );
}
