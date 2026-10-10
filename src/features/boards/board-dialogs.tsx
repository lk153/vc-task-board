"use client";

import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { LIMITS } from "@/config/board";
import { boardNameSchema } from "@/domain/task";
import { Button } from "@/components/ui/button";
import { Field, FieldError, Input, Label } from "@/components/ui/field";
import { ConfirmDialog, Modal } from "@/components/ui/modal";
import { ApiError } from "@/lib/api-client";
import { useUi } from "@/store/ui-store";
import { useCreateBoard, useDeleteBoard, useRenameBoard } from "../board/api";
import { useBoardContext } from "../board/board-context";

/** New / rename / delete board. */
export function BoardDialogs() {
  const dialog = useUi((s) => s.dialog);
  return (
    <>
      <BoardNameDialog
        key={`new-${dialog === "newBoard"}`}
        mode="new"
        open={dialog === "newBoard"}
      />
      <BoardNameDialog
        key={`rename-${dialog === "renameBoard"}`}
        mode="rename"
        open={dialog === "renameBoard"}
      />
      <DeleteBoardDialog open={dialog === "deleteBoard"} />
    </>
  );
}

function BoardNameDialog({ mode, open }: { mode: "new" | "rename"; open: boolean }) {
  const { view, boardId } = useBoardContext();
  const closeDialog = useUi((s) => s.closeDialog);
  const showToast = useUi((s) => s.showToast);
  const createBoard = useCreateBoard();
  const renameBoard = useRenameBoard(boardId);
  const router = useRouter();
  const [name, setName] = useState(mode === "rename" ? view.board.name : "");
  const [error, setError] = useState<string | null>(null);
  const busy = createBoard.isPending || renameBoard.isPending;

  function submit() {
    const parsed = boardNameSchema.safeParse(name);
    if (!parsed.success) return setError(parsed.error.issues[0].message);
    const onError = (err: Error) =>
      setError(err instanceof ApiError ? err.message : "Couldn't save. Try again.");
    if (mode === "new") {
      createBoard.mutate(parsed.data, {
        onSuccess: (board) => {
          closeDialog();
          showToast(`Board “${board.name}” created`);
          router.push(`/b/${board.id}`);
        },
        onError,
      });
    } else {
      renameBoard.mutate(parsed.data, {
        onSuccess: () => {
          closeDialog();
          showToast("Board renamed");
        },
        onError,
      });
    }
  }

  return (
    <Modal
      open={open}
      onOpenChange={(next) => !next && closeDialog()}
      title={mode === "new" ? "New board" : "Rename board"}
      size="sm"
      footer={
        <>
          <span className="flex-1" />
          <Button variant="secondary" onClick={closeDialog}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" form="board-name-form" disabled={busy}>
            {mode === "new" ? "Create board" : "Save"}
          </Button>
        </>
      }
    >
      <form
        id="board-name-form"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <Field>
          <Label htmlFor="board-name">Board name</Label>
          <Input
            id="board-name"
            autoFocus
            autoComplete="off"
            value={name}
            maxLength={LIMITS.boardName + 20}
            onChange={(e) => {
              setName(e.target.value);
              setError(null);
            }}
            invalid={Boolean(error)}
            placeholder="e.g. Sprint 12"
          />
          <FieldError>{error}</FieldError>
        </Field>
      </form>
    </Modal>
  );
}

function DeleteBoardDialog({ open }: { open: boolean }) {
  const { view, boardId } = useBoardContext();
  const closeDialog = useUi((s) => s.closeDialog);
  const showToast = useUi((s) => s.showToast);
  const deleteBoard = useDeleteBoard(boardId);
  const router = useRouter();

  return (
    <ConfirmDialog
      open={open}
      onCancel={closeDialog}
      busy={deleteBoard.isPending}
      onConfirm={() =>
        deleteBoard.mutate(undefined, {
          onSuccess: () => {
            closeDialog();
            showToast(`Board “${view.board.name}” deleted`);
            router.replace("/");
          },
          onError: () => showToast("Couldn't delete the board. Try again."),
        })
      }
      title={`Delete “${view.board.name}”?`}
      description="The board and all its tasks will be deleted for every member. This can’t be undone."
      confirmLabel="Delete board"
      icon={<Trash2 size={17} />}
    />
  );
}
