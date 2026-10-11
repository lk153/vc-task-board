"use client";

import { Plus } from "lucide-react";
import { matchTask } from "@/domain/filter";
import { toneVars } from "@/domain/tone";
import { IconButton } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { useUi } from "@/store/ui-store";
import { StatusMenu } from "../statuses/status-menu";
import { useBoardContext, useMobileStatusId } from "./board-context";

/**
 * Mobile only: one tab per status switches the visible column. Owners also
 * get the current column's options (⋯) and "Add status" (+).
 */
export function StatusTabs() {
  const { view, statuses, statusesById, isOwner } = useBoardContext();
  const filters = useUi((s) => s.filters);
  const current = useMobileStatusId();
  const select = useUi((s) => s.setMobileStatus);
  const openStatusDialog = useUi((s) => s.openStatusDialog);
  const currentStatus = statusesById.get(current);

  return (
    <div className="flex items-center gap-1 px-4 pt-3 pb-1 desk:hidden">
      <nav aria-label="Status" className="scrollbar-none flex min-w-0 flex-1 gap-2 overflow-x-auto">
        {statuses.map((status) => {
          const on = status.id === current;
          const { bg, fg } = toneVars(status.tone);
          const count = view.tasks.filter(
            (t) => t.statusId === status.id && matchTask(t, filters),
          ).length;
          return (
            <button
              key={status.id}
              type="button"
              aria-current={on ? "true" : undefined}
              onClick={() => select(status.id)}
              className={cn(
                "flex h-9 flex-none items-center gap-2 rounded-md border px-3 text-[13.5px] font-medium outline-none focus-visible:shadow-focus",
                on ? "border-transparent" : "border-line bg-surface-2 text-muted",
              )}
              style={on ? { background: bg, color: fg } : undefined}
            >
              <span>{status.name}</span>
              <span className="font-normal tabular-nums">{count}</span>
            </button>
          );
        })}
      </nav>
      {isOwner && currentStatus && (
        <>
          <StatusMenu status={currentStatus} className="size-9" />
          <IconButton
            label="Add status"
            size={36}
            onClick={() => openStatusDialog({ mode: "add" })}
          >
            <Plus size={16} strokeWidth={2} aria-hidden />
          </IconButton>
        </>
      )}
    </div>
  );
}
