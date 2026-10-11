"use client";

import { Trash2 } from "lucide-react";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { DEFAULT_PRIORITY, DEFAULT_TYPE, LIMITS, TASK_TYPES } from "@/config/board";
import { positionAtEnd } from "@/domain/ordering";
import {
  titleSchema,
  type Priority,
  type Task,
  type TaskType,
  type UpdateTaskInput,
} from "@/domain/task";
import { Button } from "@/components/ui/button";
import { Field, FieldError, Input, Label, Select, Textarea } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { isMobileViewport } from "@/hooks/use-is-mobile";
import { useUi, type Editor } from "@/store/ui-store";
import { useCreateTask, useUpdateTask } from "../board/api";
import { useBoardContext } from "../board/board-context";
import { PriorityPicker } from "./priority-picker";

const FORM_ID = "tb-task-form";

interface Draft {
  title: string;
  description: string;
  statusId: string;
  priority: Priority;
  type: TaskType | "";
  assigneeId: string;
  points: string;
}

function initialDraft(editor: Editor, task: Task | undefined, defaultStatusId: string): Draft {
  if (editor.mode === "edit" && task) {
    return {
      title: task.title,
      description: task.description,
      statusId: task.statusId,
      priority: task.priority,
      type: task.type ?? "",
      assigneeId: task.assigneeId ?? "",
      points: task.points === null ? "" : String(task.points),
    };
  }
  return {
    title: "",
    description: "",
    statusId: editor.mode === "create" ? editor.statusId : defaultStatusId,
    priority: DEFAULT_PRIORITY,
    type: DEFAULT_TYPE,
    assigneeId: "",
    points: "",
  };
}

/** Empty, negative or non-numeric story points mean "none". */
function parsePoints(value: string): number | null {
  if (value.trim() === "") return null;
  const points = Number(value);
  if (!Number.isFinite(points) || points < 0) return null;
  return Math.min(points, LIMITS.points);
}

/** Create / edit form. Desktop: centered dialog; mobile: bottom sheet. */
export function TaskEditor() {
  const editor = useUi((s) => s.editor);
  const { view } = useBoardContext();
  const closeEditor = useUi((s) => s.closeEditor);
  const showToast = useUi((s) => s.showToast);
  const task = editor?.mode === "edit" ? view.tasks.find((t) => t.id === editor.taskId) : undefined;
  const missing = editor?.mode === "edit" && !task;

  // Someone else deleted the task while it was open.
  useEffect(() => {
    if (missing) {
      closeEditor();
      showToast("This task was deleted");
    }
  }, [missing, closeEditor, showToast]);

  const askDelete = useUi((s) => s.askDelete);
  const footer = (
    <>
      {task && (
        <Button variant="dangerGhost" className="pr-3 pl-2.5" onClick={() => askDelete(task.id)}>
          <Trash2 size={15} strokeWidth={2} aria-hidden />
          Delete
        </Button>
      )}
      <span className="flex-1" />
      <Button variant="secondary" onClick={closeEditor}>
        Cancel
      </Button>
      <Button variant="primary" type="submit" form={FORM_ID} title="Ctrl/⌘ + Enter">
        {editor?.mode === "edit" ? "Save changes" : "Create task"}
      </Button>
    </>
  );

  return (
    <Modal
      open={Boolean(editor) && !missing}
      onOpenChange={(open) => !open && closeEditor()}
      title={editor?.mode === "edit" ? "Edit task" : "New task"}
      footer={footer}
      onOpenAutoFocus={(event) => {
        // Focus the title on desktop; on mobile don't pop the keyboard open.
        event.preventDefault();
        if (!isMobileViewport()) document.getElementById("tb-title")?.focus();
      }}
    >
      {editor && !missing && (
        <EditorForm
          key={editor.mode === "edit" ? editor.taskId : "new"}
          editor={editor}
          task={task}
        />
      )}
    </Modal>
  );
}

