"use client";

import { Pencil, Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ASSIGNEE_TONES, LIMITS, TONES, type Tone } from "@/config/board";
import { personNameSchema, typeNameSchema } from "@/domain/task";
import { Button, IconButton } from "@/components/ui/button";
import { Field, FieldError, Input, Label, Select } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { Tag } from "@/components/ui/tag";
import { TonePicker } from "@/components/ui/tone-picker";
import { ApiError } from "@/lib/api-client";
import { useUi, type ListKind } from "@/store/ui-store";
import {
  useCreatePerson,
  useCreateTaskType,
  useDeletePerson,
  useDeleteTaskType,
  useUpdatePerson,
  useUpdateTaskType,
} from "../board/api";
import { useBoardContext } from "../board/board-context";

/** A task type or a person, as the manager shows them. */
interface Entry {
  id: string;
  name: string;
  tone: Tone;
  /** Task types: given to new tasks. */
  isDefault?: boolean;
  /** People: linked account, if they're (or were) a member. */
  userId?: string | null;
}

type Screen =
  | { mode: "list" }
  | { mode: "add" }
  | { mode: "edit"; id: string }
  | { mode: "delete"; id: string };

interface FormState {
  name: string;
  tone: Tone;
  isDefault: boolean;
  error: string | null;
}

const plural = (n: number) => `${n} task${n === 1 ? "" : "s"}`;

const COPY = {
  types: {
    title: "Task types",
    addTitle: "Add task type",
    editTitle: "Edit task type",
    addLabel: "Add type",
    empty: "No task types yet. Add one to label tasks, e.g. Bug or Clothes.",
    none: "No type",
    placeholder: "e.g. Bug",
    max: LIMITS.typeName,
    limit: LIMITS.types,
    schema: typeNameSchema,
    tones: TONES,
    duplicate: (name: string) => `There's already a task type called “${name}”.`,
    moveLabel: (n: number) => `Change its ${plural(n)} to`,
    removed: "will be removed from this board's task types.",
  },
  people: {
    title: "Assignees",
    addTitle: "Add person",
    editTitle: "Edit person",
    addLabel: "Add person",
    empty: "Nobody yet. Add the people you assign tasks to — they don't need an account.",
    none: "Unassigned",
    placeholder: "e.g. Lan",
    max: LIMITS.personName,
    limit: LIMITS.people,
    schema: personNameSchema,
    tones: ASSIGNEE_TONES,
    duplicate: (name: string) => `“${name}” is already on the list.`,
    moveLabel: (n: number) => `Reassign their ${plural(n)} to`,
    removed: "will be removed from this board's assignees.",
  },
} as const;

/** Task type / assignee manager for owners, driven by `listDialog` in the UI store. */
export function ListDialog() {
  const kind = useUi((s) => s.listDialog);
  return kind ? <ListManager key={kind} kind={kind} /> : null;
}

