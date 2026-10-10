import type { ReactNode } from "react";
import type { Tone } from "@/config/board";
import { toneVars } from "@/domain/tone";
import { cn } from "@/lib/cn";

/** Colored label (priority, type, assignee, status). */
export function Tag({
  tone,
  children,
  className,
}: {
  tone: Tone;
  children: ReactNode;
  className?: string;
}) {
  const { bg, fg } = toneVars(tone);
  return (
    <span
      className={cn(
        "inline-flex h-[22px] items-center rounded px-[7px] text-[12.5px] whitespace-nowrap",
        className,
      )}
      style={{ background: bg, color: fg }}
    >
      {children}
    </span>
  );
}
