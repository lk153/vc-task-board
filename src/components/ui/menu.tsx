"use client";

import { Check } from "lucide-react";
import { DropdownMenu } from "radix-ui";
import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

/** Styled Radix dropdown pieces shared by the board switcher, filters and the account menu. */
export function MenuPanel({
  className,
  sideOffset = 6,
  ...props
}: ComponentProps<typeof DropdownMenu.Content>) {
  return (
    <DropdownMenu.Portal>
      <DropdownMenu.Content
        sideOffset={sideOffset}
        collisionPadding={12}
        className={cn(
          "z-[45] max-h-[min(70dvh,var(--radix-dropdown-menu-content-available-height))] min-w-52 animate-fade overflow-y-auto rounded-lg border border-line bg-surface p-1 text-fg shadow-pop outline-none",
          className,
        )}
        {...props}
      />
    </DropdownMenu.Portal>
  );
}

export function MenuItem({ className, ...props }: ComponentProps<typeof DropdownMenu.Item>) {
  return (
    <DropdownMenu.Item
      className={cn(
        "flex h-9 cursor-pointer items-center gap-2.5 rounded-md px-2.5 text-[13.5px] outline-none select-none data-[disabled]:cursor-default data-[disabled]:opacity-50 data-[highlighted]:bg-surface-2",
        className,
      )}
      {...props}
    />
  );
}

/** Menu item with a checkbox. Stays open when toggled, so several values can be picked. */
export function MenuCheckboxItem({
  className,
  children,
  onSelect,
  ...props
}: ComponentProps<typeof DropdownMenu.CheckboxItem>) {
  return (
    <DropdownMenu.CheckboxItem
      onSelect={(event) => {
        event.preventDefault();
        onSelect?.(event);
      }}
      className={cn(
        "group flex h-9 cursor-pointer items-center gap-2.5 rounded-md px-2.5 text-[13.5px] outline-none select-none data-[highlighted]:bg-surface-2",
        className,
      )}
      {...props}
    >
      <span
        aria-hidden
        className="grid size-4 shrink-0 place-items-center rounded border border-line-strong bg-surface text-accent-fg group-data-[state=checked]:border-accent group-data-[state=checked]:bg-accent"
      >
        <DropdownMenu.ItemIndicator>
          <Check size={12} strokeWidth={3} />
        </DropdownMenu.ItemIndicator>
      </span>
      {children}
    </DropdownMenu.CheckboxItem>
  );
}

export function MenuLabel({ className, ...props }: ComponentProps<typeof DropdownMenu.Label>) {
  return (
    <DropdownMenu.Label
      className={cn("px-2.5 pt-1.5 pb-1 text-xs font-medium text-muted", className)}
      {...props}
    />
  );
}

export function MenuSeparator() {
  return <DropdownMenu.Separator className="my-1 h-px bg-line" />;
}
