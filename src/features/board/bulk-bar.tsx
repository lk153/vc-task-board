"use client";

import { ChevronUp, X } from "lucide-react";
import { DropdownMenu } from "radix-ui";
import { STATUSES } from "@/config/board";
import { matchTask } from "@/domain/filter";
import { columnTasks, planBulkMove, type TaskMove } from "@/domain/ordering";
import { statusLabel, type Status } from "@/domain/task";
import { statusTone } from "@/domain/tone";
import { Button, IconButton } from "@/components/ui/button";
import { MenuItem, MenuPanel } from "@/components/ui/menu";
import { Tag } from "@/components/ui/tag";
import { isMobileViewport } from "@/hooks/use-is-mobile";
import { useUi } from "@/store/ui-store";
import { useBulkMoveTasks } from "./api";
import { useBoardContext } from "./board-context";

const plural = (n: number) => `${n} task${n === 1 ? "" : "s"}`;

/**
 * Shown in selection mode: how many tasks are selected, "Move to" a status,
 * select all / clear, and Done. Floating pill on desktop, bottom bar on mobile.
 */
export function BulkBar() {
  const { view, boardId } = useBoardContext();
  const selecting = useUi((s) => s.selecting);
  const selected = useUi((s) => s.selected);
  const filters = useUi((s) => s.filters);
  const stopSelecting = useUi((s) => s.stopSelecting);
  const setSelected = useUi((s) => s.setSelected);
  const showToast = useUi((s) => s.showToast);
  const bulkMove = useBulkMoveTasks(boardId);
  if (!selecting) return null;

  // Only tasks you can still see count: not deleted meanwhile, not hidden by filters.
  const visible = view.tasks.filter((t) => matchTask(t, filters));
  const chosen = visible.filter((t) => selected.includes(t.id));
  // Board order: column by column, top to bottom.
  const ordered = STATUSES.flatMap((s) => columnTasks(chosen, s.id));
  const count = ordered.length;

  function selectAll() {
    const mobileStatus = useUi.getState().mobileStatus;
    // On mobile only one column is on screen, so "all" means that column.
    const pool = isMobileViewport() ? visible.filter((t) => t.status === mobileStatus) : visible;
    setSelected([...new Set([...selected, ...pool.map((t) => t.id)])]);
  }

  function moveTo(status: Status) {
    const moves: TaskMove[] = ordered.map((t) => ({ id: t.id, status }));
    const plan = planBulkMove(view.tasks, moves);
    if (plan.length === 0) {
      showToast(`Already in ${statusLabel(status)}`);
      return;
    }
    const previous: TaskMove[] = plan.map((m) => {
      const task = view.tasks.find((t) => t.id === m.id)!;
      return { id: task.id, status: task.status, position: task.position };
    });

    const moving = bulkMove.mutateAsync(moves);
    stopSelecting();
    showToast(`Moved ${plural(plan.length)} to ${statusLabel(status)}`, {
      label: "Undo",
      // Wait for the move to land before putting things back.
      onClick: () =>
        void moving.then(
          () => bulkMove.mutate(previous),
          () => undefined,
        ),
    });
  }

  return (
    <div
      role="toolbar"
      aria-label="Selected tasks"
      className="fixed inset-x-0 bottom-0 z-40 flex animate-fade items-center gap-2 border-t border-line bg-surface px-4 pt-3 pb-[max(12px,env(safe-area-inset-bottom))] shadow-pop desk:inset-x-auto desk:bottom-6 desk:left-1/2 desk:-translate-x-1/2 desk:rounded-xl desk:border desk:p-2 desk:pl-4"
    >
      <span
        aria-live="polite"
        className="mr-auto text-[13.5px] font-medium whitespace-nowrap tabular-nums desk:mr-2"
      >
        {count} selected
      </span>

      <DropdownMenu.Root modal={false}>
        <DropdownMenu.Trigger asChild disabled={count === 0}>
          <Button variant="primary" size="md">
            Move to
            <ChevronUp size={14} strokeWidth={2.2} aria-hidden />
          </Button>
        </DropdownMenu.Trigger>
        <MenuPanel side="top" align="center" className="min-w-44">
          {STATUSES.map((status) => (
            <MenuItem key={status.id} onSelect={() => moveTo(status.id)}>
              <Tag tone={statusTone(status.id)}>{status.label}</Tag>
            </MenuItem>
          ))}
        </MenuPanel>
      </DropdownMenu.Root>

      <Button variant="ghost" size="md" onClick={selectAll}>
        Select all
      </Button>
      {count > 0 && (
        <Button
          variant="ghost"
          size="md"
          onClick={() => setSelected([])}
          className="max-desk:hidden"
        >
          Clear
        </Button>
      )}
      <IconButton label="Done selecting" onClick={stopSelecting}>
        <X size={16} strokeWidth={2} aria-hidden />
      </IconButton>
    </div>
  );
}
