"use client";

import { Trash2 } from "lucide-react";
import { ConfirmDialog } from "@/components/ui/modal";
import type { Task } from "@/domain/task";
import { useUi } from "@/store/ui-store";
import { useDeleteTask, useRestoreTask } from "../board/api";
import { useBoardContext } from "../board/board-context";

/** Confirm → delete (soft) → "Task deleted" toast with Undo. */
export function DeleteTaskDialog() {
  const { view, boardId } = useBoardContext();
  const confirmId = useUi((s) => s.confirmDeleteId);
  const cancel = useUi((s) => s.cancelDelete);
  const showToast = useUi((s) => s.showToast);
  const deleteTask = useDeleteTask(boardId);
  const restoreTask = useRestoreTask(boardId);
  const task = confirmId ? view.tasks.find((t) => t.id === confirmId) : undefined;

  function confirm(target: Task) {
    const ui = useUi.getState();
    ui.cancelDelete();
    if (ui.editor?.mode === "edit" && ui.editor.taskId === target.id) ui.closeEditor();

    const deleting = deleteTask.mutateAsync(target);
    showToast("Task deleted", {
      label: "Undo",
      // Wait for the delete to land before restoring, so the two can't race.
      onClick: () =>
        void deleting.then(
          () => restoreTask.mutate(target),
          () => undefined,
        ),
    });
  }

  return (
    <ConfirmDialog
      open={Boolean(task)}
      onCancel={cancel}
      onConfirm={() => task && confirm(task)}
      title="Delete this task?"
      icon={<Trash2 size={17} strokeWidth={2} />}
      description={
        <>
          “<span className="font-medium text-fg">{task?.title}</span>” will be removed from the
          board.
        </>
      }
      confirmLabel="Delete task"
    />
  );
}
