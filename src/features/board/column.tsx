"use client";

import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { Plus } from "lucide-react";
import type { BoardStatus, Task } from "@/domain/task";
import { toneVars } from "@/domain/tone";
import { IconButton } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { useUi } from "@/store/ui-store";
import { StatusMenu } from "../statuses/status-menu";
import { useBoardContext } from "./board-context";
import { TaskCard } from "./task-card";

export const columnDropId = (status: string) => `column:${status}`;

interface ColumnProps {
  status: BoardStatus;
  tasks: Task[];
  /** Live (unfiltered) task count, for "x of y". */
  countLabel: string;
  emptyLabel: string;
  isOver: boolean;
  hiddenOnMobile: boolean;
  dragDisabled: boolean;
}

export function Column({
  status,
  tasks,
  countLabel,
  emptyLabel,
  isOver,
  hiddenOnMobile,
  dragDisabled,
}: ColumnProps) {
  const openCreate = useUi((s) => s.openCreate);
  const { isOwner } = useBoardContext();
  // The whole column is a drop target, so dropping below the last card works.
  const { setNodeRef } = useDroppable({ id: columnDropId(status.id) });
  const { bg, fg } = toneVars(status.tone);

  return (
    <section
      ref={setNodeRef}
      aria-label={status.name}
      className={cn(
        "flex min-w-0 flex-1 flex-col gap-2.5 rounded-xl p-2 transition-colors desk:max-w-[340px] desk:min-w-[264px] desk:basis-0",
        isOver ? "bg-drop" : "bg-transparent",
        hiddenOnMobile && "max-desk:hidden",
      )}
    >
      <div className="mb-0.5 flex h-[30px] items-center gap-2.5 max-desk:hidden">
        <span
          className="inline-flex h-6 items-center rounded-[5px] px-2 text-[13px] font-medium whitespace-nowrap"
          style={{ background: bg, color: fg }}
        >
          {status.name}
        </span>
        <span className="text-[13px] text-muted tabular-nums">{countLabel}</span>
        <span className="flex-1" />
        {isOwner && <StatusMenu status={status} />}
        <IconButton
          label={`Add task to ${status.name}`}
          size={28}
          onClick={() => openCreate(status.id)}
        >
          <Plus size={15} strokeWidth={2} aria-hidden />
        </IconButton>
      </div>

      <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
        <div className="flex min-h-2 flex-col gap-2.5">
          {tasks.map((task) => (
            <TaskCard key={task.id} task={task} dragDisabled={dragDisabled} />
          ))}
          {tasks.length === 0 && (
            <div className="rounded-lg border border-dashed border-line-strong px-3 py-5 text-center text-[13px] text-muted">
              {emptyLabel}
            </div>
          )}
        </div>
      </SortableContext>

      <button
        type="button"
        onClick={() => openCreate(status.id)}
        className="flex h-9 flex-none items-center justify-center gap-1.5 rounded-md bg-surface-2 text-[13px] text-muted outline-none hover:bg-surface-3 hover:text-fg focus-visible:shadow-focus"
      >
        <Plus size={14} strokeWidth={2} aria-hidden />
        Add task
      </button>
    </section>
  );
}

/** Desktop, owners only: a slot after the last column to add another status. */
export function AddStatusColumn() {
  const openStatusDialog = useUi((s) => s.openStatusDialog);
  return (
    <div className="flex-none p-2 max-desk:hidden">
      <button
        type="button"
        onClick={() => openStatusDialog({ mode: "add" })}
        className="flex h-[30px] items-center gap-1.5 rounded-md border border-dashed border-line-strong px-3 text-[13px] whitespace-nowrap text-muted outline-none hover:bg-surface-2 hover:text-fg focus-visible:shadow-focus"
      >
        <Plus size={14} strokeWidth={2} aria-hidden />
        Add status
      </button>
    </div>
  );
}