function EditorForm({ editor, task }: { editor: Editor; task: Task | undefined }) {
  const { view, boardId, statuses, statusesById, defaultStatusId } = useBoardContext();
  const closeEditor = useUi((s) => s.closeEditor);
  const showToast = useUi((s) => s.showToast);
  const setMobileStatus = useUi((s) => s.setMobileStatus);
  const createTask = useCreateTask(boardId);
  const updateTask = useUpdateTask(boardId);
  const [draft, setDraft] = useState(() => initialDraft(editor, task, defaultStatusId));
  const [error, setError] = useState<string | null>(null);
  const titleRef = useRef<HTMLInputElement>(null);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    setDraft((d) => ({ ...d, [key]: value }));
    if (key === "title" && String(value).trim()) setError(null);
  };

  function save() {
    const title = titleSchema.safeParse(draft.title);
    if (!title.success) {
      setError(title.error.issues[0].message);
      titleRef.current?.focus();
      return;
    }
    const clean = {
      title: title.data,
      description: draft.description.trim().slice(0, LIMITS.description),
      // The column may have been deleted while the form was open.
      statusId: statusesById.has(draft.statusId) ? draft.statusId : defaultStatusId,
      priority: draft.priority,
      type: draft.type || null,
      assigneeId: draft.assigneeId || null,
      points: parsePoints(draft.points),
    };

    if (editor.mode === "create") {
      const now = new Date().toISOString();
      createTask.mutate({
        ...clean,
        id: crypto.randomUUID(),
        boardId,
        position: positionAtEnd(view.tasks.filter((t) => t.statusId === clean.statusId)),
        createdAt: now,
        updatedAt: now,
      });
      if (isMobileViewport()) setMobileStatus(clean.statusId);
      showToast(`Task created in ${statusesById.get(clean.statusId)?.name ?? "the board"}`);
    } else if (task) {
      const patch: UpdateTaskInput = {};
      for (const key of Object.keys(clean) as (keyof typeof clean)[]) {
        if (clean[key] !== task[key]) Object.assign(patch, { [key]: clean[key] });
      }
      if (Object.keys(patch).length > 0) updateTask.mutate({ taskId: task.id, patch });
      showToast("Changes saved");
    }
    closeEditor();
  }

  function onKeyDown(event: KeyboardEvent) {
    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      save();
    }
  }

  return (
    <form
      id={FORM_ID}
      noValidate
      onKeyDown={onKeyDown}
      onSubmit={(event) => {
        event.preventDefault();
        save();
      }}
      className="contents"
    >
      <Field>
        <Label htmlFor="tb-title">
          Title <span className="text-danger">*</span>
        </Label>
        <Input
          id="tb-title"
          ref={titleRef}
          value={draft.title}
          onChange={(e) => set("title", e.target.value)}
          invalid={Boolean(error)}
          aria-describedby={error ? "tb-title-error" : undefined}
          maxLength={LIMITS.title + 50}
          placeholder="e.g. [Tech][Spike] CSV Download"
          className="text-[14.5px]"
          autoComplete="off"
        />
        <FieldError id="tb-title-error">{error}</FieldError>
      </Field>

      <Field>
        <Label htmlFor="tb-desc">Description</Label>
        <Textarea
          id="tb-desc"
          rows={4}
          value={draft.description}
          onChange={(e) => set("description", e.target.value)}
          maxLength={LIMITS.description}
          placeholder="Add context, links or acceptance criteria"
        />
      </Field>

      <PriorityPicker value={draft.priority} onChange={(p) => set("priority", p)} />

      <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-4">
        <Field>
          <Label htmlFor="tb-status">Status</Label>
          <Select
            id="tb-status"
            value={statusesById.has(draft.statusId) ? draft.statusId : defaultStatusId}
            onChange={(e) => set("statusId", e.target.value)}
          >
            {statuses.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field>
          <Label htmlFor="tb-type">Task type</Label>
          <Select
            id="tb-type"
            value={draft.type}
            onChange={(e) => set("type", e.target.value as TaskType | "")}
          >
            <option value="">No type</option>
            {TASK_TYPES.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field>
          <Label htmlFor="tb-assignee">Assignee</Label>
          <Select
            id="tb-assignee"
            value={draft.assigneeId}
            onChange={(e) => set("assigneeId", e.target.value)}
          >
            <option value="">Unassigned</option>
            {view.members.map((m) => (
              <option key={m.userId} value={m.userId}>
                {m.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field>
          <Label htmlFor="tb-points">Story points</Label>
          <Input
            id="tb-points"
            type="number"
            inputMode="decimal"
            min={0}
            max={LIMITS.points}
            step={0.5}
            value={draft.points}
            onChange={(e) => set("points", e.target.value)}
            placeholder="None"
            className="tabular-nums"
          />
        </Field>
      </div>
    </form>
  );
}
