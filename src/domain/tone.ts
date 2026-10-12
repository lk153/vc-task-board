import { ASSIGNEE_TONES, PRIORITIES, type Tone } from "@/config/board";
import type { Priority } from "./task";

/**
 * Stable color for an account (avatars, and a member's tag color when they're
 * added to a board's assignees). The 0003 migration repeats this hash in SQL.
 */
export function assigneeTone(userId: string): Tone {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) hash = (hash * 31 + userId.charCodeAt(i)) >>> 0;
  return ASSIGNEE_TONES[hash % ASSIGNEE_TONES.length];
}

export const priorityTone = (id: Priority): Tone =>
  PRIORITIES.find((p) => p.id === id)?.tone ?? "gray";

/** CSS custom-property references for a tone, e.g. `var(--t-blue-bg)`. */
export function toneVars(tone: Tone) {
  return {
    bg: `var(--t-${tone}-bg)`,
    fg: `var(--t-${tone}-fg)`,
    line: `var(--t-${tone}-line, var(--t-${tone}-bg))`,
  };
}
