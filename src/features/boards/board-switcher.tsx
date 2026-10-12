"use client";

import { Check, ChevronDown, Pencil, Plus, Tags, Trash2, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { DropdownMenu } from "radix-ui";
import { MenuItem, MenuLabel, MenuPanel, MenuSeparator } from "@/components/ui/menu";
import { useUi } from "@/store/ui-store";
import { useBoards } from "../board/api";
import { useBoardContext } from "../board/board-context";

/** The board title in the header: lists my boards and board actions. */
export function BoardSwitcher() {
  const { view, boards: initialBoards, boardId, isOwner } = useBoardContext();
  const { data: boards } = useBoards(initialBoards);
  const openDialog = useUi((s) => s.openDialog);
  const openListDialog = useUi((s) => s.openListDialog);
  const router = useRouter();
  const total = view.tasks.length;

  return (
    <div className="flex min-w-0 items-baseline gap-2">
      <DropdownMenu.Root>
        <DropdownMenu.Trigger
          aria-label={`Board: ${view.board.name}. Switch board`}
          className="-mx-1.5 flex min-w-0 items-center gap-1 rounded-md px-1.5 py-0.5 outline-none hover:bg-surface-2 focus-visible:shadow-focus"
        >
          <h1 className="m-0 truncate text-base font-semibold tracking-[-0.01em]">
            {view.board.name}
          </h1>
          <ChevronDown size={15} strokeWidth={2} className="shrink-0 text-muted" />
        </DropdownMenu.Trigger>
        <MenuPanel align="start" className="max-w-[min(320px,calc(100vw-24px))]">
          <MenuLabel>Your boards</MenuLabel>
          {boards.map((board) => (
            <MenuItem
              key={board.id}
              onSelect={() => board.id !== boardId && router.push(`/b/${board.id}`)}
            >
              <Check
                size={15}
                className={board.id === boardId ? "text-accent" : "invisible"}
                aria-hidden
              />
              <span className="truncate">{board.name}</span>
              {board.role === "owner" && (
                <span className="ml-auto pl-3 text-xs text-muted">Owner</span>
              )}
            </MenuItem>
          ))}
          <MenuSeparator />
          <MenuItem onSelect={() => openDialog("newBoard")}>
            <Plus size={15} />
            New board
          </MenuItem>
          {isOwner && (
            <>
              <MenuItem onSelect={() => openDialog("renameBoard")}>
                <Pencil size={15} />
                Rename board
              </MenuItem>
              <MenuItem onSelect={() => openListDialog("types")}>
                <Tags size={15} />
                Task types
              </MenuItem>
              <MenuItem onSelect={() => openListDialog("people")}>
                <Users size={15} />
                Assignees
              </MenuItem>
              <MenuItem
                className="text-danger data-[highlighted]:bg-danger-soft"
                onSelect={() => openDialog("deleteBoard")}
              >
                <Trash2 size={15} />
                Delete board
              </MenuItem>
            </>
          )}
        </MenuPanel>
      </DropdownMenu.Root>
      <span className="text-[13px] whitespace-nowrap text-muted max-desk:hidden">
        {total} task{total === 1 ? "" : "s"}
      </span>
    </div>
  );
}