/** One dialog with three screens: the list, add/edit form, and delete. */
function ListManager({ kind }: { kind: ListKind }) {
  const { boardId, view, types, people } = useBoardContext();
  const close = useUi((s) => s.closeListDialog);
  const showToast = useUi((s) => s.showToast);
  const createType = useCreateTaskType(boardId);
  const updateType = useUpdateTaskType(boardId);
  const deleteType = useDeleteTaskType(boardId);
  const createPerson = useCreatePerson(boardId);
  const updatePerson = useUpdatePerson(boardId);
  const deletePerson = useDeletePerson(boardId);
  const copy = COPY[kind];
  const entries: Entry[] = kind === "types" ? types : people;

  const [screen, setScreen] = useState<Screen>({ mode: "list" });
  const [form, setForm] = useState<FormState>({
    name: "",
    tone: copy.tones[0],
    isDefault: false,
    error: null,
  });
  const [moveTo, setMoveTo] = useState("");
  /** What to focus when the list comes back. */
  const [returnFocus, setReturnFocus] = useState<string | null>(null);

  const counts = useMemo(() => {
    const result = new Map<string, number>();
    for (const task of view.tasks) {
      const id = kind === "types" ? task.typeId : task.assigneeId;
      if (id) result.set(id, (result.get(id) ?? 0) + 1);
    }
    return result;
  }, [view.tasks, kind]);
  const memberIds = useMemo(() => new Set(view.members.map((m) => m.userId)), [view.members]);
  const isMember = (entry?: Entry) => Boolean(entry?.userId && memberIds.has(entry.userId));

  // Someone else may delete the entry while it's open here.
  const current =
    screen.mode === "edit" || screen.mode === "delete"
      ? entries.find((e) => e.id === screen.id)
      : undefined;
  const active: Screen =
    (screen.mode === "edit" || screen.mode === "delete") && !current ? { mode: "list" } : screen;

  useEffect(() => {
    if (active.mode === "list" && returnFocus) document.getElementById(returnFocus)?.focus();
  }, [active.mode, returnFocus]);

  function showList(focusId: string | null) {
    setReturnFocus(focusId);
    setScreen({ mode: "list" });
  }

  function openForm(entry?: Entry) {
    const unused = copy.tones.find((t) => !entries.some((e) => e.tone === t)) ?? copy.tones[0];
    setForm({
      name: entry?.name ?? "",
      tone: entry?.tone ?? unused,
      isDefault: entry?.isDefault ?? false,
      error: null,
    });
    setScreen(entry ? { mode: "edit", id: entry.id } : { mode: "add" });
  }

  function openDelete(entry: Entry) {
    setMoveTo("");
    setScreen({ mode: "delete", id: entry.id });
  }

  function save() {
    const parsed = copy.schema.safeParse(form.name);
    if (!parsed.success) return setForm((f) => ({ ...f, error: parsed.error.issues[0].message }));
    const name = parsed.data;
    const clash = entries.find(
      (e) => e.id !== current?.id && e.name.toLowerCase() === name.toLowerCase(),
    );
    if (clash) return setForm((f) => ({ ...f, error: copy.duplicate(clash.name) }));

    if (active.mode === "add") {
      const options = {
        onSuccess: (created: { id: string; name: string }) => {
          showList(`list-edit-${created.id}`);
          showToast(`Added “${created.name}”`);
        },
        onError: (err: Error) =>
          setForm((f) => ({
            ...f,
            error: err instanceof ApiError ? err.message : "Couldn't add it. Try again.",
          })),
      };
      if (kind === "types") {
        createType.mutate({ name, tone: form.tone, isDefault: form.isDefault }, options);
      } else {
        createPerson.mutate({ name, tone: form.tone }, options);
      }
      return;
    }

    if (!current) return;
    const patch = {
      ...(name !== current.name ? { name } : {}),
      ...(form.tone !== current.tone ? { tone: form.tone } : {}),
    };
    if (kind === "types") {
      const typePatch = {
        ...patch,
        ...(form.isDefault !== Boolean(current.isDefault) ? { isDefault: form.isDefault } : {}),
      };
      if (Object.keys(typePatch).length > 0) {
        updateType.mutate({ typeId: current.id, patch: typePatch });
      }
    } else if (Object.keys(patch).length > 0) {
      updatePerson.mutate({ personId: current.id, patch });
    }
    showToast("Saved");
    showList(`list-edit-${current.id}`);
  }

  function remove() {
    if (!current) return;
    const count = counts.get(current.id) ?? 0;
    const target = entries.find((e) => e.id === moveTo);
    if (kind === "types") deleteType.mutate({ typeId: current.id, moveTo: moveTo || null });
    else deletePerson.mutate({ personId: current.id, moveTo: moveTo || null });
    showList("list-add");
    showToast(
      count > 0
        ? `Deleted “${current.name}” · ${plural(count)} changed to “${target?.name ?? copy.none}”`
        : `Deleted “${current.name}”`,
    );
  }

  let title: string;
  let body: ReactNode;
  let footer: ReactNode;

  if (active.mode === "add" || active.mode === "edit") {
    title = active.mode === "add" ? copy.addTitle : copy.editTitle;
    const back = () => showList(current ? `list-edit-${current.id}` : "list-add");
    footer = (
      <>
        <span className="flex-1" />
        <Button variant="secondary" onClick={back}>
          Back
        </Button>
        <Button
          variant="primary"
          type="submit"
          form="list-entry-form"
          disabled={createType.isPending || createPerson.isPending}
        >
          {active.mode === "add" ? copy.addLabel : "Save"}
        </Button>
      </>
    );
    body = (
      <form
        id="list-entry-form"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          save();
        }}
        className="contents"
      >
        <Field>
          <Label htmlFor="list-entry-name">Name</Label>
          <Input
            id="list-entry-name"
            autoFocus
            autoComplete="off"
            value={form.name}
            maxLength={copy.max + 10}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value, error: null }))}
            invalid={Boolean(form.error)}
            aria-describedby={form.error ? "list-entry-error" : undefined}
            placeholder={copy.placeholder}
          />
          <FieldError id="list-entry-error">{form.error}</FieldError>
          {isMember(current) && (
            <span className="text-xs text-muted">
              A board member. This name is only used on this board.
            </span>
          )}
        </Field>
        <Field>
          <span id="list-entry-color" className="text-[12.5px] font-medium text-muted">
            Color
          </span>
          <TonePicker
            value={form.tone}
            onChange={(tone) => setForm((f) => ({ ...f, tone }))}
            labelledBy="list-entry-color"
          />
        </Field>
        <div className="flex min-w-0 items-center gap-2 text-[12.5px] text-muted">
          Preview
          <Tag tone={form.tone} className="min-w-0">
            <span className="truncate">{form.name.trim() || "Name"}</span>
          </Tag>
        </div>
        {kind === "types" && (
          <label className="flex items-start gap-2.5 text-[13.5px]">
            <input
              type="checkbox"
              checked={form.isDefault}
              onChange={(e) => setForm((f) => ({ ...f, isDefault: e.target.checked }))}
              className="mt-0.5 size-4 accent-[var(--accent)]"
            />
            <span>
              Use for new tasks
              <span className="block text-xs text-muted">
                New tasks start with this type. Only one type can be the default.
              </span>
            </span>
          </label>
        )}
      </form>
    );
  } else if (active.mode === "delete" && current) {
    const count = counts.get(current.id) ?? 0;
    const target = entries.find((e) => e.id === moveTo);
    title = `Delete “${current.name}”?`;
    footer = (
      <>
        <span className="flex-1" />
        <Button variant="secondary" onClick={() => showList(`list-edit-${current.id}`)}>
          Back
        </Button>
        <Button variant="danger" onClick={remove}>
          <Trash2 size={15} aria-hidden />
          Delete
        </Button>
      </>
    );
    body = (
      <>
        <p className="m-0 text-[13.5px] leading-relaxed text-muted">
          “{current.name}” {copy.removed}
          {count === 0 && " No tasks use it."}
          {isMember(current) && " They stay a member of the board; to remove access, use Share."}
        </p>
        {count > 0 && (
          <Field>
            <Label htmlFor="list-move-to">{copy.moveLabel(count)}</Label>
            <Select id="list-move-to" value={moveTo} onChange={(e) => setMoveTo(e.target.value)}>
              <option value="">{copy.none}</option>
              {entries
                .filter((e) => e.id !== current.id)
                .map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                  </option>
                ))}
            </Select>
          </Field>
        )}
        {current.isDefault && (
          <span className="text-xs text-muted">
            New tasks will get {target ? `“${target.name}”` : "no type"}.
          </span>
        )}
      </>
    );
  } else {
    title = copy.title;
    footer = (
      <>
        <Button
          id="list-add"
          variant="secondary"
          disabled={entries.length >= copy.limit}
          onClick={() => openForm()}
        >
          <Plus size={15} aria-hidden />
          {copy.addLabel}
        </Button>
        <span className="flex-1" />
        <Button variant="primary" onClick={close}>
          Done
        </Button>
      </>
    );
    body =
      entries.length === 0 ? (
        <p className="m-0 text-[13.5px] leading-relaxed text-muted">{copy.empty}</p>
      ) : (
        <ul aria-label={copy.title} className="-my-2 flex list-none flex-col p-0">
          {entries.map((entry) => {
            const note = entry.isDefault ? "New tasks" : isMember(entry) ? "Member" : null;
            return (
              <li
                key={entry.id}
                className="flex min-h-12 items-center gap-2 border-b border-line py-1.5 last:border-b-0"
              >
                <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1">
                  <Tag tone={entry.tone} className="max-w-full">
                    <span className="truncate">{entry.name}</span>
                  </Tag>
                  {note && <span className="text-xs text-muted">{note}</span>}
                </div>
                <span className="shrink-0 text-xs text-muted tabular-nums">
                  {plural(counts.get(entry.id) ?? 0)}
                </span>
                <IconButton
                  id={`list-edit-${entry.id}`}
                  label={`Edit ${entry.name}`}
                  size={36}
                  onClick={() => openForm(entry)}
                >
                  <Pencil size={15} aria-hidden />
                </IconButton>
                <IconButton
                  label={`Delete ${entry.name}`}
                  size={36}
                  onClick={() => openDelete(entry)}
                >
                  <Trash2 size={15} aria-hidden />
                </IconButton>
              </li>
            );
          })}
        </ul>
      );
  }

  return (
    <Modal open onOpenChange={(next) => !next && close()} title={title} size="sm" footer={footer}>
      {body}
    </Modal>
  );
}
