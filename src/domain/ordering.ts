import { generateKeyBetween } from "fractional-indexing";
import type { Status, Task } from "./task";

/**
 * Card order within a column is a fractional-indexing key compared by byte
 * order (Postgres column uses COLLATE "C"; JS `<` on ASCII strings matches).
 * Ties — possible when two people insert at the same spot — break on id.
 */
export function compareTasks(a: Pick<Task, "position" | "id">, b: Pick<Task, "position" | "id">) {
  if (a.position !== b.position) return a.position < b.position ? -1 : 1;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

export function sortTasks<T extends Pick<Task, "position" | "id">>(tasks: readonly T[]): T[] {
  return [...tasks].sort(compareTasks);
}

export function columnTasks(tasks: readonly Task[], status: Status): Task[] {
  return sortTasks(tasks.filter((task) => task.status === status));
}

/** A key that sorts between `before` and `after` (either may be null for an open end). */
export function positionBetween(before: string | null, after: string | null): string {
  // Equal or inverted neighbours only happen after concurrent edits; fall back
  // to "just after `before`" rather than throwing.
  if (before !== null && after !== null && before >= after) return generateKeyBetween(before, null);
  return generateKeyBetween(before, after);
}

/** Key for a card appended to the end of a column. */
export function positionAtEnd(tasksInColumn: readonly Pick<Task, "position" | "id">[]): string {
  const last = sortTasks(tasksInColumn).at(-1);
  return positionBetween(last?.position ?? null, null);
}

/**
 * Key for moving `taskId` to `index` within `targetColumn` (the column's tasks
 * in display order, which may or may not already contain the moved task).
 */
export function positionForMove(
  targetColumn: readonly Pick<Task, "position" | "id">[],
  taskId: string,
  index: number,
): string {
  const others = targetColumn.filter((task) => task.id !== taskId);
  const clamped = Math.max(0, Math.min(index, others.length));
  const before = others[clamped - 1]?.position ?? null;
  const after = others[clamped]?.position ?? null;
  return positionBetween(before, after);
}
