"use client";

import { Check } from "lucide-react";
import { useRef, type KeyboardEvent } from "react";
import { TONES, type Tone } from "@/config/board";
import { toneVars } from "@/domain/tone";
import { cn } from "@/lib/cn";

const toneName = (tone: Tone) => tone[0].toUpperCase() + tone.slice(1);

/** Color swatches as a radio group (arrow keys move between them). */
export function TonePicker({
  value,
  onChange,
  labelledBy,
}: {
  value: Tone;
  onChange: (tone: Tone) => void;
  labelledBy: string;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  function onKeyDown(event: KeyboardEvent, index: number) {
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key];
    if (!step) return;
    event.preventDefault();
    const next = (index + step + TONES.length) % TONES.length;
    onChange(TONES[next]);
    refs.current[next]?.focus();
  }

  return (
    <div role="radiogroup" aria-labelledby={labelledBy} className="flex flex-wrap gap-2">
      {TONES.map((tone, index) => {
        const checked = tone === value;
        const { bg, fg } = toneVars(tone);
        return (
          <button
            key={tone}
            ref={(el) => {
              refs.current[index] = el;
            }}
            type="button"
            role="radio"
            aria-checked={checked}
            aria-label={toneName(tone)}
            title={toneName(tone)}
            tabIndex={checked ? 0 : -1}
            onClick={() => onChange(tone)}
            onKeyDown={(event) => onKeyDown(event, index)}
            className={cn(
              "grid size-8 place-items-center rounded-full border outline-none focus-visible:shadow-focus",
              checked ? "border-fg" : "border-line",
            )}
            style={{ background: bg, color: fg }}
          >
            {checked && <Check size={14} strokeWidth={3} aria-hidden />}
          </button>
        );
      })}
    </div>
  );
}
