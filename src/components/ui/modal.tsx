"use client";

import { X } from "lucide-react";
import { AlertDialog, Dialog } from "radix-ui";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Button, IconButton } from "./button";

interface ModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  /** Narrow dialogs (forms with one or two fields). */
  size?: "md" | "sm";
  onOpenAutoFocus?: ComponentProps<typeof Dialog.Content>["onOpenAutoFocus"];
  className?: string;
}

/**
 * Centered dialog on desktop, bottom sheet on mobile (below 720px).
 * Radix handles focus trapping, Esc and outside clicks.
 */
export function Modal({
  open,
  onOpenChange,
  title,
  children,
  footer,
  size = "md",
  onOpenAutoFocus,
  className,
}: ModalProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 flex animate-fade items-end justify-center overflow-y-auto bg-overlay desk:items-center desk:px-5 desk:py-8">
          <Dialog.Content
            aria-describedby={undefined}
            onOpenAutoFocus={onOpenAutoFocus}
            className={cn(
              "flex max-h-[92dvh] w-full animate-sheet flex-col overflow-hidden rounded-t-2xl border border-line bg-surface shadow-pop outline-none desk:max-h-[calc(100dvh-64px)] desk:animate-pop desk:rounded-xl",
              size === "md" ? "max-w-[560px]" : "max-w-[440px]",
              className,
            )}
          >
            <div className="flex justify-center pt-2 desk:hidden" aria-hidden>
              <span className="h-1 w-9 rounded-sm bg-line-strong" />
            </div>
            <div className="flex items-center gap-2.5 border-b border-line py-3.5 pr-3.5 pl-5">
              <Dialog.Title className="m-0 min-w-0 flex-1 truncate text-base font-semibold">
                {title}
              </Dialog.Title>
              <Dialog.Close asChild>
                <IconButton label="Close" size={36}>
                  <X size={16} strokeWidth={2} />
                </IconButton>
              </Dialog.Close>
            </div>
            <div className="flex flex-col gap-[18px] overflow-y-auto p-5">{children}</div>
            {footer && (
              <div className="flex items-center gap-2 border-t border-line px-5 py-3.5 pb-[max(14px,env(safe-area-inset-bottom))]">
                {footer}
              </div>
            )}
          </Dialog.Content>
        </Dialog.Overlay>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

interface ConfirmProps {
  open: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  icon?: ReactNode;
  busy?: boolean;
}

/** Destructive confirmation. Cancel gets focus first; clicking outside cancels. */
export function ConfirmDialog({
  open,
  onCancel,
  onConfirm,
  title,
  description,
  confirmLabel,
  icon,
  busy,
}: ConfirmProps) {
  return (
    <AlertDialog.Root open={open} onOpenChange={(next) => !next && onCancel()}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay
          className="fixed inset-0 z-[60] flex animate-fade items-center justify-center bg-overlay p-5"
          onClick={(event) => event.target === event.currentTarget && onCancel()}
        >
          <AlertDialog.Content className="flex w-full max-w-[400px] animate-pop flex-col gap-[18px] rounded-xl border border-line bg-surface p-5 shadow-pop outline-none">
            <div className="flex items-start gap-3.5">
              {icon && (
                <div className="grid size-[38px] shrink-0 place-items-center rounded-full bg-danger-soft text-danger">
                  {icon}
                </div>
              )}
              <div className="flex min-w-0 flex-col gap-1.5 pt-0.5">
                <AlertDialog.Title className="m-0 text-base font-semibold">
                  {title}
                </AlertDialog.Title>
                <AlertDialog.Description className="m-0 text-[13.5px] leading-[1.55] [overflow-wrap:anywhere] text-muted">
                  {description}
                </AlertDialog.Description>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <AlertDialog.Cancel asChild>
                <Button variant="secondary">Cancel</Button>
              </AlertDialog.Cancel>
              <Button variant="danger" onClick={onConfirm} disabled={busy}>
                {confirmLabel}
              </Button>
            </div>
          </AlertDialog.Content>
        </AlertDialog.Overlay>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
