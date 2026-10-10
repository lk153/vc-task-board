"use client";

import {
  closestCorners,
  DndContext,
  pointerWithin,
  rectIntersection,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  useSensor,
  useSensors,
  type Announcements,
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  type UniqueIdentifier,
} from "@dnd-kit/core";
import { arrayMove, sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { useMemo, useRef, useState } from "react";
import { STATUSES } from "@/config/board";
import { countLabel, isFiltering, matchTask, type TaskFilters } from "@/domain/filter";
import { positionForMove } from "@/domain/ordering";
import { statusLabel, type Status, type Task } from "@/domain/task";
import { useIsMobile } from "@/hooks/use-is-mobile";
import { useUi } from "@/store/ui-store";
import { useUpdateTask } from "./api";
import { useBoardContext } from "./board-context";
import { Column } from "./column";
import { TaskCardOverlay } from "./task-card";

type Columns = Record<Status, string[]>;

/** Card arrangement while dragging, and the data it was built from. */
interface DragState {
  columns: Columns;
  basis: Task[];
  filters: TaskFilters;
}

const columnOf = (id: string, columns: Columns): Status | null => {
  if (id.startsWith("column:")) return id.slice("column:".length) as Status;
  return STATUSES.find((s) => columns[s.id].includes(id))?.id ?? null;
};

/**
 * Mouse: whatever is under the pointer, preferring cards over their column.
 * Keyboard: whatever the moved card overlaps most (dnd-kit keeps the "pointer"
 * at the starting point for keyboard drags, so pointer checks would never move).
 */
const pointerFirst: CollisionDetection = (args) => {
  const underPointer = pointerWithin(args);
  if (underPointer.length > 0) {
    const cards = underPointer.filter((c) => !String(c.id).startsWith("column:"));
    return cards.length > 0 ? cards : underPointer;
  }
  return closestCorners(args);
};

const instructions = {
  draggable:
    "To move a task, press M. Use the arrow keys to move it between columns, then press Space or Enter to drop it, or Escape to cancel.",
};

/**
 * All five columns. Desktop: drag cards between columns or reorder them
 * (mouse, or keyboard with M). Mobile: only the selected status is shown and
 * dragging is off — status changes go through the editor.
 */
export function BoardColumns() {
  const { view, boardId } = useBoardContext();
  const filters = useUi((s) => s.filters);
  const mobileStatus = useUi((s) => s.mobileStatus);
  const setDragging = useUi((s) => s.setDragging);
  const showToast = useUi((s) => s.showToast);
  const selecting = useUi((s) => s.selecting);
  const isMobile = useIsMobile();
  const updateTask = useUpdateTask(boardId);

  const tasksById = useMemo(() => new Map(view.tasks.map((t) => [t.id, t])), [view.tasks]);
  const visible = useMemo(() => {
    const columns = {} as Columns;
    for (const status of STATUSES) {
      columns[status.id] = view.tasks
        .filter((t) => t.status === status.id && matchTask(t, filters))
        .map((t) => t.id);
    }
    return columns;
  }, [view.tasks, filters]);

  const [drag, setDrag] = useState<DragState | null>(null);
  const keyboardDrag = useRef(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overColumn, setOverColumn] = useState<Status | null>(null);

  // During a drag show the drag arrangement. After the drop keep it until the
  // optimistic update changes the data, so the card doesn't flicker back.
  const columns =
    drag && (activeId || (drag.basis === view.tasks && drag.filters === filters))
      ? drag.columns
      : visible;

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
      keyboardCodes: { start: ["KeyM"], cancel: ["Escape"], end: ["Space", "Enter"] },
    }),
  );

  function finish(next: Columns | null) {
    setActiveId(null);
    setOverColumn(null);
    setDragging(false);
    setDrag(next ? { columns: next, basis: view.tasks, filters } : null);
  }

  function onDragStart({ active, activatorEvent }: DragStartEvent) {
    keyboardDrag.current = activatorEvent instanceof KeyboardEvent;
    setActiveId(String(active.id));
    setDrag({ columns: visible, basis: view.tasks, filters });
    setDragging(true);
  }

  function onDragOver({ active, over }: DragOverEvent) {
    const activeKey = String(active.id);
    const overKey = over ? String(over.id) : null;
    setOverColumn(overKey ? columnOf(overKey, columns) : null);
    if (!over || !overKey) return;

    setDrag((state) => {
      if (!state) return state;
      const cols = state.columns;
      const from = columnOf(activeKey, cols);
      const to = columnOf(overKey, cols);
      if (!from || !to || from === to) return state;
      const target = cols[to].filter((id) => id !== activeKey);
      const overIndex = target.indexOf(overKey);
      const translated = active.rect.current.translated;
      const below = translated && translated.top > over.rect.top + over.rect.height / 2;
      const index = overIndex < 0 ? target.length : overIndex + (below ? 1 : 0);
      target.splice(index, 0, activeKey);
      return {
        ...state,
        columns: { ...cols, [from]: cols[from].filter((id) => id !== activeKey), [to]: target },
      };
    });
  }

  function onDragEnd({ active, over }: DragEndEvent) {
    const id = String(active.id);
    const task = tasksById.get(id);
    const cols = drag?.columns ?? visible;
    const to = over ? columnOf(String(over.id), cols) : null;
    if (!task || !over || !to) return finish(null);

    let items = cols[to];
    const overKey = String(over.id);
    if (!overKey.startsWith("column:") && overKey !== id) {
      const from = items.indexOf(id);
      const target = items.indexOf(overKey);
      if (from >= 0 && target >= 0) items = arrayMove(items, from, target);
    }
    const index = items.indexOf(id);
    if (index < 0 || (task.status === to && visible[to].indexOf(id) === index)) {
      return finish(null);
    }

    finish({ ...cols, [to]: items });
    const neighbours = items.map((key) => tasksById.get(key)).filter((t): t is Task => Boolean(t));
    const position = positionForMove(neighbours, id, index);
    updateTask.mutate({
      taskId: id,
      patch: to === task.status ? { position } : { status: to, position },
    });
    if (to !== task.status) showToast(`Moved to ${statusLabel(to)}`);
  }

  const activeTask = activeId ? tasksById.get(activeId) : undefined;
  const filtering = isFiltering(filters);

  // Screen-reader announcements in task and column names (dnd-kit's defaults read ids).
  const name = (id: UniqueIdentifier) => tasksById.get(String(id))?.title ?? "Task";
  const place = (id: UniqueIdentifier) => {
    const status = columnOf(String(id), columns);
    return status ? statusLabel(status) : "the board";
  };
  const announcements: Announcements = {
    onDragStart: ({ active }) => `Picked up ${name(active.id)}.`,
    onDragOver: ({ active, over }) =>
      over
        ? `${name(active.id)} is over ${place(over.id)}.`
        : `${name(active.id)} is not over a column.`,
    onDragEnd: ({ active, over }) =>
      over
        ? `${name(active.id)} was dropped in ${place(over.id)}.`
        : `${name(active.id)} was dropped.`,
    onDragCancel: ({ active }) => `Moving ${name(active.id)} was cancelled.`,
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={(args) =>
        keyboardDrag.current ? rectIntersection(args) : pointerFirst(args)
      }
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      onDragCancel={() => finish(null)}
      accessibility={{ screenReaderInstructions: instructions, announcements }}
    >
      <main
        data-screen-label="Board"
        className="flex flex-1 items-stretch gap-3 overflow-x-auto px-2 pt-1 pb-[104px] desk:p-4 desk:pb-10"
      >
        {STATUSES.map((status) => {
          const total = view.tasks.filter((t) => t.status === status.id).length;
          const tasks = columns[status.id]
            .map((id) => tasksById.get(id))
            .filter((t): t is Task => Boolean(t));
          const over = Boolean(activeId) && overColumn === status.id;
          return (
            <Column
              key={status.id}
              status={status}
              tasks={tasks}
              countLabel={countLabel(visible[status.id].length, total, filtering)}
              emptyLabel={over ? "Drop here" : total ? "No matching tasks" : "No tasks yet"}
              isOver={over}
              hiddenOnMobile={status.id !== mobileStatus}
              dragDisabled={isMobile || selecting}
            />
          );
        })}
      </main>
      <DragOverlay>{activeTask ? <TaskCardOverlay task={activeTask} /> : null}</DragOverlay>
    </DndContext>
  );
}
