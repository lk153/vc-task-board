"use client";

import { useRef, type KeyboardEvent } from "react";
import { PRIORITIES } from "@/config/board";
import type { Priority } from "@/domain/task";
import { toneVars } from "@/domain/tone";
import { cn } from "@/lib/cn";

/** Four-way segmented radio group with arrow-key navigation. */
export function PriorityPicker({
  value,
  onChange,
}: {
  value: Priority;
  onChange: (priority: Priority) => void;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  function onKeyDown(event: KeyboardEvent, index: number) {
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key];
    if (!step) return;
    event.preventDefault();
    const next = (index + step + PRIORITIES.length) % PRIORITIES.length;
    onChange(PRIORITIES[next].id);
    refs.current[next]?.focus();
  }

  return (
    <div className="flex flex-col gap-1.5">
      <span id="tb-pri-label" className="text-[12.5px] font-medium text-muted">
        Priority
      </span>
      <div role="radiogroup" aria-labelledby="tb-pri-label" className="grid grid-cols-4 gap-1.5">
        {PRIORITIES.map((priority, index) => {
          const checked = priority.id === value;
          const { bg, fg } = toneVars(priority.tone);
          return (
            <button
              key={priority.id}
              ref={(el) => {
                refs.current[index] = el;
              }}
              type="button"
              role="radio"
              aria-checked={checked}
              tabIndex={checked ? 0 : -1}
              onClick={() => onChange(priority.id)}
              onKeyDown={(event) => onKeyDown(event, index)}
              className={cn(
                "flex h-9 min-w-0 items-center justify-center gap-1.5 rounded-md border px-1.5 text-[13px] font-medium outline-none focus-visible:shadow-focus",
                !checked && "border-line-strong bg-surface text-fg",
              )}
              style={checked ? { background: bg, color: fg, borderColor: bg } : undefined}
            >
              <span
                aria-hidden
                className="size-2 flex-none rounded-full"
                style={{ background: checked ? fg : priority.dot }}
              />
              <span className="truncate">{priority.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
