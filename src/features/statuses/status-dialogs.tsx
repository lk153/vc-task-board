"use client";

import { Trash2 } from "lucide-react";
import { useState } from "react";
import { LIMITS, TONES, type Tone } from "@/config/board";
import { statusNameSchema, type BoardStatus } from "@/domain/task";
import { Button } from "@/components/ui/button";
import { Field, FieldError, Input, Label, Select } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { Tag } from "@/components/ui/tag";
import { ApiError } from "@/lib/api-client";
import { useUi } from "@/store/ui-store";
import { useCreateStatus, useDeleteStatus, useUpdateStatus } from "../board/api";
import { useBoardContext } from "../board/board-context";
import { TonePicker } from "@/components/ui/tone-picker";

const plural = (n: number) => `${n} task${n === 1 ? "" : "s"}`;

/** Add / edit / delete status dialogs, driven by `statusDialog` in the UI store. */
export function StatusDialogs() {
  const dialog = useUi((s) => s.statusDialog);
  const { statusesById } = useBoardContext();
  const status = dialog && dialog.mode !== "add" ? statusesById.get(dialog.statusId) : undefined;
  // Someone may have deleted the status meanwhile.
  const missing = Boolean(dialog && dialog.mode !== "add" && !status);

  return (
    <>
      <StatusEditorDialog
        key={dialog?.mode === "edit" ? `edit-${status?.id}` : `add-${dialog?.mode === "add"}`}
        open={!missing && (dialog?.mode === "add" || dialog?.mode === "edit")}
        status={dialog?.mode === "edit" ? status : undefined}
      />
      {dialog?.mode === "delete" && status && (
        <DeleteStatusDialog key={status.id} status={status} />
      )}
    </>
  );
}

function StatusEditorDialog({ open, status }: { open: boolean; status?: BoardStatus }) {
  const { boardId, statuses } = useBoardContext();
  const close = useUi((s) => s.closeStatusDialog);
  const showToast = useUi((s) => s.showToast);
  const createStatus = useCreateStatus(boardId);
  const updateStatus = useUpdateStatus(boardId);
  const unusedTone = TONES.find((t) => !statuses.some((s) => s.tone === t)) ?? "gray";
  const [name, setName] = useState(status?.name ?? "");
  const [tone, setTone] = useState<Tone>(status?.tone ?? unusedTone);
  const [makeDefault, setMakeDefault] = useState(status?.isDefault ?? false);
  const [error, setError] = useState<string | null>(null);
  const editing = Boolean(status);

  function submit() {
    const parsed = statusNameSchema.safeParse(name);
    if (!parsed.success) return setError(parsed.error.issues[0].message);
    const clash = statuses.find(
      (s) => s.id !== status?.id && s.name.toLowerCase() === parsed.data.toLowerCase(),
    );
    if (clash) return setError(`There's already a status called “${clash.name}”.`);

    if (!status) {
      createStatus.mutate(
        { name: parsed.data, tone },
        {
          onSuccess: (created) => {
            close();
            showToast(`Added “${created.name}”`);
          },
          onError: (err) => setError(err instanceof ApiError ? err.message : "Couldn't add it."),
        },
      );
      return;
    }

    const patch = {
      ...(parsed.data !== status.name ? { name: parsed.data } : {}),
      ...(tone !== status.tone ? { tone } : {}),
      ...(makeDefault && !status.isDefault ? { isDefault: true as const } : {}),
    };
    if (Object.keys(patch).length > 0) {
      updateStatus.mutate({ statusId: status.id, patch });
      showToast("Status updated");
    }
    close();
  }

  return (
    <Modal
      open={open}
      onOpenChange={(next) => !next && close()}
      title={editing ? "Edit status" : "Add status"}
      size="sm"
      footer={
        <>
          <span className="flex-1" />
          <Button variant="secondary" onClick={close}>
            Cancel
          </Button>
          <Button
            variant="primary"
            type="submit"
            form="status-form"
            disabled={createStatus.isPending}
          >
            {editing ? "Save" : "Add status"}
          </Button>
        </>
      }
    >
      <form
        id="status-form"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
        className="contents"
      >
        <Field>
          <Label htmlFor="status-name">Name</Label>
          <Input
            id="status-name"
            autoFocus
            autoComplete="off"
            value={name}
            maxLength={LIMITS.statusName + 10}
            onChange={(e) => {
              setName(e.target.value);
              setError(null);
            }}
            invalid={Boolean(error)}
            placeholder="e.g. Blocked"
          />
          <FieldError>{error}</FieldError>
        </Field>
        <Field>
          <span id="status-color-label" className="text-[12.5px] font-medium text-muted">
            Color
          </span>
          <TonePicker value={tone} onChange={setTone} labelledBy="status-color-label" />
        </Field>
        <div className="flex items-center gap-2 text-[12.5px] text-muted">
          Preview
          <Tag tone={tone} className="h-6 text-[13px] font-medium">
            {name.trim() || "Status name"}
          </Tag>
        </div>
        {editing && (
          <label className="flex items-start gap-2.5 text-[13.5px]">
            <input
              type="checkbox"
              checked={makeDefault}
              disabled={status?.isDefault}
              onChange={(e) => setMakeDefault(e.target.checked)}
              className="mt-0.5 size-4 accent-[var(--accent)]"
            />
            <span>
              Use for new tasks
              <span className="block text-xs text-muted">
                {status?.isDefault
                  ? "New tasks go here. To change it, pick another status as the default."
                  : "“New task” and the N key will put tasks here."}
              </span>
            </span>
          </label>
        )}
      </form>
    </Modal>
  );
}

