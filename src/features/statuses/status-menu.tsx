"use client";

import { ArrowLeft, ArrowRight, MoreHorizontal, Pencil, Star, Trash2 } from "lucide-react";
import { DropdownMenu } from "radix-ui";
import { positionBetween } from "@/domain/ordering";
import type { BoardStatus } from "@/domain/task";
import { MenuItem, MenuPanel, MenuSeparator } from "@/components/ui/menu";
import { cn } from "@/lib/cn";
import { useUi } from "@/store/ui-store";
import { useUpdateStatus } from "../board/api";
import { useBoardContext } from "../board/board-context";

/**
 * Owner actions for one status (column): edit, move left/right, use for new
 * tasks, delete. Used in the column header (desktop) and next to the status
 * tabs (mobile).
 */
export function StatusMenu({ status, className }: { status: BoardStatus; className?: string }) {
  const { boardId, statuses } = useBoardContext();
  const openStatusDialog = useUi((s) => s.openStatusDialog);
  const showToast = useUi((s) => s.showToast);
  const updateStatus = useUpdateStatus(boardId);
  const index = statuses.findIndex((s) => s.id === status.id);

  function move(direction: -1 | 1) {
    const position =
      direction < 0
        ? positionBetween(statuses[index - 2]?.position ?? null, statuses[index - 1].position)
        : positionBetween(statuses[index + 1].position, statuses[index + 2]?.position ?? null);
    updateStatus.mutate({ statusId: status.id, patch: { position } });
  }

  return (
    <DropdownMenu.Root modal={false}>
      <DropdownMenu.Trigger
        aria-label={`Options for ${status.name}`}
        title="Status options"
        className={cn(
          "grid size-7 shrink-0 place-items-center rounded-md text-muted outline-none hover:bg-surface-3 hover:text-fg focus-visible:shadow-focus data-[state=open]:bg-surface-3",
          className,
        )}
      >
        <MoreHorizontal size={16} strokeWidth={2} aria-hidden />
      </DropdownMenu.Trigger>
      <MenuPanel align="end">
        <MenuItem onSelect={() => openStatusDialog({ mode: "edit", statusId: status.id })}>
          <Pencil size={15} aria-hidden />
          Edit status
        </MenuItem>
        <MenuItem disabled={index <= 0} onSelect={() => move(-1)}>
          <ArrowLeft size={15} aria-hidden />
          Move left
        </MenuItem>
        <MenuItem disabled={index >= statuses.length - 1} onSelect={() => move(1)}>
          <ArrowRight size={15} aria-hidden />
          Move right
        </MenuItem>
        {!status.isDefault && (
          <MenuItem
            onSelect={() => {
              updateStatus.mutate({ statusId: status.id, patch: { isDefault: true } });
              showToast(`New tasks now go to “${status.name}”`);
            }}
          >
            <Star size={15} aria-hidden />
            Use for new tasks
          </MenuItem>
        )}
        <MenuSeparator />
        <MenuItem
          disabled={statuses.length <= 1}
          className="text-danger data-[highlighted]:bg-danger-soft"
          onSelect={() => openStatusDialog({ mode: "delete", statusId: status.id })}
        >
          <Trash2 size={15} aria-hidden />
          Delete status
        </MenuItem>
      </MenuPanel>
    </DropdownMenu.Root>
  );
}
