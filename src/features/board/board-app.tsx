"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo } from "react";
import { COOKIES } from "@/config/board";
import type { BoardSummary, BoardView } from "@/domain/task";
import { ApiError } from "@/lib/api-client";
import { useUi } from "@/store/ui-store";
import { ChangePasswordDialog } from "../account/change-password-dialog";
import { BoardDialogs } from "../boards/board-dialogs";
import { ShareDialog } from "../sharing/share-dialog";
import { DeleteTaskDialog } from "../task-delete/delete-task-dialog";
import { TaskEditor } from "../task-editor/task-editor";
import { useBoard } from "./api";
import { BoardContext, type Me } from "./board-context";
import { BoardColumns } from "./board-columns";
import { BulkBar } from "./bulk-bar";
import { Fab } from "./fab";
import { FilterBar } from "./filter-bar";
import { Header } from "./header";
import { StatusTabs } from "./status-tabs";
import { useBoardHotkeys } from "./use-hotkeys";

interface BoardAppProps {
  initialView: BoardView;
  initialBoards: BoardSummary[];
  me: Me;
  providers: string[];
  googleEnabled: boolean;
}

/** The board screen. Server data comes in as initialData and is kept fresh by TanStack Query. */
export function BoardApp({
  initialView,
  initialBoards,
  me,
  providers,
  googleEnabled,
}: BoardAppProps) {
  const boardId = initialView.board.id;
  const router = useRouter();
  const { data: view, error } = useBoard(boardId, initialView);

  useEffect(() => {
    useUi.getState().resetForBoard();
    document.cookie = `${COOKIES.lastBoard}=${boardId}; path=/; max-age=31536000; SameSite=Lax`;
  }, [boardId]);

  // Signed out elsewhere, or removed from the board by an owner.
  useEffect(() => {
    if (!(error instanceof ApiError)) return;
    if (error.status === 401) router.replace(`/sign-in?next=/b/${boardId}`);
    if (error.status === 404) {
      useUi.getState().showToast("You no longer have access to that board");
      router.replace("/");
    }
  }, [error, boardId, router]);

  useBoardHotkeys();

  const context = useMemo(
    () => ({
      boardId,
      view,
      boards: initialBoards,
      me,
      isOwner: view.board.role === "owner",
      membersById: new Map(view.members.map((m) => [m.userId, m])),
      providers,
      googleEnabled,
    }),
    [boardId, view, initialBoards, me, providers, googleEnabled],
  );

  return (
    <BoardContext value={context}>
      <title>{`${view.board.name} · Task board`}</title>
      <div className="flex min-h-dvh flex-col bg-canvas text-fg">
        <Header />
        <FilterBar />
        <StatusTabs />
        <BoardColumns />
        <Fab />
        <BulkBar />
      </div>
      <TaskEditor />
      <DeleteTaskDialog />
      <ShareDialog />
      <BoardDialogs />
      <ChangePasswordDialog />
    </BoardContext>
  );
}