function DeleteStatusDialog({ status }: { status: BoardStatus }) {
  const { boardId, view, statuses, defaultStatusId } = useBoardContext();
  const close = useUi((s) => s.closeStatusDialog);
  const showToast = useUi((s) => s.showToast);
  const deleteStatus = useDeleteStatus(boardId);
  const others = statuses.filter((s) => s.id !== status.id);
  const taskCount = view.tasks.filter((t) => t.statusId === status.id).length;
  const [moveTo, setMoveTo] = useState(
    others.find((s) => s.id === defaultStatusId)?.id ?? others[0]?.id ?? "",
  );
  const target = others.find((s) => s.id === moveTo);
  const askWhere = taskCount > 0 || status.isDefault;

  function confirm() {
    // Always say where: it also receives tasks that were deleted (for Undo).
    deleteStatus.mutate({ statusId: status.id, moveTo: moveTo || null });
    close();
    showToast(
      taskCount > 0 && target
        ? `Deleted “${status.name}” · ${plural(taskCount)} moved to “${target.name}”`
        : `Deleted “${status.name}”`,
    );
  }

  return (
    <Modal
      open
      onOpenChange={(next) => !next && close()}
      title={`Delete “${status.name}”?`}
      size="sm"
      footer={
        <>
          <span className="flex-1" />
          <Button variant="secondary" onClick={close}>
            Cancel
          </Button>
          <Button variant="danger" onClick={confirm} disabled={!moveTo}>
            <Trash2 size={15} aria-hidden />
            Delete status
          </Button>
        </>
      }
    >
      <p className="m-0 text-[13.5px] leading-relaxed text-muted">
        The “{status.name}” column will be removed from the board for everyone.
        {taskCount === 0 && " It has no tasks."}
      </p>
      {askWhere && (
        <Field>
          <Label htmlFor="status-move-to">
            {taskCount > 0 ? `Move its ${plural(taskCount)} to` : "New tasks will go to"}
          </Label>
          <Select id="status-move-to" value={moveTo} onChange={(e) => setMoveTo(e.target.value)}>
            {others.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
          {taskCount > 0 && status.isDefault && (
            <span className="text-xs text-muted">New tasks will go there too.</span>
          )}
        </Field>
      )}
    </Modal>
  );
}
