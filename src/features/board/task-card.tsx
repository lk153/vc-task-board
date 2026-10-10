"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { AlignLeft, Check, Hash, Trash2 } from "lucide-react";
import type { KeyboardEvent, MouseEvent } from "react";
import { DISPLAY, PRIORITIES, TASK_TYPES } from "@/config/board";
import { statusLabel, type Task } from "@/domain/task";
import { assigneeTone, priorityTone, statusTone, toneVars, typeTone } from "@/domain/tone";
import { Tag } from "@/components/ui/tag";
import { cn } from "@/lib/cn";
import { useUi } from "@/store/ui-store";
import { useBoardContext } from "./board-context";

interface CardViewProps {
  task: Task;
  /** Rendered in the drag overlay, following the pointer. */
  overlay?: boolean;
}

/** Card body: title, description preview, tags. Shared by the list and the drag overlay. */
function CardContent({ task }: { task: Task }) {
  const { membersById } = useBoardContext();
  const assignee = task.assigneeId ? membersById.get(task.assigneeId) : undefined;
  const priority = PRIORITIES.find((p) => p.id === task.priority);
  const type = task.type ? TASK_TYPES.find((t) => t.id === task.type) : undefined;
  const showPoints = DISPLAY.showStoryPoints && task.points !== null;
  const showDescription = DISPLAY.showDescription && task.description.trim() !== "";

  return (
    <>
      <div className="pr-[22px] text-sm leading-[1.45] font-medium text-pretty [overflow-wrap:anywhere]">
        {task.title}
      </div>
      {showDescription && (
        <div className="flex min-w-0 items-center gap-1.5 rounded-[5px] bg-surface-2 px-2 py-1 text-[12.5px] text-muted">
          <AlignLeft size={13} strokeWidth={2} className="shrink-0" aria-hidden />
          <span className="min-w-0 truncate">{task.description}</span>
        </div>
      )}
      {(showPoints || assignee || priority || type) && (
        <div className="flex flex-wrap gap-1.5">
          {showPoints && (
            <span
              title="Story points"
              className="inline-flex h-[22px] items-center gap-1 rounded border border-line px-[7px] text-[12.5px] text-muted tabular-nums"
            >
              <Hash size={11} strokeWidth={2.2} aria-hidden />
              {task.points!.toFixed(2)}
            </span>
          )}
          {assignee && <Tag tone={assigneeTone(assignee.userId)}>{assignee.name}</Tag>}
          {priority && <Tag tone={priorityTone(priority.id)}>{priority.label}</Tag>}
          {type && <Tag tone={typeTone(type.id)}>{type.label}</Tag>}
        </div>
      )}
    </>
  );
}

const cardClass = (compact: boolean) =>
  cn(
    "relative flex cursor-pointer flex-col rounded-lg border border-b-[3px] border-line bg-surface shadow-card transition-[box-shadow,opacity] outline-none group-hover:shadow-hover focus-visible:shadow-focus",
    compact ? "gap-1.5 px-2.5 pt-[9px] pb-2" : "gap-[9px] px-3 pt-3 pb-2.5",
  );

/** A copy of the card that follows the pointer while dragging. */
export function TaskCardOverlay({ task }: CardViewProps) {
  return (
    <div
      // No rotation: the overlay's box must line up with the card for keyboard moves.
      className={cn(cardClass(DISPLAY.compactCards), "shadow-hover")}
      style={{ borderBottomColor: toneVars(statusTone(task.status)).line }}
    >
      <CardContent task={task} />
    </div>
  );
}

/**
 * Card in a column. Click / Enter / Space edits; Delete / Backspace deletes;
 * M picks it up (desktop). X or Ctrl/⌘-click selects it; in selection mode a
 * click or Enter / Space selects instead of editing.
 */
export function TaskCard({ task, dragDisabled }: { task: Task; dragDisabled: boolean }) {
  const openEdit = useUi((s) => s.openEdit);
  const askDelete = useUi((s) => s.askDelete);
  const dragging = useUi((s) => s.dragging);
  const selecting = useUi((s) => s.selecting);
  const isSelected = useUi((s) => s.selected.includes(task.id));
  const toggleSelected = useUi((s) => s.toggleSelected);
  const priority = PRIORITIES.find((p) => p.id === task.priority);
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id, disabled: dragDisabled });

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    listeners?.onKeyDown?.(event);
    // The keyboard sensor owns Enter/Space while a card is being moved.
    if (
      event.defaultPrevented ||
      useUi.getState().dragging ||
      event.target !== event.currentTarget
    ) {
      return;
    }
    const plainKey = !event.metaKey && !event.ctrlKey && !event.altKey;
    if ((event.key === "x" || event.key === "X") && plainKey) {
      event.preventDefault();
      toggleSelected(task.id);
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      if (useUi.getState().selecting) toggleSelected(task.id);
      else openEdit(task.id);
    } else if (event.key === "Delete" || event.key === "Backspace") {
      event.preventDefault();
      askDelete(task.id);
    }
  }

  function onClick(event: MouseEvent) {
    if (useUi.getState().selecting || event.metaKey || event.ctrlKey) toggleSelected(task.id);
    else openEdit(task.id);
  }

  const label = `${task.title}. ${statusLabel(task.status)}${priority ? `, ${priority.label} priority` : ""}.`;

  // The delete button sits next to (not inside) the card so the two controls aren't nested.
  return (
    <div
      ref={setNodeRef}
      className={cn("group relative", isDragging && "opacity-40")}
      style={{ transform: CSS.Translate.toString(transform), transition }}
    >
      <div
        ref={setActivatorNodeRef}
        {...attributes}
        {...listeners}
        onKeyDown={onKeyDown}
        onClick={onClick}
        data-card-id={task.id}
        // dnd-kit marks the card disabled when dragging is off (mobile), but it's still editable.
        aria-disabled={undefined}
        aria-describedby={dragDisabled ? undefined : attributes["aria-describedby"]}
        aria-pressed={selecting ? isSelected : attributes["aria-pressed"]}
        aria-roledescription="task card"
        aria-label={
          selecting
            ? `${label} Press Enter to ${isSelected ? "deselect" : "select"}.`
            : `${label} Press Enter to edit, X to select, Delete to remove${dragDisabled ? "" : ", M to move"}.`
        }
        className={cn(
          cardClass(DISPLAY.compactCards),
          isSelected &&
            "border-accent bg-[color-mix(in_srgb,var(--accent)_7%,var(--surface))] shadow-[0_0_0_1px_var(--accent)]",
        )}
        style={{ borderBottomColor: toneVars(statusTone(task.status)).line }}
      >
        <CardContent task={task} />
        {selecting && (
          <span
            aria-hidden
            className={cn(
              "absolute top-2.5 right-2.5 grid size-[18px] place-items-center rounded border",
              isSelected
                ? "border-accent bg-accent text-accent-fg"
                : "border-line-strong bg-surface",
            )}
          >
            {isSelected && <Check size={12} strokeWidth={3} />}
          </span>
        )}
      </div>
      {!dragging && !selecting && (
        <button
          type="button"
          aria-label={`Delete task: ${task.title}`}
          title="Delete task"
          tabIndex={-1}
          onClick={() => askDelete(task.id)}
          className="absolute top-2 right-2 grid size-[26px] place-items-center rounded-md border border-line bg-surface text-muted opacity-0 transition-opacity group-hover:opacity-100 hover:border-danger hover:bg-danger-soft hover:text-danger max-desk:hidden"
        >
          <Trash2 size={13} strokeWidth={2} aria-hidden />
        </button>
      )}
    </div>
  );
}
