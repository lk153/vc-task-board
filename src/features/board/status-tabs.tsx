"use client";

import { STATUSES } from "@/config/board";
import { matchTask } from "@/domain/filter";
import { toneVars } from "@/domain/tone";
import { cn } from "@/lib/cn";
import { useUi } from "@/store/ui-store";
import { useBoardContext } from "./board-context";

/** Mobile only: one tab per status switches the visible column. */
export function StatusTabs() {
  const { view } = useBoardContext();
  const filters = useUi((s) => s.filters);
  const current = useUi((s) => s.mobileStatus);
  const select = useUi((s) => s.setMobileStatus);

  return (
    <nav
      aria-label="Status"
      className="scrollbar-none flex gap-2 overflow-x-auto px-4 pt-3 pb-1 desk:hidden"
    >
      {STATUSES.map((status) => {
        const on = status.id === current;
        const { bg, fg } = toneVars(status.tone);
        const count = view.tasks.filter(
          (t) => t.status === status.id && matchTask(t, filters),
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
            <span>{status.label}</span>
            <span className="font-normal tabular-nums">{count}</span>
          </button>
        );
      })}
    </nav>
  );
}
