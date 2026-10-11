import { ASSIGNEE_TONES, PRIORITIES, TASK_TYPES, type Tone } from "@/config/board";
import type { Priority, TaskType } from "./task";

/** Stable color for a board member, so the same person looks the same everywhere. */
export function assigneeTone(userId: string): Tone {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) hash = (hash * 31 + userId.charCodeAt(i)) >>> 0;
  return ASSIGNEE_TONES[hash % ASSIGNEE_TONES.length];
}

export const priorityTone = (id: Priority): Tone =>
  PRIORITIES.find((p) => p.id === id)?.tone ?? "gray";
export const typeTone = (id: TaskType): Tone => TASK_TYPES.find((t) => t.id === id)?.tone ?? "gray";

/** CSS custom-property references for a tone, e.g. `var(--t-blue-bg)`. */
export function toneVars(tone: Tone) {
  return {
    bg: `var(--t-${tone}-bg)`,
    fg: `var(--t-${tone}-fg)`,
    line: `var(--t-${tone}-line, var(--t-${tone}-bg))`,
  };
}
